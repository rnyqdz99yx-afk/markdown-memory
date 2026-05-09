# louise-skills

Личная mm-система для **louise**: связка `claude.ai` ↔ Claude Code в PowerShell ↔ Obsidian, через kacтомные skills `mm-*`.

## Зачем

Решает четыре проблемы:

1. **«Забыла какие skills использовала ранее»** — все skills в этом git-репо, junction'ятся в `~/.claude/skills/`, на любой машине: `git clone` + `register-skills.ps1` = всё доступно.
2. **«Новый чат в claude.ai не знает про проект»** — `passport.md` живёт в Project Knowledge, `handoff.md` догружает контекст последних сессий.
3. **«claude.ai слушает идеи, PowerShell делает работу»** — `mm-bridge` пишет файл-мост в Obsidian, копипастишь оттуда в PowerShell.
4. **«Каждый проект приходится настраивать руками»** — `mm-init-project` за один раз создаёт паспорт, обсидиан-структуру, инструкции для claude.ai.

## Архитектура

```
louise-skills/  (этот репо — source of truth)
├── skills/
│   ├── mm-init-project/    ← создать/обновить паспорт проекта + Obsidian
│   ├── mm-bridge/          ← промпт-мост в файл (claude.ai → PowerShell)
│   ├── mm-handoff/         ← сводка для нового чата claude.ai
│   ├── mm-save-session/    ← закрыть сессию, лог в Obsidian
│   └── mm-instructions/    ← генерить Project Instructions
├── templates/
│   ├── passport.md         ← стандарт паспорта проекта
│   └── project-instructions.md  ← шаблон для claude.ai Instructions
├── config/
│   └── mm-config.json      ← пути, дефолты, namespace
├── scripts/
│   └── register-skills.ps1 ← junction'ит skills/ → ~/.claude/skills/
└── MIGRATION.md            ← миграция со старой системы Claude Setup/
```

**Source of truth:** `C:\Users\louise\Desktop\louise-skills\` (этот репо).
**Active location:** `~/.claude/skills/mm-*` через NTFS junction. Edit в этом репо — мгновенно везде.

## Setup на новой машине

```powershell
git clone <remote> $HOME\Desktop\louise-skills
cd $HOME\Desktop\louise-skills
# Поправь пути в config/mm-config.json под свою машину
pwsh scripts/register-skills.ps1
# Перезапусти Claude Code
```

---

# Три сценария workflow

## A. Новый проект

```
1. Создай папку проекта (или используй существующую)
2. cd <папка> && claude
3. /mm-init-project
   → ответь на 1-3 вопроса (тип, язык, назначение)
   → получи passport.md в корне + копию в Obsidian
4. Открой passport.md, заполни секцию 8 «Контекст для промптов» — это критично
5. claude.ai → New Project «<имя>»
   → Knowledge: загрузи passport.md и dashboard.md из Obsidian
   → Instructions: вставь текст из <obsidian>/Projects/<имя>/project-instructions.md
6. Готово. Описывай идеи в claude.ai → получай промпты для PowerShell
```

## B. Контекст в чате claude.ai заполнился

```
1. В Claude Code (PowerShell): /mm-handoff
   → создаст handoff.md в <obsidian>/Projects/<имя>/
2. claude.ai → этот же Project → Knowledge
   → удали старый handoff.md (если был)
   → загрузи новый
3. New Chat в Project
4. Первая реплика: «Прочитай handoff.md и passport.md, скажи где мы.»
5. Продолжаешь работу — passport уже знаком, handoff даёт последние 1-2 недели
```

## C. Конец сессии

```
В PowerShell-сессии: /mm-save-session
→ запишет лог в Obsidian/Claude/Sessions/
→ обновит project note
→ обновит INDEX.md
```

Если использовала Bash-эквивалент «закругляемся» / «сохрани» / «до завтра» —
skill сработает на эти триггеры тоже (см. description в SKILL.md).

---

# Skills: справочник

| Команда | Когда вызывать | Что делает |
|---|---|---|
| `/mm-init-project` | Новый проект ИЛИ паспорт устарел | Создаёт/обновляет `passport.md`, копию в Obsidian, dashboard, project-instructions |
| `/mm-bridge` | Из claude.ai/web Клода нужно отправить задачу в PowerShell | Пишет `next-prompt.md` в Obsidian/Bridge/, архивирует прошлый |
| `/mm-handoff` | Контекст в чате claude.ai заполняется | Генерит `handoff.md` — выжимка последних сессий + git + open questions |
| `/mm-save-session` | Конец работы в PowerShell-сессии | Лог в Sessions/, обновление project note и INDEX.md |
| `/mm-instructions` | Создан новый Project в claude.ai ИЛИ паспорт сильно изменился | Генерит готовый текст для Project Instructions |

## Добавить новый mm-skill

1. Создай `skills/mm-<name>/SKILL.md` (см. примеры существующих).
2. Запусти `pwsh scripts/register-skills.ps1`.
3. Перезапусти Claude Code сессию.
4. Готово.

## Конфиг

Все пути и дефолты — в `config/mm-config.json`. Skills читают его при запуске.

Менять напрямую безопасно: ничего не хардкодится в SKILL.md, кроме самого пути к конфигу.

---

## Git

Сейчас remote не настроен. Когда решишь — приватно или публично:

```powershell
git remote add origin <url>
git push -u origin main
```

После этого можно использовать на других машинах через `git clone`.

## См. также

- [`MIGRATION.md`](MIGRATION.md) — миграция со старой папки `Claude Setup/`
- [`templates/passport.md`](templates/passport.md) — формат паспорта проекта
- [`templates/project-instructions.md`](templates/project-instructions.md) — шаблон для claude.ai
- `~/.claude/CLAUDE.md` — глобальные правила (Obsidian-интеграция). Дублируется в mm-save-session как skill, чтобы не забывалось.
