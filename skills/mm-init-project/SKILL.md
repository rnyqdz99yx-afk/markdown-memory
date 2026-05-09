---
name: mm-init-project
description: Инициализирует или обновляет проект для mm-системы — создаёт passport.md в корне, копию в Obsidian, dashboard.md, папку sessions/, и project-instructions.md для claude.ai. Use when user says "оформи проект", "сделай паспорт", "init project", "/mm-init", "/mm-init-project", "обнови паспорт", "регистрирую проект". Работает на пустой папке (новый проект) и на существующем коде (auto-detect стека).
---

# mm-init-project — Project Bootstrap & Refresh

Создаёт «паспорт» проекта — единый источник контекста для claude.ai Project Knowledge и для всех mm-* skills.

## Конфиг

Прочитай `C:\Users\louise\Desktop\louise-skills\config\mm-config.json`. Понадобится:
- `paths.obsidian_projects` — куда класть папку проекта
- `paths.skills_repo` — где лежит шаблон паспорта (`templates/passport.md`)
- `bot_defaults.*` — для дефолтов если проект — Telegram-бот
- `default_language`

## Режимы работы

Определи режим автоматически:
1. **Init** — в корне рабочей папки нет `passport.md`. Создаёшь с нуля.
2. **Update** — `passport.md` уже есть. Перегенерируешь, сохраняя ручные правки в секциях 8 и 10 (см. ниже).

В обоих режимах в конце копируешь свежий паспорт в Obsidian.

## Процесс

### Шаг 1. Определи целевую папку и имя проекта

- **Целевая папка**: текущий `cwd`. Если она внутри `.claude/worktrees/...` — поднимись к корню репо.
- **Имя проекта**: имя корневой папки (slug-friendly). Спроси подтверждение одной строкой: `Имя проекта: <name>. Ок?`. Если нет — спроси новое.

### Шаг 2. Просканируй проект

Прочитай эти файлы если есть:
- `package.json`, `pyproject.toml`, `requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml` — стек
- `README.md` — описание
- `.env.example`, `.env.template` — env vars
- `Dockerfile`, `docker-compose.yml`, `railway.json`, `vercel.json` — деплой
- `CLAUDE.md`, `.planning/` — GSD статус
- `.git/config` — remote
- Сделай `git log --oneline -10` если репо

Определи:
- Язык, фреймворк, версии
- Тип (`bot` если есть `aiogram`/`telegram`/`telethon`, `web` если `fastapi`/`flask`/`react`, `lib` если в `pyproject.toml` есть `[project]` без entry point, иначе `script`)
- Точки входа (`main.py`, `app.py`, `bot.py`, `index.ts`, ...)
- Менеджер пакетов (`uv`/`poetry`/`pip`/`npm`/`pnpm`/`bun`)

Если папка пустая или почти пустая — режим **новый проект**: задай 3 вопроса:
1. Тип: `bot / web / lib / script`?
2. Язык / фреймворк? (если bot — дефолт из `bot_defaults`)
3. Назначение в одном предложении?

### Шаг 3. Сохрани ручные правки (только режим update)

Прочитай существующий `passport.md`. Извлеки:
- Секцию 8 «Контекст для промптов» целиком
- Секцию 10 «Текущее состояние» целиком
- Историю версий (секция 11)

В новом паспорте эти три секции **не перезаписывай авто-генерацией**:
- Секции 8 и 10 — оставь точно как были (пользователь редактирует руками).
- В секции 11 добавь строку с сегодняшней датой и кратким описанием обновления.

### Шаг 4. Сгенерируй passport.md

Возьми шаблон `<skills_repo>\templates\passport.md`. Заполни секции 1-7, 9 на основе сканирования. Секции 8 и 10:
- **Init**: оставь шаблонные подсказки, добавь TODO-маркер `<!-- TODO louise: заполни секцию 8 — это самая важная часть -->`.
- **Update**: подставь сохранённый текст.

