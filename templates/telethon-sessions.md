# Telethon: работа с готовыми Telegram-аккаунтами формата `session + json`

Инструкция для ИИ-агента, который пишет код под сценарий: запуск **готовых купленных** Telegram-аккаунтов (пара `.session` + `.json`) через чистый `telethon` с SOCKS5-прокси.

Главное правило: каждый аккаунт должен подниматься **со всеми параметрами устройства из своего `.json`** и через прокси. Голый запуск только по `.session` без параметров — почти гарантированный бан/спамблок, потому что Telegram сравнивает текущий fingerprint с тем, что было при регистрации.

---

## 1. Стек

- **`telethon`** (актуальная стабильная v1, например `1.34.0+`) — клиент MTProto.
- **`python-socks[asyncio]`** — SOCKS5 для telethon.
  
```bash
pip install telethon "python-socks[asyncio]"
```

> `opentele2` намеренно **не** используется. Из её фич в нашем случае реально полезна только передача `lang_pack="tdesktop"` (это поле в Telethon недоступно из конструктора). В §8 показано как при необходимости передать `lang_pack` через низкоуровневый `InitConnectionRequest` без сторонней библиотеки.

---

## 2. Анатомия одного аккаунта

Аккаунт = два файла с одинаковым базовым именем:

- `<phone>.session` — SQLite-база Telethon. Хранит `auth_key`, ID DC, адрес/порт DC и кеш сущностей. Это то, ради чего аккаунт и покупается: telethon просто подхватывает её и сразу авторизован, без SMS.
- `<phone>.json` — параметры клиента, под которым аккаунт регистрировался (Telegram Desktop). Без них fingerprint не совпадёт с реальной регистрацией.

Пример `.json`:

```json
{
  "app_id": 2040,
  "app_hash": "b18441a1ff607e10a989891a5462e627",
  "sdk": "Windows 11 x64",
  "device": "Lenovo IdeaPad 5",
  "app_version": "6.7.6 x64",
  "lang_pack": "tdesktop",
  "system_lang_pack": "en-gb",
  "phone": "447536674349",
  "id": 8760407095,
  "country": "GB",
  "ipv6": false,
  "spamblock": null,
  "...": "..."
}
```

`app_id` и `app_hash` у всех аккаунтов одинаковые (это публичные креды Telegram Desktop). Всё остальное уникально под конкретный аккаунт.

---

## 3. Маппинг полей JSON → параметры `TelegramClient`

Главная таблица — наизусть:

| Поле в `.json`      | Куда уходит в `TelegramClient(...)`                | Примечание                                            |
|---------------------|----------------------------------------------------|-------------------------------------------------------|
| `app_id`            | `api_id`                                           | int. Каст: `int(json_data['app_id'])`.                |
| `app_hash`          | `api_hash`                                         | str                                                   |
| `device`            | `device_model`                                     | str, отображается в Active Sessions                   |
| `sdk`               | `system_version`                                   | str                                                   |
| `app_version`       | `app_version`                                      | str                                                   |
| `system_lang_pack`  | **`system_lang_code`**                             | Имя в Telethon другое! `en-gb`/`en-US`/`en-CA`        |
| `system_lang_pack`  | **`lang_code`** (часть до `-`)                     | `en-gb` → `en`. Это код языка интерфейса.             |
| `lang_pack`         | **в конструктор НЕ идёт**                          | Чистый `telethon` его не принимает. См. §8.           |
| `ipv6`              | `use_ipv6`                                         | bool. У всех наших аккаунтов `false`.                 |

### Ловушки (часто всё ломают именно тут)

- **`system_lang_pack` ≠ `system_lang_pack`.** В json поле зовётся так, но в Telethon это `system_lang_code`. Если просто скопировать имя — параметр не подхватится.
- **`lang_pack` ≠ `lang_code`.** `lang_pack="tdesktop"` это **имя пакета переводов**, а не код языка. Подставлять `lang_pack` вместо `lang_code` нельзя — на сервер уйдёт мусор. `lang_code` должен быть `"en"` (берём из `system_lang_pack` до дефиса).
- **`device`, `sdk`** в json — в Telethon `device_model`, `system_version`. Имена разные.

