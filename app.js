/**
 * Bee Empire — Main Application Logic
 * Hamster Kombat + Blum mechanics, TON Connect integration
 */

// ===== CONFIGURATION =====
const ADMIN_WALLET_ADDRESS = "UQDeGY3zk1PQK5PKyGr8KsDL7tvRVYL7xpKc0DfoDxSSsunU";

const COLLECTION_DURATION = 8 * 60 * 60 * 1000; // 8 hours
const REWARD_PER_CYCLE = 100;
const TICKETS_PER_RECHARGE = 50;
const TICKET_RECHARGE_INTERVAL = 8 * 60 * 60 * 1000; // 8 hours
const GAME_DURATION = 30; // seconds
const NECTAR_SPAWN_INTERVAL = 600; // ms between spawns
const STORAGE_KEY = 'bee_empire_data';

const SHOP_ITEMS = [
    { id: 'smoker',    name: 'Дымарь',    icon: '💨', priceBee: 50,   priceTon: 0.05 },
    { id: 'suit',      name: 'Костюм',    icon: '🥽', priceBee: 200,  priceTon: 0.1  },
    { id: 'extractor', name: 'Медогонка', icon: '⚙️', priceBee: 500,  priceTon: 0.25 },
    { id: 'queen',     name: 'Матка',     icon: '👑', priceBee: 1000, priceTon: 0.5  },
];

const NECTAR_TYPES = ['🌸', '🌺', '🌼', '💮', '🪷'];

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
    isCollecting: false,
    startTime: null,
    cycleCount: 0,
    items: {},
    tickets: TICKETS_PER_RECHARGE,
    lastTicketsUpdate: Date.now(),
    tapCount: 0,
};

let timerInterval = null;
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
}

// ===== UI UPDATES =====
function updateBalance() {
    const el = document.getElementById('balance');
    if (!el) return;
    el.textContent = state.balance.toLocaleString('ru-RU');
    el.style.transform = 'scale(1.2)';
    setTimeout(() => { el.style.transform = 'scale(1)'; }, 200);
}

function updateCycleCount() {
    const el = document.getElementById('cycleCount');
    if (el) el.textContent = state.cycleCount;
}

function updateTickets() {
    const el = document.getElementById('ticketsCount');
    const mineEl = document.getElementById('mineTickets');
    if (el) el.textContent = state.tickets;
    if (mineEl) mineEl.textContent = state.tickets;

    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
        playBtn.disabled = state.tickets <= 0;
    }
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

    if (elapsed >= TICKET_RECHARGE_INTERVAL) {
        const cycles = Math.floor(elapsed / TICKET_RECHARGE_INTERVAL);
        state.tickets = Math.min(state.tickets + cycles * TICKETS_PER_RECHARGE, TICKETS_PER_RECHARGE);
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

function updateTicketTimerDisplay() {
    const elapsed = Date.now() - state.lastTicketsUpdate;
    const remaining = TICKET_RECHARGE_INTERVAL - elapsed;
    const text = formatTime(Math.max(0, remaining));
    const el = document.getElementById('ticketsTimerText');
    const mineEl = document.getElementById('mineTimer');
    if (el) el.textContent = text;
    if (mineEl) mineEl.textContent = text;
}

// ===== COLLECTION (8-hour cycle) =====
function handleAction() {
    if (state.isCollecting) {
        if (Date.now() - state.startTime >= COLLECTION_DURATION) {
            collectReward();
        }
    } else {
        startCollection();
    }
}

function startCollection() {
    state.isCollecting = true;
    state.startTime = Date.now();
    saveState();
    setCollectingMode();
    startCollectionTimer();
    haptic('medium');
    showToast('Пчёлы вылетели за нектаром!');
}

function collectReward() {
    state.balance += REWARD_PER_CYCLE;
    state.cycleCount++;
    state.isCollecting = false;
    state.startTime = null;
    saveState();
    updateBalance();
    updateCycleCount();
    setStartMode();
    haptic('success');
    showToast(`+${REWARD_PER_CYCLE} $BEE начислено!`);
    sendBotData({ action: 'collect_reward', amount: REWARD_PER_CYCLE, balance: state.balance });
}

function setCollectingMode() {
    const btn = document.getElementById('collectionBtn');
    const text = document.getElementById('collectionBtnText');
    const status = document.getElementById('collectionStatus');
    const progressWrap = document.getElementById('collectionProgressWrap');
    const card = document.getElementById('collectionCard');

    btn.classList.remove('ready');
    text.textContent = 'Сбор нектара...';
    btn.disabled = true;
    status.textContent = 'Сбор...';
    status.classList.add('collecting');
    progressWrap.style.display = 'block';
    card.classList.add('active');
}

function setReadyToCollectMode() {
    const btn = document.getElementById('collectionBtn');
    const text = document.getElementById('collectionBtnText');
    const status = document.getElementById('collectionStatus');
    const fill = document.getElementById('progressFill');
    const card = document.getElementById('collectionCard');

    btn.disabled = false;
    btn.classList.add('ready');
    text.textContent = '🍯 Забрать мёд';
    status.textContent = 'Готово!';
    status.classList.remove('collecting');
    fill.style.width = '100%';
    document.getElementById('progressTime').textContent = '0:00:00';
    document.getElementById('progressPercent').textContent = '100%';
}

function setStartMode() {
    const btn = document.getElementById('collectionBtn');
    const text = document.getElementById('collectionBtnText');
    const status = document.getElementById('collectionStatus');
    const progressWrap = document.getElementById('collectionProgressWrap');
    const card = document.getElementById('collectionCard');

    btn.disabled = false;
    btn.classList.remove('ready');
    text.textContent = 'Запустить сбор';
    status.textContent = 'Готов';
    status.classList.remove('collecting');
    progressWrap.style.display = 'none';
    card.classList.remove('active');
}

function startCollectionTimer() {
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        const elapsed = Date.now() - state.startTime;
        const remaining = COLLECTION_DURATION - elapsed;
        const progress = Math.min(elapsed / COLLECTION_DURATION, 1);

        if (remaining <= 0) {
            clearInterval(timerInterval);
            state.isCollecting = false;
            saveState();
            setReadyToCollectMode();
            haptic('success');
            return;
        }

        document.getElementById('progressFill').style.width = `${progress * 100}%`;
        document.getElementById('progressTime').textContent = formatTime(remaining);
        document.getElementById('progressPercent').textContent = `${Math.floor(progress * 100)}%`;
    }, 1000);
}

