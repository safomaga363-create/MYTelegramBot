/**
 * Bee Empire — Main Application Logic v2
 * Apiary management, honey extractor, mine game with mines, leaderboard, TON Connect
 */

// ===== CONFIGURATION =====
const ADMIN_WALLET_ADDRESS = "UQDeGY3zk1PQK5PKyGr8KsDL7tvRVYL7xpKc0DfoDxSSsunU";
const ADMIN_TELEGRAM_ID = 7615522822;
const BOT_USERNAME_DEFAULT = 'BeeEmpireBot';
const API_URL = ""; // Set to backend URL for leaderboard, e.g. "https://your-server.com"

let isAdmin = false; // Set true after detecting admin Telegram ID

const TICKETS_PER_RECHARGE = 5;
const TICKET_RECHARGE_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour
const GAME_DURATION = 30;
const NECTAR_SPAWN_INTERVAL = 320; // Dense stream: ~3 flowers/sec
const NECTAR_BATCH_SIZE = 2; // Spawn 2 items per tick for density
const MINE_CHANCE = 0.25;
const MINE_PENALTY = 10;
const HONEY_PER_CONVERT = 100;
const BEE_PER_CONVERT_BASE = 10;
const MAX_NESTS = 10;
const MAX_QUEENS = 10;
const MAX_WORKERS = 800000;
const MAX_SOLDIERS = 200000;
const BEES_PER_NEST = 10000;
const PASSIVE_HONEY_PER_HOUR = 100;
const PREMIUM_HONEY_BONUS = 0.15;
const PREMIUM_TICKET_BONUS = 2;
const STORAGE_KEY = 'bee_empire_v2';

// ===== TOOLS (level-based) =====
const TOOLS = [
    { id: 'smoker',    name: 'Дымарь',    icon: '💨', basePrice: 50,   basePriceTon: 0.05,  desc: 'Успокаивает пчёл, повышая продуктивность' },
    { id: 'suit',      name: 'Костюм',    icon: '🥽', basePrice: 200,  basePriceTon: 0.1,   desc: 'Защита пчеловода, +% к сбору' },
    { id: 'extractor', name: 'Медогонка', icon: '⚙️', basePrice: 500,  basePriceTon: 0.25,  desc: 'Перерабатывает мёд в токены быстрее' },
];

// ===== BEE PURCHASES (count-based) =====
const BEE_ITEMS = [
    { id: 'workers',  name: 'Рабочие пчёлы',   icon: '🐝', basePrice: 10,  basePriceTon: 0.01,  amount: 1000,  maxAmount: MAX_WORKERS,  priceInc: 5,   desc: 'Рабочие пчёлы для добычи мёда' },
    { id: 'soldiers', name: 'Пчёлы-солдаты',    icon: '🪖', basePrice: 50,  basePriceTon: 0.03,  amount: 500,   maxAmount: MAX_SOLDIERS, priceInc: 25,  desc: 'Защищают пасеку от врагов' },
    { id: 'queens',   name: 'Королевы (Матки)',  icon: '👑', basePrice: 1000, basePriceTon: 0.5, amount: 1,     maxAmount: MAX_QUEENS,   priceInc: 500, desc: 'Управляют ульями' },
    { id: 'nests',    name: 'Гнёзда (Ульи)',     icon: '🛖', basePrice: 500, basePriceTon: 0.2,  amount: 1,     maxAmount: MAX_NESTS,    priceInc: 250, desc: 'Дом для пчёл. Нужно 10K пчёл для активации' },
];

