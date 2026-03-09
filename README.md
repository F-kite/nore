<div align="center">

# Nore ✦
### Your second brain, finally thinking back.

<!-- ![App Demo](./assets/demo.gif) -->
<!-- Замени на реальный GIF после Фазы 3 -->

<!-- [![Download](https://img.shields.io/badge/Download-v0.1.0-blue?style=for-the-badge)](https://github.com/F-kite/nore/releases)
[![License](https://img.shields.io/badge/Core-MIT-green?style=for-the-badge)](./LICENSE)
[![License Pro](https://img.shields.io/badge/Pro-Proprietary-red?style=for-the-badge)](./LICENSE-PRO)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey?style=for-the-badge)](https://github.com/F-kite/nore/releases) -->

</div>

---

## The Problem

Your Obsidian vault grows every day. But the older it gets, the harder it becomes to use it.

You forget what you wrote six months ago. You miss connections between ideas. You open the vault to find something and end up lost. Your knowledge is in there — but it's not working *for* you.

---

## What Nore Does

Nore is a desktop AI thinking partner that sits on top of your Obsidian vault — proactively surfaces connections your vault already contains, and helps you think, not just retrieve.

- **Ask** — Chat with your entire vault. Get answers that connect notes across time and show how your thinking has evolved, not just keyword matches.
- **Write** — Open any note and Nore's sidebar surfaces related ideas, forgotten connections, and gaps in your thinking in real time. *(Pro)*
- **Search the web in context** — Nore searches the web and filters results through what you already know. *(Pro)*

**Your data stays on your device.** Nore reads your local vault files directly. Nothing is uploaded to any server. Ever.

---

## Demo
Coming soon
<!-- ![Ask Mode Demo](./assets/demo-ask.gif) -->
<!-- Замени на реальное демо режима "Спроси" -->

<!-- ![Write Mode Demo](./assets/demo-write.gif) -->
<!-- Замени на реальное демо режима "Пиши" -->

---

## Why Not Just Use a Plugin?

Plugins are reactive — you ask, they answer. Nore is proactive — it notices things you missed, surfaces ideas at the right moment, and helps you think, not just retrieve.

| | Obsidian Copilot | NotebookLM | **Nore** |
|---|---|---|---|
| Works with your existing vault | ✅ | ❌ | ✅ |
| Data stays local | ✅ | ❌ | ✅ |
| Open-source core | ❌ | ❌ | ✅ |
| Proactive suggestions | ❌ | ❌ | ✅ |
| Tracks evolution of your thinking | ❌ | ❌ | ✅ |
| No setup required | ❌ | ✅ | ✅ |

---

## Getting Started

### Download

Go to the [Releases](https://github.com/F-kite/nore/releases) page and download the installer for your platform:
- **Windows:** `Nore-Setup-x.x.x.exe`
- **macOS:** `Nore-x.x.x.dmg`

### Requirements

- Windows 10+ or macOS 11+
- An existing Obsidian vault
- Internet connection (for AI features)

### First Launch

1. Open Nore
2. Click **Connect Vault** and select your Obsidian vault folder
3. Wait for the initial indexing to complete (runs in the background)
4. Start asking questions about your notes

---

## Pricing

Nore follows an **open-core model** — the core is free and open-source forever. Pro features are paid.

| | Free | Pro |
|---|---|---|
| Connect vault & indexing | ✅ | ✅ |
| Ask mode | 50 queries/month | Unlimited |
| Write mode (proactive sidebar) | ❌ | ✅ |
| Web search in context | ❌ | ✅ |
| Timeline — evolution of thinking | ❌ | ✅ |
| Price | $0 | $10/month |

[→ Download free](https://usenore.com) · [→ Get Pro](https://usenore.com#pro)

---

## Roadmap

### v0.1.0 — Current
- [x] Connect local Obsidian vault
- [x] Background indexing with progress indicator
- [x] Ask mode — semantic chat with your vault

### v0.2.0 — Planned
- [ ] Write mode — proactive sidebar *(Pro)*
- [ ] Web search integration via Perplexity Sonar *(Pro)*
- [ ] Timeline view — visualize how your thinking evolved *(Pro)*

### v0.3.0 — Exploring
- [ ] Notion integration
- [ ] Local AI model support (full offline mode)
- [ ] Mobile companion app

Have a feature idea? [Open an issue →](https://github.com/F-kite/nore/issues/new?template=feature_request.md)

---

## Open-core Model

Nore's core is open-source under the MIT license. This includes vault connection, indexing, and basic Ask mode.

Pro features (Write mode, web search, Timeline) are proprietary and require a subscription. See [LICENSE](./LICENSE) and [LICENSE-PRO](./LICENSE-PRO) for details.

---

## Contributing

Contributions to the open-source core are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a pull request.

---

## Privacy

Nore is built on a simple principle: **your knowledge is yours.**

- Vault files are read locally and never uploaded
- Only anonymized metadata is sent to the licensing server (to validate your subscription)
- AI queries send only the relevant text excerpts needed to answer your question — not your entire vault
- No analytics, no tracking
- Core is open-source — verify it yourself

---

## Built With

- [Electron](https://www.electronjs.org/) — Desktop framework
- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) — UI
- [LanceDB](https://lancedb.github.io/lancedb/) — Local vector database
- [Voyage AI](https://www.voyageai.com/) — Embeddings
- [OpenAI](https://openai.com/) — Language model
- [Perplexity Sonar](https://www.perplexity.ai/) — Web search *(Pro)*

---

<div align="center">

Made by [@F-kite](https://github.com/F-kite) · [usenore.com](https://usenore.com) · [Join the waitlist](https://usenore.com#waitlist)

</div>