// ===== QUEEN BEE TAP =====
let lastTapTime = 0;

function handleQueenTap(e) {
    const now = Date.now();
    if (now - lastTapTime < 50) return; // debounce 50ms
    lastTapTime = now;

    e.preventDefault();
    state.tapCount++;
    state.balance += 1;
    saveState();
    updateBalance();
    haptic('light');
    spawnTapFloat(e);
}

function spawnTapFloat(e) {
    const queen = document.getElementById('queenBee');
    const rect = queen.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'tap-float';
    el.textContent = '+1';

    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left + (Math.random() * 20 - 10);
    const y = -10;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    queen.appendChild(el);

    setTimeout(() => el.remove(), 800);
}

// ===== GAME (Blum-style) =====
let gameState = {
    active: false,
    score: 0,
    timeLeft: GAME_DURATION,
    spawnTimer: null,
    countdownTimer: null,
    nectars: [],
};

function startGame() {
    if (state.tickets <= 0) {
        showToast('Нет билетов!');
        return;
    }

    state.tickets--;
    saveState();
    updateTickets();

    gameState = { active: true, score: 0, timeLeft: GAME_DURATION, spawnTimer: null, countdownTimer: null, nectars: [] };

    document.getElementById('gameModal').style.display = 'flex';
    document.getElementById('gameScore').textContent = '0';
    document.getElementById('gameTimer').textContent = GAME_DURATION;
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

    // Start animation loop
    requestAnimationFrame(animateNectars);
}

function spawnNectar() {
    if (!gameState.active) return;

    const field = document.getElementById('gameField');
    const fieldRect = field.getBoundingClientRect();

    const nectar = document.createElement('div');
    nectar.className = 'nectar' + (Math.random() < 0.15 ? ' nectar--gold' : '');
    const type = NECTAR_TYPES[Math.floor(Math.random() * NECTAR_TYPES.length)];
    nectar.textContent = type;

    const x = Math.random() * (fieldRect.width - 48);
    nectar.style.left = `${x}px`;
    nectar.style.top = '-50px';

    const speed = 1.5 + Math.random() * 2; // px per frame
    const wobble = (Math.random() - 0.5) * 0.5;
    const isGold = nectar.classList.contains('nectar--gold');

    nectar.addEventListener('click', (e) => {
        e.stopPropagation();
        collectNectar(nectar, isGold);
    });

    field.appendChild(nectar);
    gameState.nectars.push({ el: nectar, x, y: -50, speed, wobble, alive: true });

    requestAnimationFrame(() => {
        nectar.style.transition = 'left 0.3s ease';
    });
}

