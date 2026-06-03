# Migration: `Claude Setup/` → `markdown-memory/`

> Дата: 2026-05-09
> Контекст: первая итерация (`Claude Setup/`) была копипаст-промптами. Вторая итерация (этот репо) — система skills с автоподкачкой.

## TL;DR

`Claude Setup/` больше не нужна. Всё, что она делала, теперь делают **mm-skills** автоматически.

| Было (`Claude Setup/`) | Стало (`markdown-memory/`) |
|---|---|
| `CLAUDE_CODE_SETUP.md` — копипастил в Claude Code | `/mm-init-project` — skill, доступен везде |
| `CLAUDE_CHAT_INSTRUCTIONS.md` — копипастил в Project Instructions | `/mm-instructions` — генерит текст под проект, кладёт в Obsidian |
| `CONTEXT_RESET_GUIDE.md` — мануал что делать когда чат забит | `/mm-handoff` — генерит handoff.md для нового чата автоматом |
| `QUICK_START_GUIDE.md` — длинный мануал | [`README.md`](README.md) — три сценария |
| skills внутри: save-session, update-passport, push, save-all | `/mm-save-session`, `/mm-init-project` (обновляет паспорт), git — отдельно по запросу |

## Что делать с папкой `Claude Setup/`

Папка лежит в `C:\Users\louise\Desktop\markdown-memory\Claude Setup\` (вне git, untracked).

**Безопасный путь:**
1. Переименуй в `_legacy_claude_setup/` чтобы не путалась под рукой:
   ```powershell
   Rename-Item "C:\Users\louise\Desktop\markdown-memory\Claude Setup" "_legacy_claude_setup"
   ```
2. Через 2-3 недели использования mm-системы — удали:
   ```powershell
   Remove-Item -Recurse -Force "C:\Users\louise\Desktop\markdown-memory\_legacy_claude_setup"
   ```

**Что взять из старой системы перед удалением (если захочешь):**
- Текст 11-секционного паспорта из `CLAUDE_CODE_SETUP.md` Шаг 4 — **уже перенесён** в `templates/passport.md`, можно не забирать.
- Маршрутизация GSD-команд из `CLAUDE_CHAT_INSTRUCTIONS.md` — в новых инструкциях упрощена. Если активно использовала GSD — посмотри `claude --dangerously-skip-permissions.txt` и реши, нужны ли эти команды в `templates/project-instructions.md`.

## Что изменилось концептуально

### Раньше

Каждый новый проект = вручную:
1. Открыть Claude Code, вставить ~200 строк промпта.
2. Дождаться когда Клод задаст 5 вопросов.
3. Открыть Project в claude.ai, вставить инструкции (тот же текст для всех проектов).
4. Загрузить passport.md.

Если забыла файлы `Claude Setup/` дома — настройка невозможна.

### Сейчас

Skills `mm-*` живут в `~/.claude/skills/` через NTFS junction'ы, source — этот репо.
- Новый проект: `cd <папка> && claude` → `/mm-init-project` → отвечаешь на 1-3 вопроса.
- Skills всегда доступны во всех проектах автоматом.
- `mm-config.json` — единый источник путей, ничего не хардкодится.
- Версионирование через git — откат, история, синхронизация на другую машину.

## На другой машине

```powershell
git clone <remote> C:\Users\<user>\Desktop\markdown-memory
cd C:\Users\<user>\Desktop\markdown-memory
# Поправь пути в config/mm-config.json под свою машину
pwsh scripts/register-skills.ps1
# Перезапусти Claude Code
```

Всё. Все mm-skills становятся доступны во всех проектах.

## Если что-то не работает

1. Проверь что junction создан:
   ```powershell
   Get-Item ~\.claude\skills\mm-bridge | Select-Object FullName, Target
   ```
2. Проверь что Claude Code видит skill: внутри сессии `/help` должен показать список skills.
3. Проверь `mm-config.json` — пути актуальны для твоей машины.
