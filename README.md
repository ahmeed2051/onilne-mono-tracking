# Monopoly Money Tracker

Monopoly Money Tracker is a lightweight full-stack demo that helps you host Monopoly nights without counting paper cash. Create a
game, invite players sitting around the table, and record every rent payment, fine, or trade in seconds while everyone watches
the live balances update.

## Features
- **Game setup in seconds** – choose a name, starting balance, and currency and you instantly have a lobby ready for players.
- **Player management** – add players with color-coded avatars and view their balance deltas from the starting cash.
- **Action logging** – record deposits, withdrawals, and transfers with optional notes; the timeline keeps an immutable audit
  trail.
- **Responsive dashboard** – a modern, touch-friendly UI that adapts beautifully from phones to large tabletop displays.
- **In-memory backend** – Express.js API stores the current server session, keeping the demo fast with zero external services.

## Tech Stack
- **Frontend:** Vanilla JavaScript, semantic HTML, and custom CSS (no framework required).
- **Backend:** Node.js with Express, CORS, and nanoid for friendly identifiers.

## Getting started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server (serves the API and frontend):
   ```bash
   npm start
   ```
3. Open http://localhost:3000 in your browser.

The backend keeps data in memory, so stopping the server resets the games. This is intentional for demo purposes and keeps the
setup simple.

## Available Scripts
- `npm start` – run the Express server on port 3000.
- `npm test` – placeholder script; prints a message and exits.

## Project structure
```
.
├── docs/                              # Product background docs
├── index.html                         # UI shell
├── scripts.js                         # Frontend logic & API calls
├── styles.css                         # Modern, responsive styling
├── server.js                          # Express backend with in-memory store
└── package.json                       # Dependencies and scripts
```

## Contributing
Pull requests are welcome! If you plan a larger change, please open an issue describing your idea first so we can discuss the
best approach.

## License
MIT