---

## 4. Сниппет: разбор json + построение клиента

```python
import json
from pathlib import Path
from telethon import TelegramClient


def load_account_json(json_path: str) -> dict:
    return json.loads(Path(json_path).read_text(encoding="utf-8"))


def build_client(session_path: str, acc: dict, proxy=None) -> TelegramClient:
    """
    Создаёт TelegramClient с фингерпринтом устройства из json аккаунта.
    `session_path` — путь к .session (с расширением или без — Telethon поймёт).
    `acc` — распарсенный .json того же аккаунта.
    `proxy` — dict в формате python-socks (см. §5), либо None.
    """
    system_lang = acc.get("system_lang_pack") or "en-US"
    lang = system_lang.split("-")[0] or "en"

    return TelegramClient(
        session=session_path,
        api_id=int(acc["app_id"]),
        api_hash=acc["app_hash"],
        device_model=acc["device"],
        system_version=acc["sdk"],
        app_version=acc["app_version"],
        lang_code=lang,                 # "en"
        system_lang_code=system_lang,   # "en-gb" / "en-US" / "en-CA"
        proxy=proxy,
        use_ipv6=bool(acc.get("ipv6", False)),

        # Щадящие сетевые таймауты под ротирующий прокси
        timeout=20,
        connection_retries=3,
        retry_delay=2,
        auto_reconnect=True,
        request_retries=2,
        flood_sleep_threshold=60,       # короткие FLOOD_WAIT (<60s) telethon отработает сам
        receive_updates=False,          # не нужны апдейты для одноразовых задач — экономит трафик
    )
```

---

## 5. Сниппет: прокси

Telethon принимает прокси как dict в формате `python-socks`. Это основной формат, его и используем.

```python
def build_proxy(host: str, port: int, user: str | None, pwd: str | None,
                ptype: str = "socks5") -> dict:
    proxy = {
        "proxy_type": ptype,   # "socks5" или "http"
        "addr": host,
        "port": int(port),
        "rdns": True,          # DNS-резолв на стороне прокси
    }
    if user and pwd:
        proxy["username"] = user
        proxy["password"] = pwd
    return proxy
```

### Вариант А: один общий ротирующий SOCKS5 (исходящий IP меняет сам провайдер)

```python
ROTATING_PROXY = build_proxy(
    host="proxy.example.net",
    port=1080,
    user="login",
    pwd="password",
)

# Все аккаунты получают один и тот же объект — это нормально.
client = build_client(session_path, acc, proxy=ROTATING_PROXY)
```

MTProto держит **один persistent TCP** к прокси. Ротация IP происходит на исходящем плече провайдера, для нашего соединения это прозрачно — Telethon не реконнектится на каждый запрос.

### Вариант Б: пул прокси (несколько портов одного хоста — как в проде)

`proxies.json`:

```json
[
  {"ip": "proxy.example.net", "port": 10001, "username": "u", "password": "p", "type": "socks5"},
  {"ip": "proxy.example.net", "port": 10002, "username": "u", "password": "p", "type": "socks5"},
  {"ip": "proxy.example.net", "port": 10003, "username": "u", "password": "p", "type": "socks5"}
]
```

Раздача аккаунтам — простой round-robin или sticky по `phone`:

```python
def load_proxies(path: str) -> list[dict]:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    return [
        build_proxy(p["ip"], p["port"], p.get("username"), p.get("password"),
                    p.get("type", "socks5"))
        for p in raw
    ]


def proxy_for(account_phone: str, proxies: list[dict]) -> dict:
    # sticky: один аккаунт всегда получает один и тот же прокси
    return proxies[hash(account_phone) % len(proxies)]
```

Sticky-привязка предпочтительнее round-robin: меньше шанс, что один и тот же `.session` будет светить разные исходящие IP подряд.

---

## 6. Подключение, проверка авторизации, проверка на freeze

