# Nore — Project Map

Техническая карта проекта. Описывает архитектуру, модули, контракты IPC, потоки данных и структуру кода. Документ описывает **целевое состояние системы**, а не прогресс разработки.

---

## 1. Архитектура верхнего уровня

Nore — desktop приложение на Electron. Все пользовательские данные обрабатываются локально, наружу уходят только текстовые фрагменты для embeddings и LLM запросов.

```
┌─────────────────────────────────────────────────────────────┐
│                    Устройство пользователя                  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    Electron app                      │   │
│  │                                                      │   │
│  │  ┌────────────────┐         ┌────────────────────┐   │   │
│  │  │  Renderer      │  IPC    │   Main (Node.js)   │   │   │
│  │  │  React + TS    │ ◄─────► │                    │   │   │
│  │  │  (Chromium)    │ Preload │   Vault reader     │   │   │
│  │  │                │         │   Indexer          │   │   │
│  │  │  - UI          │         │   RAG pipeline     │   │   │
│  │  │  - State       │         │   LLM client       │   │   │
│  │  │  - Routing     │         │   License client   │   │   │
│  │  └────────────────┘         └─────────┬──────────┘   │   │
│  │                                       │              │   │
│  └───────────────────────────────────────┼──────────────┘   │
│                                          │                  │
│  ┌──────────────────┐         ┌──────────▼──────────┐       │
│  │ Obsidian vault   │ ◄───────│   LanceDB           │       │
│  │ (user folder)    │  read   │   (userData/lancedb)│       │
│  └──────────────────┘         └─────────────────────┘       │
│                                                             │
│                                  ┌─────────────────────┐    │
│                                  │ Local conversation  │    │
│                                  │ store (SQLite/JSON) │    │
│                                  └─────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                                          │
                                          │ HTTPS
                ┌─────────────────────────┼─────────────────────────┐
                ▼                         ▼                         ▼
        ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
        │  Embeddings  │         │     LLM      │         │   License    │
        │  (Mistral /  │         │  (OpenAI /   │         │   server     │
        │   Voyage)    │         │  Anthropic)  │         │   (own)      │
        └──────────────┘         └──────────────┘         └──────────────┘

                                  ┌──────────────┐
                                  │  Perplexity  │  (Pro: web search)
                                  │   Sonar API  │
                                  └──────────────┘
```

**Ключевые принципы:**
- Файлы vault никогда не покидают устройство целиком — только чанки текста как контекст для запросов
- Renderer не имеет прямого доступа к файловой системе — всё через IPC
- LanceDB — embedded, не требует отдельного сервера
- License server валидирует подписку при запуске и периодически — без него Pro фичи не активируются

---

## 2. Стек технологий

| Слой | Технология | Версия / Заметки |
|---|---|---|
| Desktop runtime | Electron | через `electron-vite` шаблон |
| UI framework | React + TypeScript | React 19 |
| Стили | Tailwind CSS v4 | `@tailwindcss/postcss`, `@import 'tailwindcss'` синтаксис |
| UI primitives | Radix UI | минимальные shadcn-style обёртки (tooltip, dropdown-menu) |
| Иконки | lucide-react | |
| Vector DB | LanceDB | embedded, в `app.getPath('userData')/lancedb` |
| Embeddings | Mistral AI (`mistral-embed`) | 1024 dims (планировалось Voyage AI, заменено на Mistral) |
| LLM | OpenAI / Anthropic | конфигурируется в Settings |
| Web search (Pro) | Perplexity Sonar API | |
| Settings storage | electron-store | **строго v8.2.0** — v9.x ломает CJS импорт |
| Secrets storage | Electron `safeStorage` | fallback на base64 в dev |
| Conversation store | SQLite (better-sqlite3) | в `userData/conversations.db` |
| Build / packaging | Electron Builder | `.exe` (Windows), `.dmg` (macOS) |
| Payments | Stripe | для Pro подписки |

---

