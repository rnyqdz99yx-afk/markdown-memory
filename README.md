# louise-skills

Личная коллекция Claude Code skills и шаблонов проектов для Telegram-ботов.

## Структура

```
louise-skills/
├── skills/              # Custom Claude Code skills (namespace mm-*)
│   └── <name>/
│       └── SKILL.md     # Skill definition
├── templates/           # Project templates (telegram-bot, и т.д.)
├── config/
│   └── mm-config.json   # Глобальные настройки (vault path, namespace, язык)
└── scripts/
    └── register-skills.ps1  # Junction'ит skills/ в ~/.claude/skills/
```

## Как работает

**Source of truth:** `C:\Users\louise\Desktop\louise-skills\` (этот git-репо).
**Active location:** `~/.claude/skills/mm-*` — junction'ы (NTFS), читают тот же файл.

Любой edit в `louise-skills/skills/<name>/SKILL.md` мгновенно виден Claude Code в любой сессии.

## Workflow

### Добавить новый skill
1. Создать папку `skills/mm-<name>/` с `SKILL.md`.
2. Запустить `pwsh scripts/register-skills.ps1` (создаст junction).
3. Перезапустить Claude Code сессию (skills загружаются на старте).

### Обновить существующий skill
1. Edit `skills/mm-<name>/SKILL.md`.
2. Готово. Junction указывает на тот же файл — никакой синхронизации не нужно.

### Skills

| Name | Purpose | Status |
|---|---|---|
| `mm-bridge` | Bridge-промпт для PowerShell-инстанса | ✅ |

## Config

`config/mm-config.json` — единый источник путей и предпочтений. Skills читают его при запуске.

## Git

```bash
git remote add origin <url>
git push -u origin main
```

(Remote добавляется когда решишь, куда пушить — приватно или публично.)