`is_user_authorized()` возвращает `True` даже для замороженных аккаунтов. Чтобы отличить «живой» от «frozen», после авторизации делаем дешёвый запрос `get_dialogs(limit=1)` — у frozen он падает с `FROZEN_*`.

```python
from telethon.errors import (
    FloodWaitError,
    SessionPasswordNeededError,
    AuthKeyDuplicatedError,
    AuthKeyUnregisteredError,
    UserDeactivatedBanError,
    PhoneNumberBannedError,
)


async def connect_and_validate(session_path: str, acc: dict, proxy: dict | None):
    """
    Возвращает (status, client_or_none, reason).
    status: "ok" | "dead" | "frozen" | "flood" | "net_error"
    """
    client = build_client(session_path, acc, proxy=proxy)
    try:
        await client.connect()

        if not await client.is_user_authorized():
            await client.disconnect()
            return ("dead", None, "not authorized")

        # Дешёвая проверка на freeze: get_dialogs(limit=1)
        try:
            await client.get_dialogs(limit=1)
        except Exception as e:
            msg = str(e).upper()
            if "FROZEN" in msg or "ACCOUNT_FROZEN" in msg or "FROZEN_ACCOUNT" in msg:
                await client.disconnect()
                return ("frozen", None, "account frozen")
            # Другая ошибка — пробрасываем

        return ("ok", client, "")

    except (UserDeactivatedBanError, PhoneNumberBannedError, AuthKeyUnregisteredError):
        await client.disconnect()
        return ("dead", None, "banned / deactivated / auth key unregistered")

    except AuthKeyDuplicatedError:
        # Сессия параллельно использовалась с другого процесса/машины.
        # Telethon после этого инвалидирует ключ — аккаунт восстановить нельзя.
        await client.disconnect()
        return ("dead", None, "auth key duplicated")

    except FloodWaitError as e:
        await client.disconnect()
        return ("flood", None, f"flood wait {e.seconds}s")

    except Exception as e:
        await client.disconnect()
        return ("net_error", None, str(e)[:200])
```

> `SessionPasswordNeededError` для готовой авторизованной сессии возникать не должен (2FA уже пройден на стороне регистрации). Если поймали — что-то не так с сессией; помечаем как `dead`.

Использование:

```python
import asyncio

async def main():
    acc = load_account_json("GB/447536674349.json")
    proxy = build_proxy("proxy.example.net", 1080, "user", "pass")

    status, client, reason = await connect_and_validate(
        session_path="GB/447536674349.session",
        acc=acc,
        proxy=proxy,
    )
    if status != "ok":
        print(f"skip: {status} ({reason})")
        return

    try:
        me = await client.get_me()
        print(me.first_name, me.phone, me.id)
        # ... полезная работа ...
    finally:
        await client.disconnect()


asyncio.run(main())
```

---

## 7. Обработка типичных ошибок

| Исключение                          | Что значит                                                   | Действие                                                        |
|-------------------------------------|--------------------------------------------------------------|-----------------------------------------------------------------|
| `FloodWaitError(seconds=N)`         | Telegram просит подождать N секунд                           | `await asyncio.sleep(e.seconds + 1)`. Если N большой (часы) — на сегодня аккаунт оставить в покое. |
| `AuthKeyDuplicatedError`            | Сессию использовали параллельно — `auth_key` инвалидирован   | Аккаунт мёртв безвозвратно. Сохранить лог.                      |
| `AuthKeyUnregisteredError`          | Ключ больше не зарегистрирован на сервере                    | Аккаунт мёртв.                                                  |
| `UserDeactivatedBanError`           | Аккаунт забанен / деактивирован Telegram                     | Аккаунт мёртв.                                                  |
| `PhoneNumberBannedError`            | Номер забанен                                                | Аккаунт мёртв.                                                  |
| `"authorization key ... two different IP"` (через generic `Exception`) | Сессия параллельно тронута с другого IP, но ключ ещё жив | Не фатально. `disconnect()`, подождать минуту, повторить. |
| `"no such column"` / `"version"` / `"too many values to unpack"` при `connect()` | Проблема со схемой SQLite сессии | Исправить схему (§9), повторить `connect`.    |
| `FROZEN_*` в любом запросе          | Аккаунт «заморожен» (доступ есть, но действовать нельзя)     | Помечаем как `spamblock/frozen`, не используем.                 |
| `ConnectionError` / `TimeoutError`  | Прокси упал / сеть                                           | Бэкофф 2s → 4s → 8s, максимум 3 ретрая, потом отложить.        |