## 3. Структура проекта

```
nore/
├── build/                          # иконки, entitlements для билда
├── resources/                      # ассеты приложения
├── src/
│   ├── main/                       # Electron main process (Node.js)
│   │   ├── index.ts                # Entry: создание окна, регистрация IPC handlers
│   │   ├── vault.ts                # Выбор папки, чтение .md файлов, electron-store
│   │   ├── db.ts                   # LanceDB connection, schema таблицы notes
│   │   ├── embeddings.ts           # Generation embeddings (single + batch)
│   │   ├── indexer.ts              # Indexing pipeline, инкрементальная индексация, search
│   │   ├── llm.ts                  # Унифицированный клиент LLM (OpenAI / Anthropic), стриминг
│   │   ├── prompts.ts              # System prompts (chat, write analysis)
│   │   ├── conversations.ts        # CRUD диалогов, локальное хранение
│   │   ├── web-search.ts           # Perplexity Sonar (Pro)
│   │   ├── license.ts              # Валидация подписки, кэш статуса
│   │   ├── settings.ts             # Wrapper над electron-store + safeStorage для ключей
│   │   └── ipc/
│   │       ├── vault.ipc.ts        # vault:* handlers
│   │       ├── indexing.ipc.ts     # indexing:* handlers
│   │       ├── search.ipc.ts       # search:* handlers
│   │       ├── chat.ipc.ts         # chat:* handlers + streaming events
│   │       ├── write.ipc.ts        # write:analyze handler
│   │       └── license.ipc.ts      # license:* handlers
│   │
│   ├── preload/
│   │   ├── index.ts                # contextBridge: экспорт API в window
│   │   └── index.d.ts              # Типы для window.vault, window.search и т.д.
│   │
│   ├── renderer/
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx            # React entry
│   │       ├── App.tsx             # Root, монтирует NoreApp
│   │       ├── assets/
│   │       │   └── main.css        # Tailwind imports + Nore design tokens
│   │       ├── components/
│   │       │   ├── nore/
│   │       │   │   ├── nore-app.tsx        # App shell: top bar, навигация, accent, font size
│   │       │   │   ├── search-modal.tsx    # Cmd/Ctrl+K command palette
│   │       │   │   └── screens/
│   │       │   │       ├── chat-screen.tsx
│   │       │   │       ├── write-screen.tsx
│   │       │   │       └── settings-screen.tsx
│   │       │   └── ui/
│   │       │       ├── tooltip.tsx
│   │       │       └── dropdown-menu.tsx
│   │       ├── hooks/
│   │       │   ├── use-vault-status.ts     # Подписка на indexing progress
│   │       │   ├── use-chat.ts             # Управление диалогом + стримингом
│   │       │   ├── use-write-analysis.ts   # Debounced поиск + LLM анализ
│   │       │   └── use-license.ts          # Локальный статус подписки
│   │       ├── stores/
│   │       │   └── app-store.ts            # Глобальный state (Zustand или Context)
│   │       └── lib/
│   │           └── utils.ts                # cn() helper (clsx + tailwind-merge)
│   │
│   └── types/
│       ├── index.d.ts              # Window декларации для IPC API
│       ├── vault.ts                # VaultFile, VaultStore
│       ├── indexer.ts              # NoteRecord, IndexingProgress
│       ├── chat.ts                 # Message, Conversation, Source
│       ├── write.ts                # WriteAnalysis, Connection, Gap
│       └── license.ts              # LicenseStatus, Plan
│
├── electron.vite.config.ts         # Vite config + alias @renderer/*
├── electron-builder.yml            # Конфигурация инсталляторов
├── tailwind.config.js              # Nore color tokens
├── postcss.config.js               # @tailwindcss/postcss
├── tsconfig.json
├── tsconfig.node.json              # main + preload
├── tsconfig.web.json               # renderer, alias @renderer/* → src/renderer/src/*
└── .env                            # API ключи (не коммитится)
```

---

