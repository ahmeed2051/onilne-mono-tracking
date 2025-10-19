# Monopoly Money Tracker Product Blueprint

## 1. Core Product Goals
- **Instant clarity:** Surface each player’s balance and deltas in real time.
- **Trust & fairness:** Immutable audit trail with reversible transactions governed by Monopoly rules.
- **Zero-friction join:** Scan QR code or enter 6–8 digit session code to hop in within seconds.
- **Works everywhere:** Mobile-first PWA with optional native wrappers for stores.
- **Reliable updates:** Real-time synchronization and push notifications for every meaningful change.

## 2. Must-Have Features (MVP)
### Game Creation & Joining
- Create sessions with game name, rule preset, starting cash, and currency.
- Join via QR code, short alphanumeric code, or invite link.
- Support roles: Banker (full control), Player, optional Spectator.

### Live Balances Dashboard
- Mobile-friendly grid/list of players with avatar, name, balance, and last delta.
- Sorting (richest/poorest), quick name search, and tap-to-open quick actions.

### Money Actions & Approvals
- Actions: Add, Deduct (bank ↔ player), Pay player (player ↔ player), Pass GO shortcut, fines/fees/chance/chest presets.
- Configurable approvals: banker confirmation or simple vote; optional two-step flows.

### Activity Log (Audit Trail)
- Record each transaction with initiator, approver(s), before/after balances, timestamps, notes, rule tags.
- Undo/redo within permitted window, implemented via reversing transactions.

### Notifications
- In-app real-time toasts for all players.
- Push notifications (PWA push / native) for incoming money, approvals, game state changes.
- Per-player notification preferences.

### Anti-Cheat & Safety
- Role-based permissions, optional approvals on peer transfers.
- Banker pause/lock mode, session PIN, and action rate limiting.

### Game Lifecycle
- States: Start → Running → Paused → Ended.
- End screen: standings, charts, export (PDF/CSV).

## 3. Nice-to-Have Features (Post-MVP)
- Offline/local play via WebRTC or local network with auto-sync when online.
- House rule presets (Free Parking pot, auction toggles, custom cash).
- Multiple board/currency variants and game duplication templates.
- Stats & insights (net flow, rent income, top payer/collector, timeline).
- Avatars/emojis, theming (light/dark), Arabic & English localization.
- Guest mode plus accounts for persistent history.

## 4. Key UX Flows
1. Create Game → Display QR/Code → Players Join → Ready → Play.
2. Tap Player → Choose Pay/Add/Deduct → (Optional approval) → Update balances + notify.
3. Approval dialog with before/after snapshots and clear accept/reject.
4. End Game confirmation → Summary & export/share options.

## 5. Data Model Overview
- **User**: `id`, `display_name`, `avatar_url`, `locale`, `notification_tokens[]`.
- **GameSession**: `id`, `code`, `status`, `created_by`, `rules(json)`, `currency`, `starting_cash`, `created_at`.
- **Player**: `id`, `user_id` (nullable for guest), `game_id`, `role`, `balance`, `join_time`, `is_active`.
- **Transaction**: `id`, `game_id`, `from_player_id`/`to_player_id` (nullable for bank), `amount`, `type`, `note`, `created_by`, `approvals_required`, `approvals_received[]`, `status`, `before_after_snapshot(json)`, `created_at`.
- **Notification**: `id`, `user_id`, `game_id`, `type`, `payload(json)`, `delivered_at`.
- **RulePreset**: `id`, `name`, `pass_go_amount`, `auction_enabled`, `free_parking_mode`, `custom_actions[]`.

## 6. API Surface (REST/GraphQL + Realtime)
- `POST /games` create session.
- `POST /games/{id}/join` join via code/QR.
- `GET /games/{id}` snapshot (players, last transactions).
- `POST /games/{id}/transactions` create transaction.
- `POST /transactions/{id}/approve|reject` manage approvals.
- `POST /games/{id}/pause|resume|end` lifecycle controls.
- `GET /games/{id}/export?format=csv|pdf` download results.
- `PATCH /players/{id}` update profile fields.
- Realtime channel `game:{id}` (WebSocket/WebRTC) emits `player.updated`, `txn.created`, `txn.approved`, `game.status_changed`.
- Push: Web Push (VAPID) + APNs/FCM for native wrappers.

## 7. Architecture Choices
- **Frontend:** React/Vue/Svelte PWA, Service Worker + IndexedDB cache, RTL support.
- **Realtime:** WebSockets (Socket.io) or WebTransport; WebRTC data channels for offline/local host.
- **Backend:** Node.js (Express/Fastify/Nest) or Go/Fiber; event-sourced transaction log.
- **Database:** PostgreSQL (JSONB for rules) + Redis pub/sub for presence.
- **Auth:** Password-less magic links or guest tokens per session.
- **Notifications:** Web Push service + FCM/APNs adapters.
- **Deployment:** Single region, sticky sessions or token-based room affinity.

## 8. Real-Time Consistency & Conflict Handling
- Server as source of truth; balances derived from ledger.
- Idempotency keys on transaction creation.
- Optimistic UI with server reconciliation and rollback on rejection.
- Server timestamps only to avoid clock skew issues.

## 9. Security & Privacy
- Scoped tokens per game; validate membership on every request.
- Role-based authorization around transactions.
- Rate limits (e.g., max 5 actions per 5 seconds).
- Append-only audit log; undo emits inverse transactions.
- Minimal PII; auto-purge ended games after configurable retention.

## 10. Notifications Matrix
- **Transaction created (pending):** Involved players + banker (push & in-app).
- **Approval needed:** All eligible voters (push).
- **Transaction approved/rejected:** All players (toast; push for involved parties).
- **Pass GO:** Target player (push), everyone (toast).
- **Game paused/resumed/ended:** Entire roster (push & toast).

## 11. Validation & Edge Cases
- Prevent negative balances unless house rule allows.
- Block self-pay loops unless configured.
- Handle disconnect/reconnect with presence indicators.
- Late joiners fetch full history and current state.
- Safe banker transfer/replacement and session recovery.

## 12. Accessibility & Localization
- English/Arabic toggle with full RTL layout support.
- Large touch targets, high-contrast palette, descriptive labels for screen readers.
- Haptic feedback on critical actions (mobile devices).

## 13. Analytics (Opt-In)
- Capture session duration, action counts, approval/undo rates.
- Performance metrics: action latency, socket reconnect frequency.
- Aggregate anonymously; no personal data.

## 14. Testing & QA
- Unit tests for balance math and undo/redo logic.
- Integration tests covering multi-client sync and approvals.
- End-to-end (Cypress/Playwright) from create → play → end.
- Chaos tests: socket drops, duplicate requests, clock drift simulations.

## 15. Deliverables
- User stories (sample: player payment with push confirmation, banker approvals, late join QR flow).
- Acceptance criteria (e.g., roster updates within <300 ms).
- Wireframes: lobby, dashboard, action sheet, approvals, log, end screen.
- API contract (OpenAPI/GraphQL schema) and realtime event catalog.
- Data model ERD with migration scripts.
- Performance budget: bundle <200 KB gzipped, TTI < 2s on mid-range phone.

## 16. Recommended Tech Stack Starter
- **Frontend:** React + Vite, Zustand/Redux, Tailwind CSS, PWA via Workbox, i18next.
- **Realtime:** Socket.io.
- **Backend:** NestJS + PostgreSQL + Prisma; Redis for rooms/presence.
- **Push:** Web Push (VAPID) + FCM for mobile wrappers.
- **Exports:** PDFKit (server) or jsPDF (client) for small games.