Импорты: всё из `telethon.errors`. У `FloodWaitError` в v1 — `e.seconds`.

---

## 8. Опционально: передача `lang_pack="tdesktop"` через `InitConnectionRequest`

Чистый `TelegramClient(...)` не принимает `lang_pack`. Если хочется, чтобы fingerprint был **полностью** идентичен Telegram Desktop (включая `lang_pack`), можно подменить вызов `initConnection` на низком уровне сразу после `connect()`:

```python
from telethon.tl import functions
from telethon.tl.functions.help import GetConfigRequest


async def reinit_with_lang_pack(client: TelegramClient, acc: dict):
    """
    Перевыполняет initConnection с заполненным lang_pack.
    Вызывать сразу после client.connect(), до любых других запросов.
    """
    await client(
        functions.InvokeWithLayerRequest(
            layer=functions.LAYER,
            query=functions.InitConnectionRequest(
                api_id=int(acc["app_id"]),
                device_model=acc["device"],
                system_version=acc["sdk"],
                app_version=acc["app_version"],
                system_lang_code=acc.get("system_lang_pack") or "en",
                lang_pack=acc.get("lang_pack") or "tdesktop",
                lang_code=(acc.get("system_lang_pack") or "en").split("-")[0],
                query=GetConfigRequest(),
            ),
        )
    )
```

Когда это **не нужно**:
- Если ты и так не отправляешь массовых сообщений и аккаунты используются мягко — Telegram редко цепляется к пустому `lang_pack`.
- Если боишься внести регрессии — пропусти. Этот блок опциональный.

Когда **стоит** использовать:
- Если у поставщика аккаунтов «жирная» проверка fingerprint и наблюдаются ранние спамблоки сразу после первого логина из нашего кода.

---

## 9. Опционально: фикс схемы SQLite (на случай старых сессий)

У свежих сессий от твоего поставщика схема правильная: 5 таблиц (`version, entities, sent_files, update_state, sessions`), в `sessions` ровно 5 столбцов (`dc_id, server_address, port, auth_key, takeout_id`), `version=7`. Так что **обычно фикс не нужен**.

Но если попадётся старая партия и `client.connect()` упадёт с `no such column: version` или `too many values to unpack (expected 5)` — вот фикс:

```python
import sqlite3
from pathlib import Path


def fix_session_schema(session_path: str) -> bool:
    """Чинит схему SQLite-сессии под Telethon v1. Вызывать ДО создания клиента."""
    db = session_path if session_path.endswith(".session") else session_path + ".session"
    if not Path(db).exists():
        return False

    conn = sqlite3.connect(db)
    cur = conn.cursor()
    try:
        # 1) Добавить колонку version там где её нет
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cur.fetchall()]
        for t in tables:
            cur.execute(f"PRAGMA table_info({t})")
            cols = [c[1] for c in cur.fetchall()]
            if "version" not in cols:
                try:
                    cur.execute(f"ALTER TABLE {t} ADD COLUMN version INTEGER DEFAULT 0")
                except sqlite3.OperationalError:
                    pass

        # 2) Если в таблице sessions больше 5 столбцов — пересоздать с нужными 5
        cur.execute("PRAGMA table_info(sessions)")
        scols = [c[1] for c in cur.fetchall()]
        expected = {"dc_id", "server_address", "port", "auth_key", "takeout_id"}
        if expected.issubset(set(scols)) and len(scols) > 5:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS _sessions_fix (
                    dc_id INTEGER PRIMARY KEY,
                    server_address TEXT,
                    port INTEGER,
                    auth_key BLOB,
                    takeout_id INTEGER
                )
            """)
            cur.execute("""
                INSERT OR REPLACE INTO _sessions_fix (dc_id, server_address, port, auth_key, takeout_id)
                SELECT dc_id, server_address, port, auth_key, takeout_id FROM sessions
            """)
            cur.execute("DROP TABLE sessions")
            cur.execute("ALTER TABLE _sessions_fix RENAME TO sessions")

        conn.commit()
        return True
    finally:
        conn.close()
```