## 4. Контракты IPC

API экспонируются в renderer через `contextBridge` в `preload/index.ts` и доступны как `window.<namespace>.<method>`.

### `window.vault`
```typescript
selectFolder(): Promise<string | null>
getSavedPath(): Promise<string | null>
loadFiles(vaultPath: string): Promise<VaultFile[]>
openInObsidian(notePath: string): Promise<void>     // obsidian:// URI scheme
```

### `window.indexing`
```typescript
start(vaultPath: string, files: VaultFile[]): Promise<void>
getProgress(): Promise<IndexingProgress>
onProgress(callback: (p: IndexingProgress) => void): () => void  // unsubscribe
cancel(): Promise<void>
```

### `window.search`
```typescript
query(text: string, limit?: number): Promise<NoteRecord[]>
```

### `window.chat`
```typescript
listConversations(): Promise<Conversation[]>
loadConversation(id: string): Promise<Message[]>
createConversation(): Promise<string>                // returns id
deleteConversation(id: string): Promise<void>
sendMessage(conversationId: string, text: string): Promise<void>
onChunk(callback: (chunk: ChatChunk) => void): () => void
onComplete(callback: (msg: Message) => void): () => void
```

### `window.write`
```typescript
analyze(draft: string): Promise<WriteAnalysis>      // Pro: дебаунсится в renderer
relatedOnly(draft: string): Promise<NoteRecord[]>   // Free: только vector search
```

### `window.settings`
```typescript
get<T>(key: string): Promise<T | null>
set<T>(key: string, value: T): Promise<void>
setSecret(key: string, value: string): Promise<void>   // через safeStorage
getSecret(key: string): Promise<string | null>
```

### `window.license`
```typescript
getStatus(): Promise<LicenseStatus>
activate(email: string, key: string): Promise<LicenseStatus>
deactivate(): Promise<void>
onStatusChange(callback: (s: LicenseStatus) => void): () => void
```

---

## 5. Доменные типы

```typescript
// vault.ts
type VaultFile = {
  absolutePath: string
  relativePath: string
  title: string
  createdAt: number       // unix ms
  modifiedAt: number
  size: number
}

// indexer.ts
type NoteRecord = {
  id: string              // hash от relativePath
  relativePath: string
  title: string
  excerpt: string         // первые ~200 символов
  vector: number[]        // 1024 dims
  createdAt: number
  modifiedAt: number
  indexedAt: number
}

type IndexingProgress = {
  status: 'idle' | 'indexing' | 'up-to-date' | 'error'
  total: number
  processed: number
  errorMessage?: string
  lastIndexedAt?: number
}

// chat.ts
type Source = {
  noteId: string
  relativePath: string
  title: string
  excerpt: string
  similarity: number      // 0..1
}

type Message = {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  createdAt: number
  tokens?: { input: number; output: number }
}

type Conversation = {
  id: string
  title: string           // авто-генерится из первого сообщения
  createdAt: number
  updatedAt: number
  messageCount: number
}

type ChatChunk =
  | { type: 'sources'; conversationId: string; sources: Source[] }
  | { type: 'token'; conversationId: string; delta: string }
  | { type: 'done'; conversationId: string; messageId: string }
  | { type: 'error'; conversationId: string; error: string }

// write.ts
type Connection = { text: string; relatedNoteId?: string }
type Gap = { topic: string; suggestion: string }
type WriteAnalysis = {
  related: NoteRecord[]
  connections: Connection[]
  gaps: Gap[]
}

// license.ts
type Plan = 'free' | 'pro'
type LicenseStatus = {
  plan: Plan
  email?: string
  validUntil?: number
  queriesUsedThisMonth: number
  queriesLimit: number    // Infinity для Pro
  lastValidatedAt: number
}
```

---

## 6. Потоки данных

### 6.1 Индексация vault