function collectNectar(el, isGold) {
    if (!el.classList.contains('nectar') || el.classList.contains('nectar-collect')) return;

    const points = isGold ? 5 : 1;
    gameState.score += points;

    document.getElementById('gameScore').textContent = gameState.score;
    document.getElementById('gameScore').style.transform = 'scale(1.3)';
    setTimeout(() => { document.getElementById('gameScore').style.transform = 'scale(1)'; }, 150);

    el.classList.add('nectar-collect');
    haptic('light');

    // Mark as dead in gameState so animation loop skips it
    const nectarObj = gameState.nectars.find(n => n.el === el);
    if (nectarObj) nectarObj.alive = false;

    setTimeout(() => {
        el.remove();
    }, 300);
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

    // Remove all remaining nectars
    gameState.nectars.forEach(n => { if (n.el.parentNode) n.el.remove(); });
    gameState.nectars = [];

    // Add earnings to balance
    const earned = gameState.score;
    state.balance += earned;
    saveState();
    updateBalance();

    document.getElementById('gameTimer').style.color = '';

    // Show result
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

function closeResultModal() {
    document.getElementById('resultModal').style.display = 'none';
}

// ===== NAVIGATION =====
function switchPage(pageId, navBtn) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    document.getElementById(pageId).classList.add('active');
    navBtn.classList.add('active');
    haptic('light');
}

// ===== SHOP =====
function renderShop() {
    const grid = document.getElementById('shopGrid');
    grid.innerHTML = '';

    SHOP_ITEMS.forEach((item, i) => {
        const card = document.createElement('div');
        card.className = 'shop-card';
        card.style.animationDelay = `${0.1 + i * 0.05}s`;
        card.onclick = () => openPaymentModal(item);
        card.innerHTML = `
            <div class="shop-item-icon">${item.icon}</div>
            <div class="shop-item-name">${item.name}</div>
            <span class="shop-price-tag shop-price-tag--bee">${item.priceBee} $BEE</span>
            <div class="shop-price-divider">или</div>
            <span class="shop-price-tag shop-price-tag--ton">${item.priceTon} TON</span>
        `;
        grid.appendChild(card);
    });
}

// ===== PAYMENT MODAL =====
let currentModalItem = null;

function openPaymentModal(item) {
    currentModalItem = item;
    document.getElementById('modalItemName').textContent = `Купить «${item.name}»`;
    document.getElementById('payBeePrice').textContent = `${item.priceBee} $BEE`;
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
    if (state.balance < item.priceBee) {
        showToast('Недостаточно токенов!');
        closePaymentModal();
        return;
    }

    state.balance -= item.priceBee;
    state.items[item.id] = (state.items[item.id] || 0) + 1;
    saveState();
    updateBalance();
    haptic('light');
    showToast(`Куплено: ${item.name}!`);
    closePaymentModal();
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

        state.items[item.id] = (state.items[item.id] || 0) + 1;
        saveState();
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

// ===== REFERRALS =====
function setupReferrals() {
    if (tg?.initDataUnsafe?.user?.id) {
        const userId = tg.initDataUnsafe.user.id;
        const link = `https://t.me/${tg.initDataUnsafe.user.username || 'BeeEmpireBot'}?start=ref${userId}`;
        const input = document.getElementById('referralLink');
        if (input) input.value = link;
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
function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== INIT =====
function init() {
    loadState();
    checkTicketRecharge();

    // Queen Bee tap — unified touch/mouse handler
    const queenEl = document.getElementById('queenBee');
    if (queenEl) {
        let touchHandled = false;
        queenEl.addEventListener('touchstart', (e) => {
            touchHandled = true;
            handleQueenTap(e);
        }, { passive: false });
        queenEl.addEventListener('mousedown', (e) => {
            if (touchHandled) { touchHandled = false; return; }
            handleQueenTap(e);
        });
    }

    // Restore collection state
    if (state.isCollecting && state.startTime) {
        if (Date.now() - state.startTime >= COLLECTION_DURATION) {
            state.isCollecting = false;
            saveState();
            setReadyToCollectMode();
        } else {
            setCollectingMode();
            startCollectionTimer();
        }
    } else {
        setStartMode();
    }

    updateBalance();
    updateCycleCount();
    updateTickets();
    updateTicketTimerDisplay();
    renderShop();
    setupReferrals();
    initTonConnect();
    startTicketTimer();
}

document.addEventListener('DOMContentLoaded', init);