Frontmatter:
- `created` — из существующего файла или сегодня
- `updated` — сегодня (`2026-05-09` формат)
- `mm_version` — из mm-config

Сохрани в `<project_root>/passport.md`.

### Шаг 5. Создай структуру в Obsidian

Путь: `<obsidian_projects>/<project_name>/`

Создай директории если нет:
- `<project>/` (корень)
- `<project>/sessions/`
- `<project>/prompts/` (для удачных промптов вручную)
- `<project>/snapshots/` (для context-snapshots при handoff)

Скопируй (Read + Write):
- `passport.md` → `<project>/passport.md`

Создай если нет:
- `<project>/dashboard.md` — короткий «текущий статус»:

```markdown
---
project: <name>
updated: <date>
---

# <name> — Dashboard

## Сейчас
<что в работе>

## Последние сессии
- [[sessions/<latest>]]

## Открытые вопросы
- [ ] см. passport.md секция 10

## Ссылки
- Код: `<абсолютный путь>`
- Паспорт: [[passport]]
- Sessions: [[sessions/]]
```

### Шаг 6. Сгенерируй project-instructions.md для claude.ai

Прочитай `<skills_repo>\templates\project-instructions.md`. Подставь `<PROJECT_NAME>` на имя проекта. Сохрани в `<obsidian_projects>/<project_name>/project-instructions.md`.

### Шаг 7. Обнови или создай CLAUDE.md в корне проекта

Если `CLAUDE.md` существует — добавь секцию (если её ещё нет):

```markdown
## mm-system

Этот проект подключён к mm-системе.
- Паспорт: `passport.md` (актуальный source-of-truth)
- Obsidian: `<obsidian_projects>/<project_name>/`
- Skills: глобальные `mm-*` (см. `~/.claude/skills/`)
- Конец сессии: `/mm-save-session`
- Перед новым чатом claude.ai: `/mm-handoff`
```

Если `CLAUDE.md` нет — создай минимальный с этой секцией.

### Шаг 8. Финальный отчёт

Выведи (в отдельных блоках, не одной строкой):

```
✅ mm-init-project завершён

Режим: <init | update>
Проект: <name>
Тип: <type> | Язык: <lang> | Стек: <главное>

Создано / обновлено:
- <project>/passport.md (<X секций заполнено / TODO в секции 8>)
- <obsidian>/Projects/<name>/passport.md
- <obsidian>/Projects/<name>/dashboard.md
- <obsidian>/Projects/<name>/project-instructions.md
- <project>/CLAUDE.md (секция mm-system)

Следующие шаги:
1. Открой passport.md и заполни секцию 8 «Контекст для промптов» — это критично
2. claude.ai → New Project «<name>»
3. Project Knowledge → загрузи passport.md и dashboard.md из Obsidian
4. Project Instructions → скопируй текст из <obsidian>/Projects/<name>/project-instructions.md
5. Готово — можно описывать идеи, claude.ai будет генерить промпты для меня
```

## Edge cases

- **Папка вне Desktop / на другом диске**: всё равно работаешь, абсолютные пути из cwd.
- **Имя проекта совпадает с существующим в Obsidian**: спроси — `Папка <obsidian>/Projects/<name>/ уже есть. Update (1) / Создать <name>-2 (2) / Отмена (3)?`
- **Нет git**: пропусти git-секции, не падай.
- **Несколько языков** (моно-репо): перечисли в стеке через запятую, типу присвой `multi`.
- **Проект уже использует GSD** (есть `.planning/`): добавь в секцию 9 паспорта строку: `GSD: yes (см. .planning/STATE.md)`. Не конфликтуй с GSD — mm-система комплементарна.

## Что НЕ делать

- Не создавать новые `.git/`, не делать `git init` без явного запроса.
- Не пушить ничего в remote.
- Не трогать `secrets`, `.env`, не читать значения из `.env` (только имена).
- Не переписывать секции 8 и 10 паспорта автоматически в режиме update.
- Не задавать больше 3-4 вопросов подряд — для остального бери разумные дефолты.