// ===== 50 UPGRADE CARDS =====
const UPGRADE_CARDS = [
    { id: 'hc1', icon: '🍯', name: 'Сбор мёда I', desc: '+5% к сбору мёда', price: 50 },
    { id: 'hc2', icon: '🍯', name: 'Сбор мёда II', desc: '+10% к сбору', price: 150 },
    { id: 'hc3', icon: '🍯', name: 'Сбор мёда III', desc: '+15% к сбору', price: 400 },
    { id: 'hc4', icon: '🍯', name: 'Сбор мёда IV', desc: '+20% к сбору', price: 800 },
    { id: 'hc5', icon: '🍯', name: 'Сбор мёда V', desc: '+25% к сбору', price: 1500 },
    { id: 'tc1', icon: '🔄', name: 'Конвертация I', desc: '+2 токена за 100 мёда', price: 75 },
    { id: 'tc2', icon: '🔄', name: 'Конвертация II', desc: '+4 токена за 100', price: 200 },
    { id: 'tc3', icon: '🔄', name: 'Конвертация III', desc: '+6 токенов за 100', price: 500 },
    { id: 'tc4', icon: '🔄', name: 'Конвертация IV', desc: '+8 токенов за 100', price: 1000 },
    { id: 'tc5', icon: '🔄', name: 'Конвертация V', desc: '+10 токенов за 100', price: 2000 },
    { id: 'bp1', icon: '🐝', name: 'Продуктивность I', desc: '+5% к добыче', price: 100 },
    { id: 'bp2', icon: '🐝', name: 'Продуктивность II', desc: '+10% к добыче', price: 300 },
    { id: 'bp3', icon: '🐝', name: 'Продуктивность III', desc: '+15% к добыче', price: 600 },
    { id: 'bp4', icon: '🐝', name: 'Продуктивность IV', desc: '+20% к добыче', price: 1200 },
    { id: 'bp5', icon: '🐝', name: 'Продуктивность V', desc: '+25% к добыче', price: 2500 },
    { id: 'nc1', icon: '🛖', name: 'Вместимость I', desc: '+500 к лимиту', price: 120 },
    { id: 'nc2', icon: '🛖', name: 'Вместимость II', desc: '+1000 к лимиту', price: 350 },
    { id: 'nc3', icon: '🛖', name: 'Вместимость III', desc: '+2000 к лимиту', price: 700 },
    { id: 'nc4', icon: '🛖', name: 'Вместимость IV', desc: '+3000 к лимиту', price: 1500 },
    { id: 'nc5', icon: '🛖', name: 'Вместимость V', desc: '+5000 к лимиту', price: 3000 },
    { id: 'ss1', icon: '🪖', name: 'Сила солдат I', desc: '+10% к защите', price: 150 },
    { id: 'ss2', icon: '🪖', name: 'Сила солдат II', desc: '+20% к защите', price: 400 },
    { id: 'ss3', icon: '🪖', name: 'Сила солдат III', desc: '+30% к защите', price: 800 },
    { id: 'ss4', icon: '🪖', name: 'Сила солдат IV', desc: '+40% к защите', price: 1600 },
    { id: 'ss5', icon: '🪖', name: 'Сила солдат V', desc: '+50% к защите', price: 3200 },
    { id: 'qp1', icon: '👑', name: 'Феромон I', desc: '+5% к скорости', price: 200 },
    { id: 'qp2', icon: '👑', name: 'Феромон II', desc: '+10% к скорости', price: 500 },
    { id: 'qp3', icon: '👑', name: 'Феромон III', desc: '+15% к скорости', price: 1000 },
    { id: 'qp4', icon: '👑', name: 'Феромон IV', desc: '+20% к скорости', price: 2000 },
    { id: 'qp5', icon: '👑', name: 'Феромон V', desc: '+25% к скорости', price: 4000 },
    { id: 'gb1', icon: '🎮', name: 'Бонус игры I', desc: '+1 очко за нектар', price: 100 },
    { id: 'gb2', icon: '🎮', name: 'Бонус игры II', desc: '+2 очка за нектар', price: 250 },
    { id: 'gb3', icon: '🎮', name: 'Бонус игры III', desc: '+3 очка за нектар', price: 600 },
    { id: 'gb4', icon: '🎮', name: 'Бонус игры IV', desc: '+5 очков за нектар', price: 1200 },
    { id: 'gb5', icon: '🎮', name: 'Бонус игры V', desc: '+10 очков за нектар', price: 2500 },
    { id: 'te1', icon: '🎟️', name: 'Билеты I', desc: '+5 билетов к пополнению', price: 80 },
    { id: 'te2', icon: '🎟️', name: 'Билеты II', desc: '+10 билетов', price: 200 },
    { id: 'te3', icon: '🎟️', name: 'Билеты III', desc: '+15 билетов', price: 450 },
    { id: 'te4', icon: '🎟️', name: 'Билеты IV', desc: '+20 билетов', price: 900 },
    { id: 'te5', icon: '🎟️', name: 'Билеты V', desc: '+25 билетов', price: 1800 },
    { id: 'ph1', icon: '🌿', name: 'Пассивный I', desc: '+5% к пассивному мёду', price: 150 },
    { id: 'ph2', icon: '🌿', name: 'Пассивный II', desc: '+10% к пассивному', price: 400 },
    { id: 'ph3', icon: '🌿', name: 'Пассивный III', desc: '+15% к пассивному', price: 800 },
    { id: 'ph4', icon: '🌿', name: 'Пассивный IV', desc: '+20% к пассивному', price: 1600 },
    { id: 'ph5', icon: '🌿', name: 'Пассивный V', desc: '+25% к пассивному', price: 3200 },
    { id: 'sp1', icon: '⚡', name: 'Скорость I', desc: '+10% к переработке', price: 200 },
    { id: 'sp2', icon: '⚡', name: 'Скорость II', desc: '+20% к переработке', price: 500 },
    { id: 'sp3', icon: '💎', name: 'Удача I', desc: '-5% шанс мины', price: 300 },
    { id: 'sp4', icon: '💎', name: 'Удача II', desc: '-10% шанс мины', price: 750 },
    { id: 'sp5', icon: '🌟', name: 'Элитный', desc: 'Все бонусы +5%', price: 5000 },
];

const NECTAR_TYPES = ['🌸', '🌺', '🌼', '💮', '🪷'];
const MINE_TYPES = ['💣', '🐝'];

// ===== TELEGRAM WEB APP =====
const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#0B0E1A');
    tg.setBackgroundColor('#0B0E1A');
}

// ===== TON CONNECT =====
let tonConnectUI = null;
let isWalletConnected = false;

function initTonConnect() {
    try {
        tonConnectUI = new TONCONNECT_UI.TonConnectUI({
            manifestUrl: 'tonconnect-manifest.json',
        });
        tonConnectUI.onStatusChange((wallet) => {
            isWalletConnected = !!wallet;
            updateWalletButton();
        });
    } catch (err) {
        console.warn('TON Connect unavailable:', err);
    }
}

function updateWalletButton() {
    const text = document.getElementById('walletText');
    const icon = document.getElementById('walletIcon');
    const btn = document.getElementById('walletBtn');
    if (!text) return;

    if (isWalletConnected) {
        btn.classList.add('wallet-btn--connected');
        text.textContent = 'Подключён';
        icon.textContent = '✅';
    } else {
        btn.classList.remove('wallet-btn--connected');
        text.textContent = 'Connect';
        icon.textContent = '💎';
    }
}

async function handleWalletClick() {
    if (!tonConnectUI) { showToast('TON Connect недоступен'); return; }

    if (isWalletConnected) {
        try {
            await tonConnectUI.disconnect();
            isWalletConnected = false;
            updateWalletButton();
            showToast('Кошелёк отключён');
        } catch (err) {
            showToast('Ошибка отключения');
        }
    } else {
        try {
            await tonConnectUI.openModal();
        } catch (err) {
            showToast('Не удалось подключить кошелёк');
        }
    }
}

