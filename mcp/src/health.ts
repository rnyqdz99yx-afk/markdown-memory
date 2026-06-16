// Детерминированный read-only движок проверок здоровья mm-системы.
// Раунд 1: группы config (загрузка mm-config) и junctions (проводка ~/.claude/skills → repo).
// Ничего не чинит и не пишет. Суждение и авто-фиксы — в скилле mm-doctor.

import fs from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { loadMmConfig, type LoadedConfig } from './config-loader.js';

export type CheckStatus = 'ok' | 'warn' | 'fail';

export interface HealthCheck {
  id: string;
  status: CheckStatus;
  detail: string;
}

export interface HealthResult {
  checks: HealthCheck[];
  summary: { ok: number; warn: number; fail: number };
}

// Нормализация пути ссылки для сравнения: снять NT-префиксы (\\?\, \??\),
// привести к абсолютному, убрать хвостовой слэш, на win32 — регистронезависимо.
export function normalizeLinkPath(p: string): string {
  let s = String(p);
  s = s.replace(/^\\\\\?\\/, ''); // \\?\
  s = s.replace(/^\\\?\?\\/, ''); // \??\
  s = path.resolve(s);
  s = s.replace(/[\\/]+$/, '');
  if (process.platform === 'win32') s = s.toLowerCase();
  return s;
}

// Совпадает ли target junction-ссылки с ожидаемым путём (после нормализации обоих).
export function junctionMatches(actual: string, expected: string): boolean {
  return normalizeLinkPath(actual) === normalizeLinkPath(expected);
}

function configChecks(): { checks: HealthCheck[]; repoRoot: string | null } {
  const checks: HealthCheck[] = [];
  let loaded: LoadedConfig;
  try {
    loaded = loadMmConfig();
  } catch (e) {
    // Мягкая деградация: сбой загрузки — это check со status fail, не краш наверх.
    checks.push({
      id: 'config.load',
      status: 'fail',
      detail: `mm-config не загружен: ${(e as Error).message}`,
    });
    return { checks, repoRoot: null };
  }

  checks.push({
    id: 'config.load',
    status: 'ok',
    detail: `mm-config загружен (source: ${loaded.source}, repoRoot: ${loaded.repoRoot})`,
  });

  // Overlay: если local есть — loadMmConfig уже распарсил и смержил его (иначе кинул бы выше).
  const localPath = path.join(loaded.repoRoot, 'config', 'mm-config.local.json');
  checks.push({
    id: 'config.overlay',
    status: 'ok',
    detail: fs.existsSync(localPath)
      ? 'mm-config.local.json присутствует, валиден и смержен (local wins)'
      : 'mm-config.local.json отсутствует (overlay не требуется)',
  });

  // Ключевые пути: obsidian_* присутствуют + _repo_root инъектирован.
  const paths = (loaded.config.paths ?? {}) as Record<string, unknown>;
  const obsidianKeys = Object.keys(paths).filter((k) => k.startsWith('obsidian_'));
  const missing: string[] = [];
  if (obsidianKeys.length === 0) missing.push('paths.obsidian_*');
  if (!loaded.config._repo_root) missing.push('_repo_root');

  checks.push(
    missing.length === 0
      ? {
          id: 'config.keys',
          status: 'ok',
          detail: `ключевые пути присутствуют: obsidian_* (${obsidianKeys.length}), _repo_root инъектирован`,
        }
      : {
          id: 'config.keys',
          status: 'warn',
          detail: `отсутствуют ключи: ${missing.join(', ')}`,
        },
  );

  return { checks, repoRoot: loaded.repoRoot };
}

// Собирает целевые каталоги: skills/mm-* и vendor/* (каждый каталог).
function junctionTargets(repoRoot: string): {
  targets: { name: string; expected: string }[];
  checks: HealthCheck[];
} {
  const checks: HealthCheck[] = [];
  const targets: { name: string; expected: string }[] = [];

  const skillsDir = path.join(repoRoot, 'skills');
  try {
    for (const e of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (e.isDirectory() && (e.name === 'mm' || e.name.startsWith('mm-'))) {
        targets.push({ name: e.name, expected: path.join(skillsDir, e.name) });
      }
    }
  } catch (err) {
    checks.push({
      id: 'junctions.skills.scan',
      status: 'fail',
      detail: `не прочитать skills/: ${(err as Error).message}`,
    });
  }

  const vendorDir = path.join(repoRoot, 'vendor');
  try {
    if (fs.existsSync(vendorDir)) {
      for (const e of fs.readdirSync(vendorDir, { withFileTypes: true })) {
        if (e.isDirectory()) {
          targets.push({ name: e.name, expected: path.join(vendorDir, e.name) });
        }
      }
    }
  } catch (err) {
    checks.push({
      id: 'junctions.vendor.scan',
      status: 'fail',
      detail: `не прочитать vendor/: ${(err as Error).message}`,
    });
  }

  return { targets, checks };
}

function junctionChecks(repoRoot: string): HealthCheck[] {
  const { targets, checks } = junctionTargets(repoRoot);

  for (const { name, expected } of targets) {
    const linkPath = path.join(homedir(), '.claude', 'skills', name);
    const id = `junction.${name}`;

    // lstat: существование + тип reparse-point (junction на win32 даёт isSymbolicLink()===true).
    let st: fs.Stats;
    try {
      st = fs.lstatSync(linkPath);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      checks.push({
        id,
        status: 'fail',
        detail:
          code === 'ENOENT'
            ? `ссылка отсутствует: ${linkPath}`
            : `lstat ошибка (${code ?? 'UNKNOWN'}): ${(err as Error).message}`,
      });
      continue;
    }

    if (!st.isSymbolicLink()) {
      checks.push({
        id,
        status: 'fail',
        detail: `не symlink/junction (reparse-point): ${linkPath}`,
      });
      continue;
    }

    let target: string;
    try {
      target = fs.readlinkSync(linkPath);
    } catch (err) {
      // EINVAL/UNKNOWN на экзотических reparse-point'ах → fail этого элемента, не краш.
      const code = (err as NodeJS.ErrnoException).code;
      checks.push({
        id,
        status: 'fail',
        detail: `readlink ошибка (${code ?? 'UNKNOWN'}): ${(err as Error).message}`,
      });
      continue;
    }

    checks.push(
      junctionMatches(target, expected)
        ? { id, status: 'ok', detail: `→ ${expected}` }
        : {
            id,
            status: 'fail',
            detail: `target не совпал: ${normalizeLinkPath(target)} ≠ ${normalizeLinkPath(expected)}`,
          },
    );
  }

  return checks;
}

// Прогоняет все проверки Раунда 1. Никогда не кидает: сбои отражаются как checks со status fail.
export function runHealth(): HealthResult {
  const checks: HealthCheck[] = [];

  const cfg = configChecks();
  checks.push(...cfg.checks);

  if (cfg.repoRoot) {
    checks.push(...junctionChecks(cfg.repoRoot));
  } else {
    checks.push({
      id: 'junctions.skipped',
      status: 'warn',
      detail: 'проверка junction пропущена — repoRoot не определён (config.load failed)',
    });
  }

  const summary = {
    ok: checks.filter((c) => c.status === 'ok').length,
    warn: checks.filter((c) => c.status === 'warn').length,
    fail: checks.filter((c) => c.status === 'fail').length,
  };

  return { checks, summary };
}