```
User → Settings: Re-index
  → window.indexing.start(vaultPath, files)
  → main/indexer.ts:
      1. Получить список существующих NoteRecord из LanceDB
      2. Diff по modifiedAt: что новое / изменённое / удалённое
      3. Для удалённых — table.delete(id)
      4. Для новых/изменённых:
         a. Прочитать файл, удалить frontmatter, strip markdown
         b. Prepend title к контенту
         c. Батч по 20 → embeddings.ts → Mistral API
         d. table.add([NoteRecord, ...])
      5. На каждом шаге → emit IPC 'indexing:progress'
  → Renderer подписан через window.indexing.onProgress()
  → Top bar обновляет индикатор и счётчик
```

**Производительность:**
- Запуск в фоновом процессе с пониженным приоритетом
- Первая индексация — когда ПК простаивает (idle detection)
- Инкрементальная — только diff

### 6.2 Chat — режим "Спроси"

```
User вводит вопрос → Enter
  → window.chat.sendMessage(conversationId, text)
  → main/chat.ipc.ts:
      1. Эмитнуть user-message в conversation store (SQLite)
      2. window.search.query(text, limit=5) → NoteRecord[]
      3. Эмит ChatChunk { type: 'sources', sources }
      4. Сборка промпта:
         - System: prompts.ts → buildSystemPrompt(contextNotes)
         - History: последние N сообщений из conversation
         - User: текущее сообщение
      5. main/llm.ts → стриминг от провайдера
      6. На каждый токен → emit ChatChunk { type: 'token', delta }
      7. По завершении: сохранить assistant-message в SQLite
      8. emit ChatChunk { type: 'done', messageId }
      9. Increment queriesUsedThisMonth (для Free лимитов)
  → Renderer:
      - Показывает sources в collapsed-секции
      - Стримит ответ token-by-token
      - По 'done' финализирует сообщение
```

**Системный промпт (универсальный, краткий):**
```
You are Nore, an intelligent assistant for personal knowledge management.
You help user explore and understand their notes.

IMPORTANT: Always respond in the same language the user wrote their message in.

[если есть контекст:]
Here are the most relevant notes from the user's vault:
<notes>

Use these notes to inform your answer. Be concise and insightful.
Reference specific notes when relevant.

[если контекста нет:]
No relevant notes were found in the vault for this query.
```

### 6.3 Write — режим "Пиши" (Pro)

```
User печатает в редакторе
  → debounce 1500ms
  → Free: window.write.relatedOnly(draft)
       → vector search → Related Notes панель
  → Pro: window.write.analyze(draft)
       → vector search → related notes
       → main/llm.ts вызывает с buildWriteAnalysisPrompt
       → LLM возвращает JSON: { connections: [], gaps: [] }
       → парсинг + валидация
       → возврат { related, connections, gaps }
  → Renderer обновляет Connections panel
```

**Промпт write-analysis (структурированный JSON output, max 3 connections + 3 gaps):**
```
Analyze the user's draft and their related notes.
Return ONLY valid JSON:
{ "connections": [...], "gaps": [...] }
```

### 6.4 Web search в контексте (Pro)

```
User задаёт вопрос с пометкой "поищи в интернете" или включает toggle
  → window.search.query() для контекста vault
  → main/web-search.ts → Perplexity Sonar API
  → Промпт LLM: "Пользователь писал о X в своих заметках, вот свежая информация по теме"
  → Стриминг ответа со ссылками на оба источника (vault notes + web)
```

### 6.5 License validation

```
App start → main/license.ts:
  1. Прочитать кэш статуса из electron-store
  2. Если кэш свежий (< 24h) → использовать его
  3. Иначе → POST на license server: { email, machineId }
  4. Сервер возвращает { plan, validUntil }
  5. Сохранить в кэш
  6. Если Pro истёк / не валиден → понизить до Free
  7. emit license:statusChange

Каждый Pro-вызов (write.analyze, web-search) проверяет cached plan === 'pro'
```

---

## 7. Архитектура Open-core