// ===== STATE =====
let state = {
    balance: 0,
    honey: 0,
    tickets: TICKETS_PER_RECHARGE,
    lastTicketsUpdate: Date.now(),

    // Apiary
    nests: 0,
    queens: 0,
    workers: 0,
    soldiers: 0,

    // Tool levels
    smokerLevel: 1,
    suitLevel: 1,
    extractorLevel: 1,

    // Purchase counts (for price calculation)
    workersBought: 0,
    soldiersBought: 0,
    queensBought: 0,
    nestsBought: 0,

    // Upgrade cards purchased
    upgrades: {},

    // Premium
    isPremium: false,

    // Passive honey tracking
    lastPassiveUpdate: Date.now(),

    // Referrals
    referralCount: 0,
    referralEarned: 0,

    // Game bonus from upgrades
    gameBonusPerNectar: 0,
    mineChanceReduction: 0,
    convertBonus: 0,
};

let passiveTimer = null;
let ticketInterval = null;

// ===== PERSISTENCE =====
function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state = { ...state, ...parsed };
        } catch (e) { /* ignore */ }
    }
    // Detect Telegram Premium
    if (tg?.initDataUnsafe?.user?.is_premium) {
        state.isPremium = true;
    }
    // Detect Admin (God Mode)
    if (tg?.initDataUnsafe?.user?.id === ADMIN_TELEGRAM_ID) {
        isAdmin = true;
        applyGodMode();
    }
}

function applyGodMode() {
    state.balance = 999999999;
    state.honey = 999999999;
    state.tickets = 999999;
    state.workers = MAX_WORKERS;
    state.soldiers = MAX_SOLDIERS;
    state.queens = MAX_QUEENS;
    state.nests = MAX_NESTS;
    state.smokerLevel = 100;
    state.suitLevel = 100;
    state.extractorLevel = 100;
    state.workersBought = 0;
    state.soldiersBought = 0;
    state.queensBought = 0;
    state.nestsBought = 0;
    // Unlock all upgrades
    for (const card of UPGRADE_CARDS) {
        state.upgrades[card.id] = true;
    }
    recalculateBonuses();
    saveState();
}

// ===== CALCULATED VALUES =====
function getActiveNests() {
    let active = 0;
    for (let i = 0; i < state.nests; i++) {
        const beesNeeded = BEES_PER_NEST;
        const beesInNest = Math.floor((state.workers + state.soldiers) / Math.max(state.nests, 1));
        if (beesInNest >= beesNeeded) active++;
    }
    // Simple: total bees across all nests vs nests * 10000
    const totalBeesAssigned = state.workers + state.soldiers + state.queens;
    const requiredForAll = state.nests * BEES_PER_NEST;
    if (requiredForAll === 0) return 0;
    return Math.min(state.nests, Math.floor(totalBeesAssigned / BEES_PER_NEST));
}

function getPassiveHoneyPerHour() {
    const activeNests = getActiveNests();
    let base = activeNests * PASSIVE_HONEY_PER_HOUR;
    // Smoker bonus
    base *= (1 + (state.smokerLevel - 1) * 0.1);
    // Suit bonus
    base *= (1 + (state.suitLevel - 1) * 0.05);
    // Upgrade bonuses
    let upgradeBonus = 0;
    for (const card of UPGRADE_CARDS) {
        if (state.upgrades[card.id]) {
            if (card.id.startsWith('ph')) upgradeBonus += parseInt(card.desc.match(/\+(\d+)/)?.[1] || 0) / 100;
            if (card.id === 'sp5') upgradeBonus += 0.05;
        }
    }
    base *= (1 + upgradeBonus);
    // Premium bonus
    if (state.isPremium) base *= (1 + PREMIUM_HONEY_BONUS);
    return Math.round(base);
}

function getBeePerConvert() {
    let base = BEE_PER_CONVERT_BASE;
    // Extractor level bonus
    base += (state.extractorLevel - 1) * 2;
    // Upgrade bonuses
    for (const card of UPGRADE_CARDS) {
        if (state.upgrades[card.id] && card.id.startsWith('tc')) {
            base += parseInt(card.desc.match(/\+(\d+)/)?.[1] || 0);
        }
    }
    if (state.upgrades['sp5']) base += 1;
    return base;
}

function getGameBonusPerNectar() {
    let bonus = 0;
    for (const card of UPGRADE_CARDS) {
        if (state.upgrades[card.id] && card.id.startsWith('gb')) {
            bonus += parseInt(card.desc.match(/\+(\d+)/)?.[1] || 0);
        }
    }
    if (state.upgrades['sp5']) bonus += 1;
    return bonus;
}

function getMineChance() {
    let chance = MINE_CHANCE;
    for (const card of UPGRADE_CARDS) {
        if (state.upgrades[card.id] && (card.id === 'sp3' || card.id === 'sp4')) {
            const reduction = parseInt(card.desc.match(/-(\d+)/)?.[1] || 0) / 100;
            chance -= reduction;
        }
    }
    return Math.max(0.05, chance);
}

function getToolPrice(tool) {
    const level = state[tool.id + 'Level'] || 1;
    return Math.round(tool.basePrice * Math.pow(2.5, level - 1));
}

function getToolPriceTon(tool) {
    const level = state[tool.id + 'Level'] || 1;
    return +(tool.basePriceTon * Math.pow(2.5, level - 1)).toFixed(2);
}

function getBeeItemPrice(item) {
    return item.basePrice + item.priceInc * state[item.id + 'Bought'];
}

function getBeeItemPriceTon(item) {
    return +(item.basePriceTon * (1 + state[item.id + 'Bought'] * 0.2)).toFixed(2);
}

