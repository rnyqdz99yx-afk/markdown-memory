# Secret Patterns — единый источник для scrub перед записью

> Единый список regex-паттернов потенциальных секретов. **Source of truth** для всех mm-скиллов, которые пишут пользовательский контент туда, откуда он может утечь (в claude.ai Project Knowledge или в долговременный vault).
>
> Используется:
> - `mm-init-project` — проверка `passport.md` перед тем как он попадёт в claude.ai.
> - `mm-handoff` — scrub `handoff.md` перед записью (он тоже едет в Project Knowledge).
>
> Список вдохновлён context-mode и расширен. Раскладка имён полей — case-insensitive.

## Правило: маскировать, НЕ удалять

Найденный секрет **заменяй типизированным плейсхолдером с сохранением контекста**, чтобы заметка осталась осмысленной. Не вырезай строку целиком.

- `TELEGRAM_TOKEN=123456:ABC...` → `TELEGRAM_TOKEN=<REDACTED:telegram-token>`
- `Authorization: Bearer eyJ...` → `Authorization: Bearer <REDACTED:jwt>`
- `api_key: sk-abc...` → `api_key: <REDACTED:openai-key>`
- `postgres://u:p@host/db` → `postgres://<REDACTED:conn-creds>@host/db`

Тип в плейсхолдере (`telegram-token`, `jwt`, `aws-key`, `conn-creds`, …) — по классу совпавшего паттерна.

## Класс A — ВЫСОКОТОЧНЫЕ (маскировать молча)

Низкий риск ложного срабатывания → маскируй автоматически, без вопроса. Уведоми пользователя одной строкой по факту (что и сколько замаскировано).

| Pattern | Что ловит | Тип плейсхолдера |
|---|---|---|
| `(?i)(authorization\|api[_-]?key\|secret\|password\|token\|bearer\|cookie\|signature\|private[_-]?key)[\s:=]+\S{8,}` | Именованные ключи (любая раскладка имени поля) | `secret` |
| `[0-9]{8,12}:[A-Za-z0-9_\-]{30,}` | Telegram bot tokens (`bot_id:token`) | `telegram-token` |
| `sk-[A-Za-z0-9]{20,}` | OpenAI / Anthropic ключи | `openai-key` |
| `sk-ant-[A-Za-z0-9_\-]{40,}` | Anthropic API keys | `anthropic-key` |
| `ghp_[A-Za-z0-9]{30,}` / `gho_` / `ghs_` / `ghu_` / `ghr_` | GitHub tokens (все типы) | `github-token` |
| `xox[baprs]-[A-Za-z0-9-]{10,}` | Slack tokens | `slack-token` |
| `AKIA[0-9A-Z]{16}` | AWS access key ID | `aws-key` |
| `[A-Za-z0-9/+]{40}` рядом с `aws_secret` | AWS secret access key | `aws-secret` |
| `AIza[0-9A-Za-z_\-]{35}` | Google API keys | `google-key` |
| `ya29\.[A-Za-z0-9_\-]+` | Google OAuth tokens | `google-oauth` |
| `eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}` | JWT tokens | `jwt` |
| `-----BEGIN (RSA \|EC \|OPENSSH \|DSA \|PGP )?PRIVATE KEY-----` | Inline private keys | `private-key` |
| `https?://[^\s]*:[^@\s/]+@` | URL'ы с inline credentials | `conn-creds` |
| `mongodb(\+srv)?://[^\s/]+:[^@\s/]+@` | MongoDB connection strings | `conn-creds` |
| `postgres(ql)?://[^\s/]+:[^@\s/]+@` | Postgres connection strings | `conn-creds` |
| `redis://[^\s/]*:[^@\s/]+@` | Redis с password | `conn-creds` |

## Класс B — ШИРОКИЕ / WARN-ONLY (НЕ маскировать молча)

Высокий риск ложного срабатывания → **только предупредить** пользователя, ничего не маскировать автоматически. Решение оставить за человеком.

| Pattern | Что ловит | Почему warn-only |
|---|---|---|
| `[A-Za-z0-9_\-]{32,}` (есть и буквы, и цифры) | Длинные токены/хеши ≥32 символов | Задевает **git SHA-40, UUID, base64-блобы** — их полно в session-логах mm; молчаливая маскировка испортит заметку |

Формат предупреждения (одна строка на находку):
```
⚠️ возможный секрет/длинная строка в <файл/секция>, строка N: <первые 12 симв.>… — проверь вручную (не замаскировано).
```

Не блокируй запись из-за Класса B — это подсказка, не стоп.
