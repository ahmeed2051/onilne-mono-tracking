const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');

const PORT = process.env.PORT || 3000;

function nanoid(size = 10) {
  return randomBytes(size * 2)
    .toString('base64url')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, size) || randomBytes(size).toString('hex').slice(0, size);
}

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

function sendJson(res, statusCode, payload) {
  if (res.writableEnded) {
    return;
  }
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

async function serveStaticFile(res, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const normalized = path.posix.normalize(requestedPath).replace(/^\.\//, '');
  if (normalized.includes('..')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const filePath = path.join(__dirname, normalized);
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.isDirectory()) {
      await serveStaticFile(res, path.posix.join(normalized, 'index.html'));
      return;
    }
    const stream = fs.createReadStream(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    stream.pipe(res);
    stream.on('error', (error) => {
      console.error('Static file stream error:', error);
      if (!res.writableEnded) {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    console.error('Static file error:', error);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
}

async function handleRequest(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname === '/api/games' && req.method === 'GET') {
    sendJson(res, 200, { games: store.listGames() });
    return;
  }

  if (pathname === '/api/games' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const { name, startingBalance, currency } = body || {};
      const trimmedName = (name || '').trim();
      if (!trimmedName) {
        sendJson(res, 400, { error: 'Game name is required.' });
        return;
      }
      const numericStartingBalance = Number(startingBalance);
      const balance = Number.isFinite(numericStartingBalance) && numericStartingBalance >= 0
        ? numericStartingBalance
        : 1500;
      const newGame = store.createGame({ name: trimmedName, startingBalance: balance, currency: currency || 'M$' });
      sendJson(res, 201, { game: newGame });
    } catch (error) {
      if (error.message === 'Invalid JSON body.' || error.message === 'Request body too large.') {
        sendJson(res, 400, { error: error.message });
      } else {
        console.error('Create game error:', error);
        sendJson(res, 500, { error: error.message || 'Failed to create game.' });
      }
    }
    return;
  }

  const gameMatch = pathname.match(/^\/api\/games\/([^\/]+)$/);
  if (gameMatch && req.method === 'GET') {
    const game = store.getGame(gameMatch[1]);
    if (!game) {
      sendJson(res, 404, { error: 'Game not found.' });
      return;
    }
    sendJson(res, 200, { game });
    return;
  }

  const addPlayerMatch = pathname.match(/^\/api\/games\/([^\/]+)\/players$/);
  if (addPlayerMatch && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const updatedGame = store.addPlayer(addPlayerMatch[1], body || {});
      if (!updatedGame) {
        sendJson(res, 404, { error: 'Game not found.' });
        return;
      }
      sendJson(res, 201, { game: updatedGame });
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Failed to add player.' });
    }
    return;
  }

  const addTransactionMatch = pathname.match(/^\/api\/games\/([^\/]+)\/transactions$/);
  if (addTransactionMatch && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const updatedGame = store.addTransaction(addTransactionMatch[1], body || {});
      if (!updatedGame) {
        sendJson(res, 404, { error: 'Game not found.' });
        return;
      }
      sendJson(res, 201, { game: updatedGame });
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Failed to add transaction.' });
    }
    return;
  }

  if (pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'Not found.' });
    return;
  }

  await serveStaticFile(res, pathname);
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error('Unhandled error:', error);
    if (!res.writableEnded) {
      try {
        sendJson(res, 500, { error: 'Internal Server Error' });
      } catch (sendError) {
        console.error('Failed to send error response:', sendError);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
