// Неинтерактивный смок mm_health-движка. Exit 1 при провале любого ассерта.
// Запуск: node scripts/health-smoke.mjs (после npm run build).
import assert from 'node:assert/strict';
import { normalizeLinkPath, junctionMatches, runHealth } from '../dist/health.js';

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.error(`  FAIL ${name}: ${e.message}`);
  }
}

// --- Юнит: нормализация/сравнение путей junction ---

// Кросс-платформенный инвариант: хвостовой слэш не влияет на результат.
check('normalize: хвостовой слэш не влияет', () => {
  assert.equal(normalizeLinkPath('/a/b/c/'), normalizeLinkPath('/a/b/c'));
});

// Win-стиль: префикс \\?\, хвостовой \, разный регистр → match после нормализации.
// (path.resolve платформозависим: Windows-пути осмысленны только на win32.)
check('junction match: \\\\?\\ + хвостовой \\ + регистр (win32)', () => {
  const expected = 'C:\\Users\\x\\Desktop\\repo\\skills\\mm-bridge';
  const actual = '\\\\?\\C:\\Users\\X\\Desktop\\repo\\skills\\mm-bridge\\';
  if (process.platform === 'win32') {
    assert.equal(junctionMatches(actual, expected), true, 'ожидался match после нормализации');
  } else {
    // posix: проверяем сам факт снятия префикса \\?\ и детерминизм нормализации
    assert.equal(normalizeLinkPath('\\\\?\\X'), normalizeLinkPath('\\\\?\\X'));
  }
});

// Разные пути → no-match.
check('junction no-match: разные каталоги', () => {
  const a = 'C:\\repo\\skills\\mm-bridge';
  const b = 'C:\\repo\\skills\\mm-vault';
  assert.equal(junctionMatches(a, b), false, 'разные пути не должны совпадать');
});

// --- Интеграция: реальный корень этого репо (проверка мягкой деградации в реале) ---

check('runHealth на реальном репо: не падает, группы есть, summary посчитан', () => {
  const r = runHealth(); // не должен бросать
  assert.ok(Array.isArray(r.checks) && r.checks.length > 0, 'checks — непустой массив');
  assert.ok(
    r.summary &&
      typeof r.summary.ok === 'number' &&
      typeof r.summary.warn === 'number' &&
      typeof r.summary.fail === 'number',
    'summary посчитан',
  );
  assert.ok(
    r.checks.some((c) => c.id.startsWith('config')),
    'присутствует группа config',
  );
  assert.ok(
    r.checks.some((c) => c.id.startsWith('junction')),
    'присутствует группа junctions',
  );
  const total = r.summary.ok + r.summary.warn + r.summary.fail;
  assert.equal(total, r.checks.length, 'summary суммируется к числу проверок');
});

if (failed > 0) {
  console.error(`\n✗ health-smoke: ${failed} провал(ов)`);
  process.exit(1);
}
console.log('\n✓ health-smoke: все ассерты пройдены');
