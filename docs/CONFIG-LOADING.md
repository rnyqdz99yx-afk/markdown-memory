# Config Loading Standard

> Все mm-* skills используют **одинаковый** алгоритм поиска `mm-config.json`.
> Этот документ — единственный source-of-truth. SKILL.md ссылаются сюда.

## Задача

Найти и загрузить `mm-config.json` так, чтобы это работало:
- На любой машине / у любого пользователя (не только `C:\Users\louise\...`)
- Если репо переехал (`Desktop` → `Documents`, или `C:\` → `D:\`)
- В разработке репо (через junction в `~/.claude/skills/`)
- В worktree
- Без правок SKILL.md при переезде

## Алгоритм (применяй точно в этом порядке)

### Шаг 1. Если есть `MM_REPO_ROOT` — используй

```powershell
$env:MM_REPO_ROOT  # PowerShell
echo $MM_REPO_ROOT  # bash/zsh
```

Если переменная определена и `<MM_REPO_ROOT>/config/mm-config.json` существует — используй. Stop.

### Шаг 2. Resolve через junction (где находится сам SKILL.md)

Skill читается через junction `~/.claude/skills/mm-<name>/SKILL.md`. Targets junction'a — реальный путь в repo.

PowerShell:
```powershell
$skillPath = "$env:USERPROFILE\.claude\skills\mm-bridge"
$realPath = (Get-Item $skillPath -Force).Target
# $realPath ≈ C:\Users\louise\Desktop\markdown-memory\skills\mm-bridge
$repoRoot = Split-Path -Parent (Split-Path -Parent $realPath)
# $repoRoot = C:\Users\louise\Desktop\markdown-memory
```

Если `<repoRoot>/config/mm-config.json` существует — используй. Stop.

### Шаг 3. Fallback (если шаги 1-2 не сработали)

Если `MM_REPO_ROOT` не задан и симлинк/junction не разрезолвился — это нештатная ситуация (переменные окружения сбросились). Переходи к шагу 4 и попроси пользователя заново запустить автонастройку.

### Шаг 4. Если ничего не нашлось

Скажи пользователю:
```
Не могу найти mm-config.json. Установите MM_REPO_ROOT:

Windows (PowerShell):
[Environment]::SetEnvironmentVariable("MM_REPO_ROOT", "C:\путь\к\markdown-memory", "User")

macOS/Linux:
export MM_REPO_ROOT="/Users/username/markdown-memory"

Или запустите npx-установку:
npx markdown-memory
```

Останови выполнение skill.

## Local overrides (mm-config.local.json)

После загрузки `mm-config.json` — проверь рядом `mm-config.local.json`. Если есть — слей, **local выигрывает на уровне ключей**.

Пример:
```json
// config/mm-config.json (committed)
{
  "paths": {
    "obsidian_vault": "C:\\Users\\louise\\Documents\\Obsidian Vault"
  }
}

// config/mm-config.local.json (gitignored, на втором ноуте)
{
  "paths": {
    "obsidian_vault": "D:\\Sync\\ObsidianVault"
  }
}

// Эффективный конфиг:
{
  "paths": {
    "obsidian_vault": "D:\\Sync\\ObsidianVault"  ← из local
  }
}
```

Слияние **глубокое** (deep merge): пути в `local` перекрывают одноимённые в основном, остальные ключи сохраняются.

## Псевдокод (используй один-в-один)

```
function load_mm_config():
    repo_root = $env:MM_REPO_ROOT
    if not repo_root:
        skill_dir = "~/.claude/skills/mm-bridge"  # любой mm-skill (развернуть ~)
        if exists(skill_dir):
            real = resolve_symlink_or_junction(skill_dir)
            if real:
                repo_root = parent(parent(real))
    if not repo_root or not exists("$repo_root/config/mm-config.json"):
        error("No mm-config.json found. Set MM_REPO_ROOT or run npx markdown-memory.")

    config = read_json("$repo_root/config/mm-config.json")
    local = "$repo_root/config/mm-config.local.json"
    if exists(local):
        local_config = read_json(local)
        config = deep_merge(config, local_config)  # local wins

    config._repo_root = repo_root  # инжектим для удобства
    return config
```

## Что НЕ делать

- Не хардкодить `C:\Users\louise\...` в SKILL.md.
- Не пытаться писать в `config/mm-config.json` из skill (только чтение).
- Не падать молча — если не нашёл, скажи пользователю команду для починки.
