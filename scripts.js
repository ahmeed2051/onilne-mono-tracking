const state = {
  games: [],
  currentGame: null,
};

const elements = {
  createGameForm: document.querySelector('#create-game-form'),
  joinGameForm: document.querySelector('#join-game-form'),
  joinGameCodeInput: document.querySelector('#join-game-code'),
  addPlayerForm: document.querySelector('#add-player-form'),
  transactionForm: document.querySelector('#transaction-form'),
  playerPanel: document.querySelector('#player-panel'),
  transactionPanel: document.querySelector('#transaction-panel'),
  gameSelect: document.querySelector('#game-select'),
  gameEmpty: document.querySelector('#game-empty'),
  refreshGames: document.querySelector('#refresh-games'),
  refreshGame: document.querySelector('#refresh-game'),
  overview: document.querySelector('#overview'),
  overviewStats: document.querySelector('#overview-stats'),
  gameTitle: document.querySelector('#game-title'),
  gameMeta: document.querySelector('#game-meta'),
  gameShareCode: document.querySelector('#game-share-code'),
  playersSection: document.querySelector('#players'),
  playerGrid: document.querySelector('#player-grid'),
  activitySection: document.querySelector('#activity'),
  activityList: document.querySelector('#activity-list'),
  activityCount: document.querySelector('#activity-count'),
  emptyState: document.querySelector('#empty-state'),
  toastRegion: document.querySelector('.toast-region'),
  activityTemplate: document.querySelector('#activity-item-template'),
};

function normalizeApiBase(base) {
  if (!base) return '/api';
  const trimmed = base.toString().trim();
  if (!trimmed) return '/api';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/u, '');
  }
  if (trimmed.startsWith('//')) {
    return trimmed.replace(/\/+$/u, '');
  }
  const withoutHash = trimmed.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];
  const stripped = withoutQuery.replace(/^\/+/, '').replace(/\/+$/u, '');
  if (!stripped) return '/api';
  return `/${stripped}`;
}

function getOverrideApiBase() {
  const override =
    (typeof window !== 'undefined' && window.MONOPOLY_API_BASE) ||
    document.querySelector('meta[name="monopoly-api-base"]')?.getAttribute('content') ||
    document.body?.dataset?.apiBase;
  if (!override) {
    return null;
  }
  return normalizeApiBase(override);
}

function deriveDefaultApiBase() {
  let inferredPath = '';
  try {
    const script = document.currentScript || document.querySelector('script[src*="scripts.js"]');
    if (script) {
      const scriptUrl = new URL(script.src, window.location.href);
      inferredPath = scriptUrl.pathname.replace(/\/[^/]*$/, '');
    }
  } catch (error) {
    console.warn('Unable to derive API base from script path.', error);
  }

  if (!inferredPath && typeof window !== 'undefined') {
    const { pathname } = window.location || { pathname: '' };
    if (pathname) {
      inferredPath = pathname.endsWith('/')
        ? pathname.slice(0, -1)
        : pathname.replace(/\/[^/]*$/, '');
    }
  }

  if (inferredPath) {
    return normalizeApiBase(`${inferredPath}/api`);
  }

  return '/api';
}

function coerceProxyToApiBase(value) {
  if (!value || typeof value !== 'string') return null;
  const normalized = normalizeApiBase(value);
  if (/\/api$/i.test(normalized)) {
    return normalized;
  }
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith('//')) {
    return `${normalized.replace(/\/+$/u, '')}/api`;
  }
  if (!normalized || normalized === '/') {
    return '/api';
  }
  return `${normalized.replace(/\/+$/u, '')}/api`;
}

async function readProxyFromPackageJson() {
  const candidates = [];
  const addCandidate = (value) => {
    if (!value || typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!candidates.includes(trimmed)) {
      candidates.push(trimmed);
    }
  };

  addCandidate('/package.json');
  addCandidate('package.json');

  if (typeof window !== 'undefined') {
    const { pathname } = window.location || { pathname: '' };
    if (pathname) {
      const basePath = pathname.endsWith('/')
        ? pathname
        : pathname.replace(/\/[^/]*$/, '/');
      if (basePath && basePath !== '/') {
        addCandidate(`${basePath}package.json`);
      }
    }
  }

  try {
    const script = document.currentScript || document.querySelector('script[src*="scripts.js"]');
    if (script) {
      const scriptUrl = new URL(script.src, window.location.href);
      const scriptDir = scriptUrl.pathname.replace(/\/[^/]*$/, '/');
      if (scriptDir && scriptDir !== '/') {
        addCandidate(`${scriptDir}package.json`);
      }
    }
  } catch (error) {
    console.warn('Unable to derive package.json path from script reference.', error);
  }

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) {
        continue;
      }
      const packageJson = await response.json();
      if (packageJson && typeof packageJson.proxy === 'string') {
        const coerced = coerceProxyToApiBase(packageJson.proxy);
        if (coerced) {
          return coerced;
        }
      }
    } catch (error) {
      console.warn(`Unable to read proxy value from ${candidate}.`, error);
    }
  }

  return null;
}

