---
name: mm-bridge
description: Compose a ready-to-copy prompt for the user's OTHER Claude Code instance (running in PowerShell). Use when the user asks to "напиши промпт для powershell", "сгенерируй задание для другого клода", "переброс задачи в основной клод", or any request to hand off work to the PowerShell instance. Writes to Claude/Bridge/next-prompt.md in the Obsidian vault and archives the previous prompt automatically. The PowerShell instance has zero memory of this conversation, so the prompt MUST be self-contained.
---

# mm-bridge — Prompt Composer for PowerShell Claude Code

You are running in the **app instance** of Claude Code. The user has another Claude Code instance running in **PowerShell** which is the actual execution environment (where most code work happens). This skill composes a self-contained prompt that the user copy-pastes into the PowerShell instance.

The PowerShell instance has **no memory** of this conversation. Every prompt must stand alone.

## Config

Read `C:\Users\louise\Desktop\louise-skills\config\mm-config.json` to get:
- `paths.obsidian_bridge` — destination directory
- `paths.obsidian_bridge_archive` — archive directory
- `default_language` — language for prompts (default: ru)

## Process

1. **Gather task context from this conversation.** What does the user want done? In which project? With what constraints?

2. **If critical context is missing, ask before writing.** A bad prompt wastes the PowerShell session. Specifically check you know:
   - Target working directory (absolute path).
   - What success looks like (definition of done).
   - Files that must be read by the other instance.
   - Any non-obvious constraints (style, framework, deadline).
   Don't ask more than 3 questions — if the user says "you decide" or "default", make a reasonable choice and note it in the prompt.

3. **Archive the previous bridge prompt.** Before overwriting `next-prompt.md`:
   - Check if `<obsidian_bridge>/next-prompt.md` exists.
   - If yes: read its frontmatter to get `created` timestamp and `slug`. Move it (Read + Write to new path; do NOT delete the source until the new write succeeds) to `<obsidian_bridge_archive>/YYYY-MM-DD-HHMM-<slug>.md` based on its own timestamp.
   - If the file has no slug, derive one from the first heading.

4. **Write the new prompt** to `<obsidian_bridge>/next-prompt.md` using the format below.

5. **Confirm to user** in one sentence with the absolute path. Example: `Готово. Скопируй из C:\Users\louise\Documents\Obsidian Vault\Claude\Bridge\next-prompt.md и вставь в PowerShell.`

## Bridge File Format

```markdown
---
created: <ISO 8601 timestamp, e.g. 2026-04-26T15:30:00>
project: <project slug or "general">
project_path: <absolute target dir>
task_type: feature | bugfix | refactor | setup | research | other
slug: <kebab-case-short-summary, max 5 words>
---

# Задача
<one-paragraph imperative statement of what to do>

# Контекст
<2-5 sentences: why this matters, what's already in place, what NOT to touch>

# Файлы для чтения сначала
- `<absolute path>` — <зачем>
- `<absolute path>` — <зачем>

# Что нужно сделать
1. <шаг>
2. <шаг>
3. <шаг>

# Ограничения
- <ограничение по стилю / фреймворку / зависимостям>
- <что НЕ делать>

# Done when
- [ ] <критерий 1, проверяемый>
- [ ] <критерий 2>
- [ ] <критерий 3>

# Полезные команды (опционально)
```bash
# example commands the other instance might run
```
```

## Style rules for the prompt body

- **Russian by default** (per user preference). Switch to English only if the project explicitly uses English (e.g., open-source library).
- **Imperative mood:** "Создай X", "Обнови Y", "Проверь Z" — not "Можно ли...".
- **Absolute paths** (`C:\Users\louise\Desktop\Scripts\...`) — the PowerShell instance has its own CWD, don't assume.
- **No references to "we" or "earlier conversation"** — the PowerShell instance wasn't there.
- **Define done concretely.** "Бот запускается без ошибок" is good. "Бот хорошо работает" is not.
- **Keep it tight.** 1 page max. If the task is bigger, split it into multiple bridges or recommend a GSD phase plan.
- **Reference existing project conventions** when relevant. If the project has `CLAUDE.md` or `passport.md`, mention it: "Перед началом прочитай `CLAUDE.md` в этой папке."

## When to push back instead of writing the prompt

If the user's task is:
- Vague ("сделай мне бота") → ask 1-2 clarifying questions first.
- Multi-day scope → suggest GSD plan-phase instead, point to `/gsd-plan-phase`.
- Trivial (one-line edit) → just describe what they should type, no need for a full bridge file.

## Output at the end

```
Готово. Файл: <absolute_path>
Архив прошлого: <archive_path or "(не было)">
Скопируй и вставь в PowerShell-сессию.
```