### Открытое ядро (MIT)
- `src/main/vault.ts`, `db.ts`, `embeddings.ts`, `indexer.ts`
- `src/main/llm.ts`, `prompts.ts` (только Chat)
- `src/main/conversations.ts`
- Весь `src/preload/`, `src/renderer/` (UI)
- IPC handlers для vault, indexing, search, chat (basic), settings

### Закрытый Pro слой (проприетарный)
Живёт в отдельной папке `src/main/pro/` или отдельном приватном пакете, подключаемом при сборке Pro билда:
- `pro/write-analysis.ts` — LLM анализ для Write mode
- `pro/web-search.ts` — Perplexity Sonar
- `pro/timeline.ts` — построение визуализации эволюции мышления
- `pro/license.ts` — клиент к лицензионному серверу
- `pro/billing.ts` — Stripe webhook handler (на стороне сервера)

**Защита:** Pro-функции импортируются динамически и не активируются без валидного `LicenseStatus.plan === 'pro'`. Локальная логика проверки + серверная валидация при каждом запуске.

---

## 8. UI: экраны и их состояния

### Top bar (постоянный)
- Лого + название слева
- Tabs `Chat | Write` по центру с анимированным accent underline
- Справа: search button (Cmd/K), settings button, vault status (имя vault, count, цветовой dot: 🟢 up-to-date / 🟡 indexing / 🔴 error)

### Screen: Chat
**Layout:** левая панель истории (260px) + центральная область + input снизу.

**Левая панель:**
- Кнопка `+ New Chat` сверху
- Группировка: Today / Yesterday / Previous 7 Days / Older
- Counter диалогов внизу

**Центральная область (max-width 720px):**
- Все сообщения left-aligned
- User: серый фон `#1A1A1E` + аватар + timestamp
- Assistant: прозрачный фон + Nore лого + timestamp
- Под assistant — collapsible `Sources` (chain-link icon + "N sources"), при раскрытии — список заметок с title, path в monospace, 1-line excerpt
- Streaming: курсор-каретка во время генерации

**Input (внизу):**
- Текст-индикатор `Searching across N notes`
- Textarea, Enter = send, Shift+Enter = newline
- Send button (arrow-up в круге), accent при наличии текста

**Empty state:** центрированные prompt suggestions chips ("What have I written about X?", "Find connections between...", "Summarize last month").

### Screen: Write
**Layout:** split view, draggable divider, дефолт 60/40.

**Editor (left):**
- Toolbar: editable filename + кнопки Bold/Italic/H/Link/Code
- Monospace (JetBrains Mono), line numbers (toggleable), markdown подсветка

**Connections panel (right):**
- Header `Connections` + refresh icon
- Section `Related Notes` — title + % match + 1-line excerpt, клик → slide-over preview
- Section `Gaps Detected` (Pro) — yellow dot + текст + кнопка `Create note`
- Loading: shimmer
- Empty: `Start writing to see connections...`

### Screen: Settings
Секции с разделителями, без карточек:

| Секция | Контролы |
|---|---|
| Vault | Path display, `Change folder`, `Re-index` |
| Indexing | Progress / "Up to date", count, last indexed |
| AI Model | Provider select (OpenAI / Anthropic), model select |
| API Keys | Masked input, edit, save (через safeStorage) |
| Appearance | Accent (6 пресетов + custom picker), font size (Compact 13 / Default 14 / Comfortable 16) |
| Keyboard Shortcuts | Список + переназначаемые |
| Account | Email, plan (Free/Pro), `Manage subscription`, `Sign out` |
| About | Version, GitHub link, лицензия |

### Command Palette (Cmd/Ctrl+K)
Модалка поверх любого экрана. Семантический поиск по vault. Keyboard navigation, Esc, hints внизу.

---

## 9. Хранение данных

