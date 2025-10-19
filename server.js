const express = require('express');
const cors = require('cors');
const path = require('path');
const { nanoid } = require('nanoid');

const PORT = process.env.PORT || 3000;

class GameStore {
  constructor() {
    this.games = new Map();
  }

  createGame({ name, startingBalance = 1500, currency = 'M$' }) {
    const id = nanoid(10);
    const now = new Date().toISOString();
    const game = {
      id,
      name,
      startingBalance,
      currency,
      createdAt: now,
      updatedAt: now,
      players: new Map(),
      transactions: [],
    };
    this.games.set(id, game);
    return this.serializeGame(game);
  }

  getGame(id) {
    const game = this.games.get(id);
    return game ? this.serializeGame(game) : null;
  }

  getGameInternal(id) {
    return this.games.get(id) || null;
  }

  listGames() {
    return Array.from(this.games.values()).map((game) => ({
      id: game.id,
      name: game.name,
      startingBalance: game.startingBalance,
      currency: game.currency,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      playerCount: game.players.size,
      transactionCount: game.transactions.length,
    }));
  }

  addPlayer(gameId, { name }) {
    const game = this.getGameInternal(gameId);
    if (!game) {
      return null;
    }
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      throw new Error('Player name is required.');
    }
    const playerId = nanoid(8);
    const now = new Date().toISOString();
    const colors = ['#f59f00', '#0ea5e9', '#f97316', '#22c55e', '#a855f7', '#ef4444'];
    const color = colors[game.players.size % colors.length];
    const player = {
      id: playerId,
      name: trimmedName,
      balance: Number(game.startingBalance) || 0,
      color,
      createdAt: now,
    };
    game.players.set(playerId, player);
    game.updatedAt = now;
    return this.serializeGame(game);
  }

  addTransaction(gameId, payload) {
    const game = this.getGameInternal(gameId);
    if (!game) {
      return null;
    }
    const { type, amount, fromPlayerId, toPlayerId, note } = payload;
    const normalizedType = (type || '').toLowerCase();
    const numericAmount = Number(amount);
    if (!['deposit', 'withdraw', 'transfer'].includes(normalizedType)) {
      throw new Error('Transaction type must be deposit, withdraw, or transfer.');
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error('Amount must be a positive number.');
    }

    const now = new Date().toISOString();
    const transaction = {
      id: nanoid(10),
      type: normalizedType,
      amount: numericAmount,
      note: (note || '').trim(),
      createdAt: now,
      actors: {},
      results: {},
    };

    if (normalizedType === 'deposit') {
      const target = this.requirePlayer(game, toPlayerId, 'Recipient player is required for deposits.');
      target.balance += numericAmount;
      transaction.actors = { to: this.playerSnapshot(target) };
      transaction.results[target.id] = target.balance;
    } else if (normalizedType === 'withdraw') {
      const source = this.requirePlayer(game, fromPlayerId, 'Source player is required for withdrawals.');
      if (source.balance < numericAmount) {
        throw new Error(`${source.name} does not have enough balance for this withdrawal.`);
      }
      source.balance -= numericAmount;
      transaction.actors = { from: this.playerSnapshot(source) };
      transaction.results[source.id] = source.balance;
    } else if (normalizedType === 'transfer') {
      const source = this.requirePlayer(game, fromPlayerId, 'Source player is required for transfers.');
      const target = this.requirePlayer(game, toPlayerId, 'Recipient player is required for transfers.');
      if (source.id === target.id) {
        throw new Error('Cannot transfer to the same player.');
      }
      if (source.balance < numericAmount) {
        throw new Error(`${source.name} does not have enough balance to transfer.`);
      }
      source.balance -= numericAmount;
      target.balance += numericAmount;
      transaction.actors = {
        from: this.playerSnapshot(source),
        to: this.playerSnapshot(target),
      };
      transaction.results[source.id] = source.balance;
      transaction.results[target.id] = target.balance;
    }

    game.transactions.unshift(transaction);
    game.updatedAt = now;
    return this.serializeGame(game);
  }

  playerSnapshot(player) {
    return {
      id: player.id,
      name: player.name,
    };
  }

  requirePlayer(game, playerId, errorMessage) {
    const player = game.players.get(playerId);
    if (!player) {
      throw new Error(errorMessage || 'Player not found.');
    }
    return player;
  }

  serializeGame(game) {
    return {
      id: game.id,
      name: game.name,
      startingBalance: game.startingBalance,
      currency: game.currency,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      players: Array.from(game.players.values()).map((player) => ({
        id: player.id,
        name: player.name,
        balance: player.balance,
        color: player.color,
        createdAt: player.createdAt,
      })),
      transactions: game.transactions,
    };
  }
}

const store = new GameStore();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/games', (_req, res) => {
  res.json({ games: store.listGames() });
});

app.post('/api/games', (req, res) => {
  try {
    const { name, startingBalance, currency } = req.body || {};
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ error: 'Game name is required.' });
    }
    const numericStartingBalance = Number(startingBalance);
    const balance = Number.isFinite(numericStartingBalance) && numericStartingBalance >= 0
      ? numericStartingBalance
      : 1500;
    const newGame = store.createGame({ name: trimmedName, startingBalance: balance, currency: currency || 'M$' });
    res.status(201).json({ game: newGame });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to create game.' });
  }
});

app.get('/api/games/:gameId', (req, res) => {
  const { gameId } = req.params;
  const game = store.getGame(gameId);
  if (!game) {
    return res.status(404).json({ error: 'Game not found.' });
  }
  res.json({ game });
});

app.post('/api/games/:gameId/players', (req, res) => {
  const { gameId } = req.params;
  try {
    const updatedGame = store.addPlayer(gameId, req.body || {});
    if (!updatedGame) {
      return res.status(404).json({ error: 'Game not found.' });
    }
    res.status(201).json({ game: updatedGame });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to add player.' });
  }
});

app.post('/api/games/:gameId/transactions', (req, res) => {
  const { gameId } = req.params;
  try {
    const updatedGame = store.addTransaction(gameId, req.body || {});
    if (!updatedGame) {
      return res.status(404).json({ error: 'Game not found.' });
    }
    res.status(201).json({ game: updatedGame });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to add transaction.' });
  }
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found.' });
  }
  next();
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