function getMaxTickets() {
    let max = TICKETS_PER_RECHARGE;
    for (const card of UPGRADE_CARDS) {
        if (state.upgrades[card.id] && card.id.startsWith('te')) {
            max += parseInt(card.desc.match(/\+(\d+)/)?.[1] || 0);
        }
    }
    if (state.upgrades['sp5']) max += 5;
    return max;
}

// ===== UI UPDATES =====
function updateAllUI() {
    updateBalances();
    updateApiary();
    updateExtractor();
    updateTickets();
    updateTicketTimerDisplay();
    renderUpgradeGrid();
    renderShopTools();
    renderShopBees();
}

function updateBalances() {
    const balEl = document.getElementById('balance');
    const honeyEl = document.getElementById('honeyBalance');
    if (balEl) {
        balEl.textContent = formatNumber(state.balance);
        balEl.style.transform = 'scale(1.2)';
        setTimeout(() => { balEl.style.transform = 'scale(1)'; }, 200);
    }
    if (honeyEl) {
        honeyEl.textContent = formatNumber(state.honey);
    }
}

function updateApiary() {
    setText('nestsCount', state.nests);
    setText('queensCount', state.queens);
    setText('workersCount', formatNumber(state.workers));
    setText('soldiersCount', formatNumber(state.soldiers));
    setText('activeNests', getActiveNests());
    setText('passiveIncome', `+${getPassiveHoneyPerHour()} 🍯/час`);
}

function updateExtractor() {
    setText('extractorLvl', `LVL ${state.extractorLevel}`);
    setText('honeyStored', formatNumber(state.honey));
    setText('beePerConvert', getBeePerConvert());

    const progress = Math.min(state.honey / HONEY_PER_CONVERT, 1) * 100;
    const fill = document.getElementById('extractorFill');
    if (fill) fill.style.width = `${progress}%`;
    setText('extractorProgress', `${state.honey} / ${HONEY_PER_CONVERT}`);

    const btn = document.getElementById('extractorBtn');
    if (btn) btn.disabled = state.honey < HONEY_PER_CONVERT;
}

function updateTickets() {
    setText('ticketsCount', state.tickets);
    setText('mineTickets', state.tickets);

    const playBtn = document.getElementById('playBtn');
    if (playBtn) playBtn.disabled = state.tickets <= 0;

    // Also update play buttons in mine page
    document.querySelectorAll('.mine-game-preview .play-btn').forEach(btn => {
        btn.disabled = state.tickets <= 0;
    });
}

function updateTicketTimerDisplay() {
    const elapsed = Date.now() - state.lastTicketsUpdate;
    const remaining = TICKET_RECHARGE_INTERVAL - elapsed;
    const text = formatTime(Math.max(0, remaining));
    setText('ticketsTimerText', text);
    setText('mineTimer', text);
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 10000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString('ru-RU');
}