| Что | Где | Формат |
|---|---|---|
| Vault path | electron-store | JSON в `userData/config.json` |
| User settings (theme, shortcuts) | electron-store | JSON |
| API keys | safeStorage + electron-store | encrypted blob |
| Vector index | LanceDB | `userData/lancedb/` |
| Conversations | SQLite (better-sqlite3) | `userData/conversations.db` |
| License cache | electron-store | JSON |
| App logs | electron-log | `userData/logs/` |

---

## 10. Внешние зависимости и стоимость

| Сервис | Назначение | Биллинг |
|---|---|---|
| Mistral AI | Embeddings (`mistral-embed`) | per token, дешёвый |
| OpenAI / Anthropic | LLM генерация | per token, основная статья расходов |
| Perplexity Sonar | Web search (Pro) | per request |
| Stripe | Платежи | % от транзакции |
| License server (own) | Валидация подписки | хостинг (~$5–10/мес) |

**Контроль расходов:**
- Кэширование частых запросов (одинаковый text → одинаковый embedding)
- Лимит контекста (top-5 заметок, не больше)
- gpt-4o-mini / Claude Haiku по умолчанию
- Мониторинг через простой dashboard на сервере

---

## 11. Безопасность

- API ключи только через `safeStorage` (Electron's encryption API), fallback на base64 в dev
- IPC: только сериализуемые plain objects, никаких Buffer/Class
- Renderer не имеет `nodeIntegration`, доступ к Node только через `contextBridge`
- `dev-app-update.yml` в `.gitignore` (содержит локальные пути)
- License server использует HMAC для валидации запросов с machineId
- Логи не содержат содержимого заметок и API ключей

---

## 12. Сборка и дистрибуция

```bash
npm run dev          # Electron + Vite HMR
npm run build        # TypeCheck + Vite build
npm run build:win    # Windows installer (.exe, NSIS)
npm run build:mac    # macOS installer (.dmg, signed + notarized)
npm run rebuild      # Rebuild native modules (LanceDB, better-sqlite3)
```

**Code signing:**
- Windows: certificate через Sectigo / DigiCert или EV cert
- macOS: Apple Developer ID + notarization через `notarytool`

**Auto-update:** через `electron-updater` + GitHub Releases (или собственный update server).

---

## 13. Ключевые ограничения и подводные камни

| Что | Почему важно |
|---|---|
| `electron-store` строго v8.2.0 | v9.x ESM/CJS конфликт ломает приложение |
| Tailwind v4 → `@tailwindcss/postcss` | старые `@tailwind base` директивы не работают |
| LanceDB native binaries | нужен `@electron/rebuild` после установки |
| Vector dim = 1024 | привязано к `mistral-embed`, при смене модели — re-index |
| IPC только plain objects | классы и Buffer не сериализуются через contextBridge |
| Import alias `@renderer/*` | прописан в `electron.vite.config.ts` и `tsconfig.web.json` |
| Никаких `"use client"` | это Electron+Vite, не Next.js |
| LLM language matching | system prompt обязан содержать правило отвечать на языке пользователя |

---

## 14. Переменные окружения

```
# Embeddings (всегда)
MISTRAL_API_KEY=

# LLM (выбор провайдера в Settings)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Pro features
PERPLEXITY_API_KEY=

# License server (только в Pro билде)
LICENSE_SERVER_URL=
LICENSE_SERVER_PUBLIC_KEY=

# Stripe (только на сервере)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## 15. Roadmap по версиям

| Версия | Состав |
|---|---|
| **v0.1** | Vault connection, indexing, Chat (Free) |
| **v0.2** | Command Palette, conversation history, Settings полные |
| **v0.3** | Account system, license server, Stripe, Free лимиты |
| **v1.0** | Write mode (Pro), web search (Pro) — публичный launch |
| **v1.1** | Timeline (Pro) — визуализация эволюции мышления |
| **v1.2+** | Notion integration, локальные модели через Ollama, mobile companion |

---

_Документ описывает архитектуру и контракты. Для деталей реализации см. README модулей в соответствующих папках `src/main/*/`._