async function resolveApiBase() {
  const overrideBase = getOverrideApiBase();
  if (overrideBase) {
    return overrideBase;
  }

  const defaultBase = deriveDefaultApiBase();
  if (defaultBase && defaultBase !== '/api') {
    return defaultBase;
  }

  const proxyBase = await readProxyFromPackageJson();
  if (proxyBase) {
    return proxyBase;
  }

  return defaultBase;
}

let API_BASE = '/api';

async function apiRequest(path, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };
  if (config.body && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(`${API_BASE}${path}`, config);
  const rawText = await response.text();
  let data = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch (error) {
      data = {};
    }
  }
  if (!response.ok) {
    const fallbackMessage =
      data.error ||
      data.message ||
      response.statusText ||
      (rawText && rawText.trim()) ||
      `Request failed with status ${response.status}`;
    const errorMessage = fallbackMessage || 'Something went wrong.';
    throw new Error(errorMessage);
  }
  return data;
}

function showToast(message, type = 'success') {
  if (!elements.toastRegion) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.dataset.icon = type === 'error' ? '⚠️' : '✅';
  elements.toastRegion.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 2600);
}

async function loadGames() {
  try {
    const { games } = await apiRequest('/games');
    state.games = games || [];
    updateGameSelect();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function loadGame(gameId) {
  if (!gameId) return;
  try {
    const { game } = await apiRequest(`/games/${gameId}`);
    state.currentGame = game;
    renderGame();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function updateGameSelect() {
  if (!elements.gameSelect) return;
  elements.gameSelect.innerHTML = '';
  if (!state.games.length) {
    elements.gameSelect.hidden = true;
    elements.gameEmpty.hidden = false;
    return;
  }

  elements.gameSelect.hidden = false;
  elements.gameEmpty.hidden = true;

  const placeholder = document.createElement('option');
  placeholder.textContent = 'Select a game';
  placeholder.value = '';
  placeholder.disabled = true;
  placeholder.selected = !state.currentGame;
  elements.gameSelect.appendChild(placeholder);

  state.games.forEach((game) => {
    const option = document.createElement('option');
    option.value = game.id;
    option.textContent = `${game.name} (${game.playerCount} players)`;
    if (state.currentGame && state.currentGame.id === game.id) {
      option.selected = true;
    }
    elements.gameSelect.appendChild(option);
  });
}

function renderGame() {
  const hasGame = Boolean(state.currentGame);
  elements.playerPanel.hidden = !hasGame;
  elements.transactionPanel.hidden = !hasGame;
  elements.overview.hidden = !hasGame;
  elements.playersSection.hidden = !hasGame;
  elements.activitySection.hidden = !hasGame;
  elements.emptyState.hidden = hasGame;
  if (elements.gameShareCode) {
    elements.gameShareCode.hidden = !hasGame;
    elements.gameShareCode.innerHTML = '';
  }

  if (!hasGame) {
    elements.playerGrid.innerHTML = '';
    elements.activityList.innerHTML = '';
    elements.activityCount.textContent = '';
    updateTransactionFormAvailability();
    return;
  }

  const game = state.currentGame;
  elements.gameTitle.textContent = game.name;
  const created = new Date(game.createdAt);
  const updated = new Date(game.updatedAt);
  const meta = [`Started ${timeAgo(created)}`];
  if (game.updatedAt) {
    meta.push(`Updated ${timeAgo(updated)}`);
  }
  elements.gameMeta.textContent = meta.join(' • ');
  if (elements.gameShareCode) {
    if (game.joinCode) {
      elements.gameShareCode.hidden = false;
      elements.gameShareCode.innerHTML = `Share code <span class="share-code__badge">${game.joinCode}</span>`;
    } else {
      elements.gameShareCode.hidden = true;
      elements.gameShareCode.textContent = '';
    }
  }

  renderStats(game);
  renderPlayers(game);
  renderActivity(game);
  populatePlayerSelects(game);
  updateTransactionFormAvailability();
}

function renderStats(game) {
  const stats = [
    {
      label: 'Players',
      value: game.players.length,
    },
    {
      label: 'Total money',
      value: formatCurrency(game.players.reduce((sum, player) => sum + player.balance, 0), game.currency),
    },
    {
      label: 'Actions logged',
      value: game.transactions.length,
    },
  ];
  elements.overviewStats.innerHTML = stats
    .map(
      (stat) => `
        <div class="stat-card">
          <span>${stat.label}</span>
          <strong>${stat.value}</strong>
        </div>
      `,
    )
    .join('');
}

function renderPlayers(game) {
  if (!game.players.length) {
    elements.playerGrid.innerHTML = '<p class="muted">No players yet. Add a banker or player to begin tracking.</p>';
    return;
  }

  const sorted = [...game.players].sort((a, b) => b.balance - a.balance);
  elements.playerGrid.innerHTML = sorted
    .map((player) => {
      const delta = player.balance - game.startingBalance;
      const sign = delta > 0 ? '+' : '';
      const deltaLabel = `${sign}${formatCurrency(delta, game.currency)}`;
      const deltaClass = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';
      return `
        <article class="player-card" style="--player-color: ${player.color}">
          <header>
            <div class="avatar">${initials(player.name)}</div>
            <div>
              <h4>${player.name}</h4>
              <span class="muted">Joined ${timeAgo(new Date(player.createdAt))}</span>
            </div>
          </header>
          <div class="player-balance">
            ${formatCurrency(player.balance, game.currency)}
            <small class="muted">Δ <span class="${deltaClass}">${deltaLabel}</span> from start</small>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderActivity(game) {
  if (!game.transactions.length) {
    elements.activityList.innerHTML = '<li class="muted">No actions yet. Record your first move to build the timeline.</li>';
    elements.activityCount.textContent = '';
    return;
  }

  elements.activityCount.textContent = `${game.transactions.length} entr${game.transactions.length === 1 ? 'y' : 'ies'}`;
  elements.activityList.innerHTML = '';

  game.transactions.forEach((transaction) => {
    const clone = elements.activityTemplate.content.firstElementChild.cloneNode(true);
    const icon = clone.querySelector('.activity-icon');
    const title = clone.querySelector('.activity-title');
    const note = clone.querySelector('.activity-note');
    const meta = clone.querySelector('.activity-meta');

    icon.textContent = iconForTransaction(transaction.type);
    title.textContent = buildTransactionTitle(transaction);
    note.textContent = transaction.note || 'No notes provided.';
    note.classList.toggle('muted', !transaction.note);

    const metaItems = [`${timeAgo(new Date(transaction.createdAt))}`];
    const resultLabels = Object.entries(transaction.results).map(([playerId, balance]) => {
      const player = state.currentGame.players.find((p) => p.id === playerId);
      if (!player) return null;
      return `${player.name}: ${formatCurrency(balance, state.currentGame.currency)}`;
    });
    metaItems.push(...resultLabels.filter(Boolean));
    meta.innerHTML = metaItems.map((item) => `<span>${item}</span>`).join('');

    elements.activityList.appendChild(clone);
  });
}

function populatePlayerSelects(game) {
  const fromField = elements.transactionForm?.querySelector('[name="fromPlayerId"]');
  const toField = elements.transactionForm?.querySelector('[name="toPlayerId"]');
  if (!fromField || !toField) return;

  [fromField, toField].forEach((select) => {
    select.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select player';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);
  });

  game.players.forEach((player) => {
    const option = document.createElement('option');
    option.value = player.id;
    option.textContent = `${player.name} (${formatCurrency(player.balance, game.currency)})`;
    fromField.appendChild(option.cloneNode(true));
    toField.appendChild(option);
  });
}

function updateTransactionFormAvailability() {
  const form = elements.transactionForm;
  if (!form) return;
  const type = form.type?.value || 'deposit';
  const fromWrapper = form.querySelector('[data-role="from-player"]');
  const toWrapper = form.querySelector('[data-role="to-player"]');
  const fromSelect = form.querySelector('[name="fromPlayerId"]');
  const toSelect = form.querySelector('[name="toPlayerId"]');

  if (type === 'deposit') {
    fromWrapper.hidden = true;
    toWrapper.hidden = false;
    fromSelect.required = false;
    toSelect.required = true;
  } else if (type === 'withdraw') {
    fromWrapper.hidden = false;
    toWrapper.hidden = true;
    fromSelect.required = true;
    toSelect.required = false;
  } else {
    fromWrapper.hidden = false;
    toWrapper.hidden = false;
    fromSelect.required = true;
    toSelect.required = true;
  }

  const playerCount = state.currentGame?.players?.length || 0;
  const submitButton = form.querySelector('button[type="submit"]');
  let disabled = false;
  if (type === 'transfer' && playerCount < 2) {
    disabled = true;
  } else if (['deposit', 'withdraw'].includes(type) && playerCount < 1) {
    disabled = true;
  }
  submitButton.disabled = disabled;
  submitButton.textContent = disabled ? 'Add more players first' : 'Save action';
}

function initials(name) {
  return name
    .split(' ')
    .map((word) => word.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatCurrency(amount, currency = 'M$') {
  const value = Number(amount) || 0;
  return `${currency}${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function iconForTransaction(type) {
  switch (type) {
    case 'deposit':
      return '⬆️';
    case 'withdraw':
      return '⬇️';
    case 'transfer':
      return '🔁';
    default:
      return '💰';
  }
}

function buildTransactionTitle(transaction) {
  const { type, amount, actors } = transaction;
  const value = formatCurrency(amount, state.currentGame.currency);
  if (type === 'deposit') {
    return `Bank sent ${value} to ${actors.to?.name ?? 'a player'}`;
  }
  if (type === 'withdraw') {
    return `${actors.from?.name ?? 'A player'} paid ${value} to bank`;
  }
  if (type === 'transfer') {
    return `${actors.from?.name ?? 'Player'} sent ${value} to ${actors.to?.name ?? 'player'}`;
  }
  return `Recorded ${value}`;
}

function timeAgo(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return 'Just now';
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (seconds < 60) return 'moments ago';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleString();
}

function attachEventListeners() {
  elements.createGameForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    try {
      const { game } = await apiRequest('/games', {
        method: 'POST',
        body: {
          name: payload.name,
          startingBalance: payload.startingBalance,
          currency: payload.currency,
        },
      });
      const shareMessage = game.joinCode ? `Game created. Share code ${game.joinCode}` : 'Game created';
      showToast(shareMessage);
      state.currentGame = game;
      await loadGames();
      updateGameSelect();
      elements.gameSelect.value = game.id;
      renderGame();
      event.target.reset();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  elements.gameSelect?.addEventListener('change', (event) => {
    const gameId = event.target.value;
    if (gameId) {
      loadGame(gameId);
    }
  });

  elements.refreshGames?.addEventListener('click', () => {
    loadGames();
  });

  elements.refreshGame?.addEventListener('click', () => {
    if (state.currentGame) {
      loadGame(state.currentGame.id);
    }
  });

  elements.joinGameForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const normalized = (formData.get('code') || '')
      .toString()
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();
    if (!normalized) {
      showToast('Enter a valid game code.', 'error');
      return;
    }
    if (elements.joinGameCodeInput) {
      elements.joinGameCodeInput.value = normalized;
    }
    try {
      const { game } = await apiRequest(`/games/code/${encodeURIComponent(normalized)}`);
      state.currentGame = game;
      showToast(`Joined ${game.name}`);
      await loadGames();
      state.currentGame = game;
      if (elements.gameSelect) {
        elements.gameSelect.value = game.id;
      }
      renderGame();
      event.target.reset();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  elements.addPlayerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.currentGame) return;
    const formData = new FormData(event.target);
    const payload = { name: formData.get('playerName') };
    try {
      const { game } = await apiRequest(`/games/${state.currentGame.id}/players`, {
        method: 'POST',
        body: { name: payload.name },
      });
      state.currentGame = game;
      showToast('Player added');
      await loadGames();
      renderGame();
      event.target.reset();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  elements.transactionForm?.addEventListener('change', (event) => {
    if (event.target.name === 'type') {
      updateTransactionFormAvailability();
    }
  });

  elements.transactionForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.currentGame) return;
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());
    try {
      const { game } = await apiRequest(`/games/${state.currentGame.id}/transactions`, {
        method: 'POST',
        body: {
          type: payload.type,
          amount: Number(payload.amount),
          fromPlayerId: payload.fromPlayerId || undefined,
          toPlayerId: payload.toPlayerId || undefined,
          note: payload.note,
        },
      });
      state.currentGame = game;
      showToast('Action saved');
      renderGame();
      event.target.reset();
      updateTransactionFormAvailability();
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

async function init() {
  attachEventListeners();
  await loadGames();
  if (state.games.length) {
    const firstGameId = state.games[0].id;
    await loadGame(firstGameId);
    elements.gameSelect.value = firstGameId;
  } else {
    renderGame();
  }
}

async function initializeApp() {
  try {
    API_BASE = await resolveApiBase();
  } catch (error) {
    console.error('Failed to resolve API base, falling back to /api.', error);
    API_BASE = '/api';
  }
  console.info('Monopoly Money Tracker API base:', API_BASE);
  await init();
}

initializeApp();