function formatTime(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ===== TICKET RECHARGE =====
function checkTicketRecharge() {
    const now = Date.now();
    const elapsed = now - state.lastTicketsUpdate;
    const maxTickets = getMaxTickets();

    if (elapsed >= TICKET_RECHARGE_INTERVAL) {
        const cycles = Math.floor(elapsed / TICKET_RECHARGE_INTERVAL);
        let bonus = 0;
        if (state.isPremium) bonus = PREMIUM_TICKET_BONUS;
        state.tickets = Math.min(state.tickets + cycles * (1 + bonus), maxTickets);
        state.lastTicketsUpdate += cycles * TICKET_RECHARGE_INTERVAL;
        saveState();
    }
}

function startTicketTimer() {
    if (ticketInterval) clearInterval(ticketInterval);
    ticketInterval = setInterval(() => {
        checkTicketRecharge();
        updateTickets();
        updateTicketTimerDisplay();
    }, 1000);
}

// ===== PASSIVE HONEY PRODUCTION =====
function processPassiveHoney() {
    const now = Date.now();
    const elapsed = now - state.lastPassiveUpdate;
    const hours = elapsed / (1000 * 60 * 60);
    const honeyRate = getPassiveHoneyPerHour();

    if (honeyRate > 0 && hours > 0.001) {
        const produced = Math.floor(honeyRate * hours);
        if (produced > 0) {
            state.honey += produced;
            state.lastPassiveUpdate = now;
            saveState();
            updateBalances();
            updateExtractor();
        }
    }
    state.lastPassiveUpdate = now;
}

function startPassiveTimer() {
    if (passiveTimer) clearInterval(passiveTimer);
    passiveTimer = setInterval(() => {
        processPassiveHoney();
    }, 10000); // every 10 seconds
}

// ===== HONEY EXTRACTOR =====
function processHoney() {
    if (!isAdmin && state.honey < HONEY_PER_CONVERT) {
        showToast('Недостаточно мёда!');
        return;
    }

    if (!isAdmin) state.honey -= HONEY_PER_CONVERT;
    const earned = getBeePerConvert();
    if (!isAdmin) state.balance += earned;
    else state.balance = 999999999; // Maintain infinity
    saveState();
    updateBalances();
    updateExtractor();
    haptic('success');
    showToast(`+${earned} $BEE!`);
    sendBotData({ action: 'extract_honey', earned, balance: state.balance, honey: state.honey });
}

// ===== SHOP: TOOLS =====
function renderShopTools() {
    const container = document.getElementById('shopTools');
    if (!container) return;
    container.innerHTML = '';

    TOOLS.forEach((tool, i) => {
        const level = state[tool.id + 'Level'] || 1;
        const price = getToolPrice(tool);
        const priceTon = getToolPriceTon(tool);
        const canAfford = state.balance >= price;

        const card = document.createElement('div');
        card.className = `shop-card${canAfford ? '' : ' shop-card--disabled'}`;
        card.style.animationDelay = `${0.05 + i * 0.05}s`;
        card.onclick = () => openPaymentModal({ ...tool, priceBee: price, priceTon: priceTon, isTool: true });
        card.innerHTML = `
            <div class="shop-card-icon">${tool.icon}</div>
            <div class="shop-card-info">
                <div class="shop-card-name">${tool.name}</div>
                <div class="shop-card-desc">${tool.desc}</div>
            </div>
            <div class="shop-card-right">
                <div class="shop-card-price">${formatNumber(price)} $BEE</div>
                <div class="shop-card-level">LVL ${level} → ${level + 1}</div>
            </div>
        `;
        container.appendChild(card);
    });
}

// ===== SHOP: BEES =====
function renderShopBees() {
    const container = document.getElementById('shopBees');
    if (!container) return;
    container.innerHTML = '';

    BEE_ITEMS.forEach((item, i) => {
        const bought = state[item.id + 'Bought'] || 0;
        const currentAmount = state[item.id] || 0;
        const price = getBeeItemPrice(item);
        const priceTon = getBeeItemPriceTon(item);
        const canAfford = state.balance >= price;
        const atMax = currentAmount >= item.maxAmount;

        const card = document.createElement('div');
        card.className = `shop-card${canAfford && !atMax ? '' : ' shop-card--disabled'}`;
        card.style.animationDelay = `${0.05 + i * 0.05}s`;
        if (!atMax) {
            card.onclick = () => openPaymentModal({ ...item, priceBee: price, priceTon: priceTon, isBeeItem: true });
        }
        card.innerHTML = `
            <div class="shop-card-icon">${item.icon}</div>
            <div class="shop-card-info">
                <div class="shop-card-name">${item.name}</div>
                <div class="shop-card-desc">${item.desc}</div>
            </div>
            <div class="shop-card-right">
                <div class="shop-card-price">${atMax ? 'МАКС' : formatNumber(price) + ' $BEE'}</div>
                <div class="shop-card-count">Куплено: ${bought} шт.</div>
            </div>
        `;
        container.appendChild(card);
    });
}

// ===== UPGRADE GRID (50 cards) =====
function renderUpgradeGrid() {
    const grid = document.getElementById('upgradeGrid');
    if (!grid) return;
    grid.innerHTML = '';

    UPGRADE_CARDS.forEach((card, i) => {
        const purchased = !!state.upgrades[card.id];
        const canAfford = state.balance >= card.price;

        const el = document.createElement('div');
        el.className = `upgrade-card${purchased ? ' purchased' : ''}`;
        el.style.animationDelay = `${Math.min(0.02 * i, 0.8)}s`;

        if (!purchased && canAfford) {
            el.onclick = () => buyUpgrade(card);
        } else if (!purchased) {
            el.style.opacity = '0.5';
        }

        el.innerHTML = `
            <div class="upgrade-icon">${card.icon}</div>
            <div class="upgrade-name">${card.name}</div>
            <div class="upgrade-desc">${card.desc}</div>
            ${purchased
                ? '<div class="upgrade-buy-label">✅ Куплено</div>'
                : `<div class="upgrade-cost">${formatNumber(card.price)} $BEE</div>`
            }
        `;
        grid.appendChild(el);
    });
}

function buyUpgrade(card) {
    if (state.upgrades[card.id]) {
        showToast('Уже куплено!');
        return;
    }
    if (!isAdmin && state.balance < card.price) {
        showToast('Недостаточно токенов!');
        return;
    }

    if (!isAdmin) state.balance -= card.price;
    state.upgrades[card.id] = true;

    // Recalculate derived bonuses
    recalculateBonuses();
    saveState();
    updateAllUI();
    haptic('success');
    showToast(`Улучшено: ${card.name}!`);
    sendBotData({ action: 'buy_upgrade', cardId: card.id, balance: state.balance });
}

function recalculateBonuses() {
    state.gameBonusPerNectar = getGameBonusPerNectar();
    state.mineChanceReduction = MINE_CHANCE - getMineChance();
    state.convertBonus = getBeePerConvert() - BEE_PER_CONVERT_BASE;
}

// ===== PAYMENT MODAL =====
let currentModalItem = null;

function openPaymentModal(item) {
    currentModalItem = item;
    document.getElementById('modalItemName').textContent = `Купить «${item.name}»`;
    document.getElementById('payBeePrice').textContent = `${formatNumber(item.priceBee)} $BEE`;
    document.getElementById('payTonPrice').textContent = `${item.priceTon} TON`;

    const tonBtn = document.getElementById('payWithTon');
    if (!isWalletConnected) {
        tonBtn.classList.add('payment-option--disabled');
        tonBtn.title = 'Сначала подключите кошелёк';
    } else {
        tonBtn.classList.remove('payment-option--disabled');
        tonBtn.title = '';
    }

    document.getElementById('paymentModal').style.display = 'flex';
}

function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
    currentModalItem = null;
}

async function confirmPayment(method) {
    if (!currentModalItem) return;

    if (method === 'ton' && !isWalletConnected) {
        showToast('Сначала подключите TON кошелёк!');
        closePaymentModal();
        handleWalletClick();
        return;
    }

    if (method === 'bee') {
        buyItemBee(currentModalItem);
    } else {
        await buyItemTon(currentModalItem);
    }
}

