# Monopoly Money Tracker

Monopoly Money Tracker is a digital ledger for in-person Monopoly games. It keeps player balances in sync across devices, streamlines approvals for complex transactions, and provides a trustworthy audit trail so the table never has to pause to count cash again.

## Project Overview
- **Core goals:** deliver instant clarity on balances, maintain a fair audit trail, offer low-friction joining, work across devices, and keep updates reliable.
- **Target platforms:** mobile-first progressive web app with optional native wrappers.
- **Primary users:** bankers, players, and optional spectators joining via QR code, invite link, or short alphanumeric code.

For deeper product details, see the [Monopoly Money Tracker Blueprint](docs/monopoly-money-tracker-blueprint.md).

## Key Features
- **Game creation & joining:** configure rule presets, starting cash, and currency, then invite others via QR code or shareable code.
- **Live balances dashboard:** real-time grid of players with avatars, balances, and recent deltas, plus quick search and sorting.
- **Money actions:** add, deduct, or transfer money; trigger Monopoly-specific shortcuts like "Pass GO" or chance/community chest presets.
- **Approvals workflow:** optional banker or multi-player approvals with undo/redo via inverse transactions.
- **Activity log:** immutable audit trail with before/after snapshots, notes, and timestamps.
- **Notifications:** in-app toasts and push notifications for transactions, approvals, and game state changes.
- **Game lifecycle controls:** pause, resume, and end games with final standings and export options.

## Architecture Snapshot
- **Frontend:** React/Vite PWA using Tailwind CSS and i18next, with service worker caching and IndexedDB storage for offline resilience.
- **Backend:** NestJS with PostgreSQL (Prisma ORM) and Redis for real-time presence and pub/sub.
- **Realtime:** Socket.io channels for game updates, with WebRTC fallback for local/offline play.
- **Auth & security:** passwordless magic links or guest tokens, scoped session permissions, and rate limiting on critical actions.
- **Notifications:** Web Push via VAPID plus adapters for FCM/APNs when packaged natively.

## Getting Started
Development scaffolding is not yet checked into this repository. To contribute:
1. Review the [product blueprint](docs/monopoly-money-tracker-blueprint.md) for domain context and feature expectations.
2. Propose implementation plans via issues or design docs before submitting large changes.
3. Once the codebase is available, follow the standard setup instructions for the chosen stack (Node.js, NestJS, PostgreSQL, Redis, and a React/Vite frontend).

## Roadmap Highlights
Future iterations may introduce offline/local play, house-rule presets, analytics, localization, and theming improvements. See the blueprint for the full backlog of post-MVP ideas.

## License
This project does not yet specify a license. Please open an issue to discuss licensing before reusing or distributing the work.