Использование: `fix_session_schema(session_path)` перед `build_client(...)`. Идемпотентно — можно вызывать всегда «на всякий случай».

---

## 10. Два правила, которые нельзя нарушать

### 10.1. Никаких параллельных коннектов с одним `.session`

Один `.session` = один процесс = один TCP к Telegram. Если открыть его параллельно с двух процессов/машин:
- В лучшем случае поймаешь `"authorization key from two different IP addresses simultaneously"` (не фатально, перенастроить очередь — починится).
- В худшем — `AuthKeyDuplicatedError`, после которого ключ инвалидируется и **аккаунт восстановить нельзя**.

Что делаем:
- В коде — мьютекс/очередь на `session_path` (например, `asyncio.Lock` на каждый файл).
- При оркестрации нескольких машин — глобальная блокировка (Redis/файловый лок).
- Не копировать `.session` в несколько мест и не запускать «параллельно для надёжности».

### 10.2. Фиксированный fingerprint

`device_model`, `system_version`, `app_version`, `system_lang_code`, `lang_code` (и `lang_pack`, если используется §8) — те самые что в `.json`, **навсегда**. Никаких «обновим до новой версии Telegram Desktop», никаких «давайте поменяем device на покрасивее». Telegram сравнивает с тем, что было при регистрации; даже одиночное изменение `app_version` уже выглядит как смена клиента и снижает trust score.

Практика:
- Параметры устройства берутся **только** из `.json` аккаунта, не из общего конфига.
- Любые дефолты (вида «если поля нет — подставим...») — это red flag. Лучше упасть с понятной ошибкой, чем подставить чужой fingerprint.

---

## 11. Чек-лист перед запуском кода с аккаунтом

- [ ] `.session` и `.json` — пара (одно базовое имя).
- [ ] Все 7 полей из `.json` подставлены в `TelegramClient`: `app_id`, `app_hash`, `device`, `sdk`, `app_version`, `system_lang_pack` → `system_lang_code`, и `lang_code` = `system_lang_pack.split('-')[0]`.
- [ ] `lang_pack` **не** передан в конструктор (или передан через §8, но не как `lang_code`).
- [ ] Прокси SOCKS5 настроен через python-socks dict, `rdns=True`.
- [ ] Для одного `.session` — только один активный коннект в системе.
- [ ] `client.disconnect()` гарантированно вызывается (try/finally или `async with client:`).
- [ ] После `connect` + `is_user_authorized` сделан `get_dialogs(limit=1)` для проверки на freeze.
- [ ] Реализована обработка `FloodWaitError` (sleep ровно по `e.seconds`), `AuthKey*` ошибок (помечаем dead), `FROZEN_*` (помечаем frozen).

---

## 12. Ссылки для перепроверки

- Telethon — `TelegramClient` сигнатура и параметры: <https://docs.telethon.dev/en/stable/modules/client.html>
- Telethon — что такое `.session` файлы: <https://docs.telethon.dev/en/stable/concepts/sessions.html>
- Telethon — обработка RPC-ошибок и `FloodWaitError`: <https://docs.telethon.dev/en/stable/concepts/errors.html>
- Telegram Core — спецификация `initConnection` (правда по полям `device_model`/`system_version`/`lang_pack`/`system_lang_code`): <https://core.telegram.org/method/initConnection>
- python-socks — формат прокси-словаря для Telethon: <https://pypi.org/project/python-socks/>

Если поведение Telethon разойдётся с этим документом — верить коду библиотеки, а не документу.