function buyItemBee(item) {
    if (!isAdmin && state.balance < item.priceBee) {
        showToast('Недостаточно токенов!');
        closePaymentModal();
        return;
    }

    if (!isAdmin) state.balance -= item.priceBee;

    if (item.isTool) {
        state[item.id + 'Level'] = (state[item.id + 'Level'] || 1) + 1;
        recalculateBonuses();
    } else if (item.isBeeItem) {
        const current = state[item.id] || 0;
        if (current + item.amount > item.maxAmount) {
            state.balance += item.priceBee;
            showToast('Достигнут максимум!');
            closePaymentModal();
            return;
        }
        state[item.id] = current + item.amount;
        state[item.id + 'Bought'] = (state[item.id + 'Bought'] || 0) + 1;
    }

    saveState();
    updateAllUI();
    haptic('light');
    showToast(`Куплено: ${item.name}!`);
    closePaymentModal();
    sendBotData({ action: 'buy_bee', itemId: item.id, balance: state.balance });
}

async function buyItemTon(item) {
    if (!tonConnectUI || !isWalletConnected) {
        showToast('Кошелёк не подключён!');
        closePaymentModal();
        return;
    }

    if (ADMIN_WALLET_ADDRESS === "YOUR_WALLET_ADDRESS") {
        showToast('Адрес кошелька не настроен!');
        closePaymentModal();
        return;
    }

    const nanoTon = String(Math.round(item.priceTon * 1e9));

    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [{
            address: ADMIN_WALLET_ADDRESS,
            amount: nanoTon,
        }],
    };

    try {
        showToast('Откройте кошелёк для подтверждения...');
        const result = await tonConnectUI.sendTransaction(transaction);

        if (item.isTool) {
            state[item.id + 'Level'] = (state[item.id + 'Level'] || 1) + 1;
            recalculateBonuses();
        } else if (item.isBeeItem) {
            state[item.id] = (state[item.id] || 0) + item.amount;
            state[item.id + 'Bought'] = (state[item.id + 'Bought'] || 0) + 1;
        }

        saveState();
        updateAllUI();
        haptic('success');
        showToast(`Куплено: ${item.name}!`);

        sendBotData({
            action: 'buy_ton',
            itemId: item.id,
            tonAmount: item.priceTon,
            txHash: result.boc || 'unknown',
        });
    } catch (err) {
        if (err?.message?.includes('Rejected') || err?.message?.includes('rejected')) {
            showToast('Транзакция отменена');
        } else {
            showToast('Ошибка транзакции');
        }
    }

    closePaymentModal();
}

// ===== GAME (Blum-style with Mines) =====
let gameState = {
    active: false,
    score: 0,
    timeLeft: GAME_DURATION,
    spawnTimer: null,
    countdownTimer: null,
    nectars: [],
};

function startGame() {
    if (!isAdmin && state.tickets <= 0) {
        showToast('Нет билетов!');
        return;
    }

    if (!isAdmin) state.tickets--;
    saveState();
    updateTickets();

    const bonus = getGameBonusPerNectar();
    gameState = {
        active: true,
        score: 0,
        timeLeft: GAME_DURATION,
        spawnTimer: null,
        countdownTimer: null,
        nectars: [],
        bonusPerNectar: bonus,
        mineChance: getMineChance(),
    };

    document.getElementById('gameModal').style.display = 'flex';
    document.getElementById('gameScore').textContent = '0';
    document.getElementById('gameTimer').textContent = GAME_DURATION;
    document.getElementById('gameTimer').style.color = '';
    document.getElementById('gameStartOverlay').style.display = 'flex';

    document.querySelector('.bottom-nav').classList.add('game-active');
    document.querySelector('.app-header').classList.add('game-active');
    document.body.classList.add('game-mode');

    haptic('medium');

    setTimeout(() => {
        document.getElementById('gameStartOverlay').style.display = 'none';
        runGame();
    }, 1500);
}

function runGame() {
    gameState.active = true;

    gameState.spawnTimer = setInterval(spawnNectar, NECTAR_SPAWN_INTERVAL);

    gameState.countdownTimer = setInterval(() => {
        gameState.timeLeft--;
        document.getElementById('gameTimer').textContent = gameState.timeLeft;

        if (gameState.timeLeft <= 5) {
            document.getElementById('gameTimer').style.color = '#FC8181';
        }

        if (gameState.timeLeft <= 0) {
            endGame();
        }
    }, 1000);

    requestAnimationFrame(animateNectars);
}

function spawnNectar() {
    if (!gameState.active) return;

    const field = document.getElementById('gameField');
    const fieldRect = field.getBoundingClientRect();

    for (let b = 0; b < NECTAR_BATCH_SIZE; b++) {
        const isMine = Math.random() < gameState.mineChance;

        const el = document.createElement('div');
        el.className = 'nectar' + (isMine ? ' nectar--mine' : '');

        if (isMine) {
            el.textContent = MINE_TYPES[Math.floor(Math.random() * MINE_TYPES.length)];
        } else {
            el.textContent = NECTAR_TYPES[Math.floor(Math.random() * NECTAR_TYPES.length)];
        }

        const x = Math.random() * (fieldRect.width - 48);
        el.style.left = `${x}px`;
        el.style.top = '-50px';

        const speed = 1.5 + Math.random() * 2;
        const wobble = (Math.random() - 0.5) * 0.5;

        // Use pointerdown for instant mobile response
        const handler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.removeEventListener('pointerdown', handler);
            if (isMine) {
                hitMine(el);
            } else {
                collectNectar(el);
            }
        };
        el.addEventListener('pointerdown', handler, { passive: false });

        field.appendChild(el);
        gameState.nectars.push({ el, x, y: -50, speed, wobble, alive: true, isMine });
    }
}

function collectNectar(el) {
    if (!el.classList.contains('nectar') || el.classList.contains('nectar-collect')) return;

    const points = 1 + gameState.bonusPerNectar;
    gameState.score += points;

    document.getElementById('gameScore').textContent = gameState.score;
    document.getElementById('gameScore').style.transform = 'scale(1.3)';
    setTimeout(() => { document.getElementById('gameScore').style.transform = 'scale(1)'; }, 150);

    el.classList.add('nectar-collect');
    haptic('light');

    spawnFloatText(el, `+${points}`, 'positive');

    const nectarObj = gameState.nectars.find(n => n.el === el);
    if (nectarObj) nectarObj.alive = false;

    setTimeout(() => el.remove(), 300);
}

