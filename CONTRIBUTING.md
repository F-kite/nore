# Contributing to Nore

Thank you for your interest in contributing to Nore! This document explains how to contribute to the open-source core of the project.

---

## What You Can Contribute To

Nore follows an **open-core model**. Contributions are welcome to the open-source core only:

- Vault connection and file reading
- Indexing pipeline
- Basic Ask mode (semantic chat with vault)
- Bug fixes and performance improvements
- Documentation

Pro features (Write mode, web search, Timeline) are proprietary and not open for contribution.

---

## Before You Start

1. Check the [open issues](https://github.com/F-kite/nore/issues) to see if someone is already working on what you have in mind
2. For new features, open an issue first and describe what you want to build — this avoids wasted effort if the direction doesn't align with the roadmap
3. For bug fixes, you can go straight to a pull request

---

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Clone and install

```bash
git clone https://github.com/F-kite/nore.git
cd nore
npm install
```

### Run in development mode

```bash
npm run dev
```

### Build

```bash
npm run build
```

---

## Pull Request Guidelines

- Keep PRs focused — one fix or feature per PR
- Write a clear description of what changed and why
- If your PR fixes an issue, reference it: `Fixes #123`
- Make sure the app builds and runs before submitting
- Follow the existing code style (TypeScript, ESLint config included)

---

## Commit Message Format

Use clear, descriptive commit messages:

```
feat: add incremental indexing for modified files
fix: vault path not saved after app restart
docs: update getting started section in README
refactor: simplify IPC handler for file reading
```

Prefixes: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`

---

## Reporting Bugs

Use the [bug report template](https://github.com/F-kite/nore/issues/new?template=bug_report.md) and include:

- Your OS and version
- Steps to reproduce (video better)
- Expected vs actual behavior
- Any relevant logs from the app

---

## Suggesting Features

Use the [feature request template](https://github.com/F-kite/nore/issues/new?template=feature_request.md).

Note: suggestions for Pro features will be considered but implemented by the core team only.

---

## License

By contributing to Nore, you agree that your contributions will be licensed under the [MIT License](./LICENSE) that covers the open-source core.