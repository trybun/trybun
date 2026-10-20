# 01 – Overview

**Trybun** is an open-source ticket system that connects customer requests with developer workflow.

## 1.1 Purpose

The system receives, handles and plans **tickets** coming from three sources:

- **the development team** – technical tasks, bugs, technical debt, improvements,
- **end users** – problem reports, feature requests, questions,
- **integrations** – tickets created automatically by other applications through the API ([§12.3](12-api-webhooks-import.md)).

The system combines ticket handling with work planning (roadmap, Gantt chart) and integration with code repositories (GitHub).

## 1.2 Delivery approach: AI Engineering

The project is **by design delivered using an AI Engineering approach**: code, tests, documentation and in-app tours are produced primarily by AI agents, while humans define requirements, supervise the work, and review and approve every change.

Consequences for the whole project:

- This specification is the **primary source of knowledge for agents**. It must be precise enough to implement from without guessing.
- Rules for agents are defined in [02-agent-rules.md](02-agent-rules.md). They take precedence over every other implementation guideline.
- Quality is ensured primarily by automated quality gates (tests, static analysis, security scanning) and human review of every change.

## 1.3 How to use this specification

- [README.md](README.md) is the index: one sentence per file. Read only the files relevant to the current task.
- [00-glossary.md](00-glossary.md) defines every domain term with its **code identifier** and its **UI labels** (EN/PL). Always use the code identifiers from the glossary in code.
- Cross-references use the form `§N.M`, where `N` is the file number.
- The specification is written in English. **User-facing texts** (labels, messages) are given in both English and Polish, because the UI is bilingual ([§13.1](13-non-functional.md)).
- If the implementation reveals a gap or contradiction in this specification, do not resolve it yourself – report it and propose a change ([§2.9](02-agent-rules.md)).

## 1.4 Naming

The product is called **Trybun**. Agents never invent other names, prefixes or scopes for it.

| Where | Form | Example |
|---|---|---|
| Running text: documentation, UI, e-mails, login screens, "About" page | **Trybun** | "Welcome to Trybun" |
| GitHub organization and repository | `trybun` | `github.com/trybun/trybun` |
| npm packages (monorepo) | `@trybun/<name>` | `@trybun/ui`, `@trybun/shared`, `@trybun/api` |
| Container images | `ghcr.io/trybun/<service>` | `ghcr.io/trybun/web`, `ghcr.io/trybun/api`, `ghcr.io/trybun/worker` |
| CLI commands and scripts | `trybun` | `trybun` |
| Environment variables (own settings) | `TRYBUN_` prefix | `TRYBUN_DOMAIN`, `TRYBUN_DEFAULT_LANGUAGE` |
| Keycloak realm | `trybun` | `trybun` |
| Types and classes in code | PascalCase | `TrybunConfig` |
| Domain | lowercase | `trybun.dev` (to be confirmed) |

Rules:

- All technical identifiers are lowercase (npm and Docker require it). The capitalized form **Trybun** is used only in human-readable text. The name is never written in all caps, except as a graphic element of the logo.
- Environment variables of third-party components keep their own names (e.g. `POSTGRES_PASSWORD`); only the system's own settings use the `TRYBUN_` prefix.

### Brand assets

The logo, icons, favicon, colours and typeface are defined only in [`docs/brand/`](../brand/README.md). Agents use these files and never draw their own version of the mark or introduce other brand colours. The UI design tokens (Rule 6) take the brand colours from there.