function hitMine(el) {
    if (!el.classList.contains('nectar') || el.classList.contains('nectar-mine-hit')) return;

    gameState.score = Math.max(0, gameState.score - MINE_PENALTY);

    document.getElementById('gameScore').textContent = gameState.score;
    document.getElementById('gameScore').style.transform = 'scale(1.3)';
    setTimeout(() => { document.getElementById('gameScore').style.transform = 'scale(1)'; }, 150);

    el.classList.add('nectar-mine-hit');
    haptic('error');

    spawnFloatText(el, `-${MINE_PENALTY}`, 'negative');

    // Screen shake
    const field = document.getElementById('gameField');
    field.classList.add('shake');
    setTimeout(() => field.classList.remove('shake'), 400);

    const nectarObj = gameState.nectars.find(n => n.el === el);
    if (nectarObj) nectarObj.alive = false;

    setTimeout(() => el.remove(), 500);
}

function spawnFloatText(el, text, type) {
    const field = document.getElementById('gameField');
    const rect = el.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();

    const floater = document.createElement('div');
    floater.className = `tap-float tap-float--${type}`;
    floater.textContent = text;
    floater.style.left = `${rect.left - fieldRect.left + 10}px`;
    floater.style.top = `${rect.top - fieldRect.top - 10}px`;

    field.appendChild(floater);
    setTimeout(() => floater.remove(), 800);
}

function animateNectars() {
    if (!gameState.active) return;

    const field = document.getElementById('gameField');
    const fieldHeight = field.getBoundingClientRect().height;

    gameState.nectars.forEach(n => {
        if (!n.alive) return;
        n.y += n.speed;
        n.x += n.wobble;
        n.el.style.top = `${n.y}px`;
        n.el.style.left = `${n.x}px`;

        if (n.y > fieldHeight + 50) {
            n.alive = false;
            n.el.remove();
        }
    });

    gameState.nectars = gameState.nectars.filter(n => n.alive);

    if (gameState.active) {
        requestAnimationFrame(animateNectars);
    }
}

function endGame() {
    gameState.active = false;
    clearInterval(gameState.spawnTimer);
    clearInterval(gameState.countdownTimer);

    gameState.nectars.forEach(n => { if (n.el.parentNode) n.el.remove(); });
    gameState.nectars = [];

    const earned = gameState.score;
    state.balance += earned;
    saveState();
    updateBalances();

    document.getElementById('gameTimer').style.color = '';

    setTimeout(() => {
        document.getElementById('gameModal').style.display = 'none';
        document.getElementById('resultAmount').textContent = earned;
        document.getElementById('resultModal').style.display = 'flex';

        document.querySelector('.bottom-nav').classList.remove('game-active');
        document.querySelector('.app-header').classList.remove('game-active');
        document.body.classList.remove('game-mode');

        haptic('success');
        sendBotData({ action: 'game_result', earned, balance: state.balance });
    }, 300);
}

function closeGame() {
    if (gameState.active) {
        endGame();
    } else {
        document.getElementById('gameModal').style.display = 'none';
        document.querySelector('.bottom-nav').classList.remove('game-active');
        document.querySelector('.app-header').classList.remove('game-active');
        document.body.classList.remove('game-mode');
    }
}

function closeResultModal() {
    document.getElementById('resultModal').style.display = 'none';
}

// ===== LEADERBOARD =====
async function loadLeaderboard() {
    const cupList = document.getElementById('cupList');
    if (!cupList) return;

    // Try fetching from API
    if (API_URL) {
        try {
            const userId = tg?.initDataUnsafe?.user?.id || 0;
            const resp = await fetch(`${API_URL}/api/leaderboard?user_id=${userId}`);
            const data = await resp.json();
            renderLeaderboard(data.top, data.userRank);
            return;
        } catch (e) {
            console.warn('Leaderboard API unavailable, using local data');
        }
    }

    // Fallback: send request to bot
    sendBotData({ action: 'get_leaderboard' });
    cupList.innerHTML = '<div class="cup-loading">Откройте чат бота для просмотра рейтинга<br>или настройте API_URL</div>';
}

function renderLeaderboard(top, userRank) {
    const cupList = document.getElementById('cupList');
    if (!cupList) return;

    if (!top || top.length === 0) {
        cupList.innerHTML = '<div class="cup-loading">Пока нет данных о рейтинге</div>';
        return;
    }

    cupList.innerHTML = '';

    top.forEach((user, i) => {
        const entry = document.createElement('div');
        entry.className = 'cup-entry';
        const medals = ['🥇', '🥈', '🥉'];
        const rank = i < 3 ? medals[i] : `${i + 1}`;

        entry.innerHTML = `
            <div class="cup-rank">${rank}</div>
            <div class="cup-user-info">
                <div class="cup-username">${user.username || 'Игрок'}</div>
            </div>
            <div class="cup-user-score">${formatNumber(user.balance)} $BEE</div>
        `;
        cupList.appendChild(entry);
    });

    if (userRank) {
        setText('cupMyPlace', `№${userRank}`);
    }
}

// ===== NAVIGATION =====
function switchPage(pageId, navBtn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    document.getElementById(pageId).classList.add('active');
    navBtn.classList.add('active');
    haptic('light');

    // Load leaderboard when switching to Cup tab
    if (pageId === 'pageCup') {
        loadLeaderboard();
    }
}

// ===== REFERRALS =====
let botUsername = BOT_USERNAME_DEFAULT;

function setupReferrals() {
    if (tg?.initDataUnsafe?.user?.id) {
        const userId = tg.initDataUnsafe.user.id;
        const link = `https://t.me/${botUsername}?start=ref${userId}`;
        const input = document.getElementById('referralLink');
        if (input) input.value = link;
    }
}

function setBotUsername(name) {
    if (name) {
        botUsername = name;
        localStorage.setItem('bee_bot_username', name);
        setupReferrals(); // Rebuild link with correct bot name
    }
}

function copyReferral() {
    const input = document.getElementById('referralLink');
    if (input) {
        input.select();
        try {
            navigator.clipboard.writeText(input.value);
            showToast('Скопировано!');
        } catch {
            document.execCommand('copy');
            showToast('Скопировано!');
        }
    }
}

function shareReferral() {
    const link = document.getElementById('referralLink')?.value;
    if (tg && link) {
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('🐝 Присоединяйся к Bee Empire!')}`);
    } else {
        copyReferral();
    }
}

// ===== EXCHANGE ALL HONEY =====
function exchangeAllHoney() {
    if (!isAdmin && state.honey < HONEY_PER_CONVERT) {
        showToast('Недостаточно мёда для обмена!');
        return;
    }
    if (!isAdmin && state.honey <= 0) {
        showToast('Мёд закончился!');
        return;
    }

    let totalConverted = 0;
    let honeyUsed = 0;

    if (isAdmin) {
        // Admin: convert unlimited
        totalConverted = state.honey;
        honeyUsed = state.honey;
        state.balance = 999999999;
        state.honey = 999999999;
    } else {
        // Normal: convert all available honey
        const batches = Math.floor(state.honey / HONEY_PER_CONVERT);
        honeyUsed = batches * HONEY_PER_CONVERT;
        totalConverted = batches * getBeePerConvert();
        state.honey -= honeyUsed;
        state.balance += totalConverted;
    }

    saveState();
    updateBalances();
    updateExtractor();
    haptic('success');
    showToast(`+${totalConverted.toLocaleString('ru-RU')} $BEE обменяно!`);
    sendBotData({ action: 'exchange_honey', earned: totalConverted, balance: state.balance, honey: state.honey });
}

// ===== LIVE CHART =====
let chartData = [];
let chartAnimFrame = null;

function initLiveChart() {
    const canvas = document.getElementById('liveChartCanvas');
    if (!canvas) return;

    // Generate initial data points
    for (let i = 0; i < 60; i++) {
        chartData.push(50 + Math.random() * 30);
    }

    function drawChart() {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        // Shift old data, add new point
        const last = chartData[chartData.length - 1];
        const delta = (Math.random() - 0.48) * 6; // Slight upward bias
        chartData.push(Math.max(10, Math.min(90, last + delta)));
        if (chartData.length > 60) chartData.shift();

        // Clear
        ctx.clearRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let y = 0; y < h; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        // Gradient fill
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, 'rgba(72, 187, 120, 0.25)');
        gradient.addColorStop(1, 'rgba(72, 187, 120, 0.0)');

        const stepX = w / (chartData.length - 1);

        ctx.beginPath();
        ctx.moveTo(0, h);
        chartData.forEach((val, i) => {
            const x = i * stepX;
            const y = h - (val / 100) * h;
            if (i === 0) ctx.lineTo(x, y);
            else {
                const prevX = (i - 1) * stepX;
                const prevY = h - (chartData[i - 1] / 100) * h;
                const cpx = (prevX + x) / 2;
                ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
            }
        });
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Line stroke
        ctx.beginPath();
        chartData.forEach((val, i) => {
            const x = i * stepX;
            const y = h - (val / 100) * h;
            if (i === 0) ctx.moveTo(x, y);
            else {
                const prevX = (i - 1) * stepX;
                const prevY = h - (chartData[i - 1] / 100) * h;
                const cpx = (prevX + x) / 2;
                ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
            }
        });
        ctx.strokeStyle = '#48BB78';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Current price dot
        const lastX = (chartData.length - 1) * stepX;
        const lastY = h - (chartData[chartData.length - 1] / 100) * h;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#48BB78';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Update rate display
        const rate = (chartData[chartData.length - 1] / 500).toFixed(4);
        setText('liveRate', `1 🍯 = ${rate} $BEE`);

        chartAnimFrame = requestAnimationFrame(drawChart);
    }

    // Start animation loop
    chartAnimFrame = requestAnimationFrame(drawChart);
}

// ===== UTILITIES =====
function haptic(type) {
    if (!tg?.HapticFeedback) return;
    if (type === 'success' || type === 'error' || type === 'warning') {
        tg.HapticFeedback.notificationOccurred(type);
    } else {
        tg.HapticFeedback.impactOccurred(type);
    }
}

function sendBotData(data) {
    if (tg) {
        tg.sendData(JSON.stringify(data));
    }
}

let toastTimeout = null;
function showToast(message, isError = false) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = 'toast' + (isError ? ' toast--error' : '');
    toast.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== INIT =====
function init() {
    loadState();
    checkTicketRecharge();
    processPassiveHoney();
    recalculateBonuses();

    updateAllUI();
    renderUpgradeGrid();
    setupReferrals();
    initTonConnect();
    startTicketTimer();
    startPassiveTimer();
    initLiveChart();

    // Request bot username from bot
    sendBotData({ action: 'get_bot_username' });

    // Listen for bot messages containing bot username
    if (tg?.onEvent) {
        tg.onEvent('mainButtonClicked', () => {});
        tg.onEvent('backButtonClicked', () => {});
    }

    // Check localStorage for cached bot username
    const cached = localStorage.getItem('bee_bot_username');
    if (cached) botUsername = cached;
}

document.addEventListener('DOMContentLoaded', init);
