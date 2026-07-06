"""
Telegram Bot for Bee Empire Mini App v2
Uses aiogram 3.x with SQLite database
Includes: honey shop, order system, leaderboard API, admin panel
"""

import os
import json
import sqlite3
from datetime import datetime
from aiogram import Bot, Dispatcher, F
from aiogram.types import (
    Message,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    WebAppInfo,
    CallbackQuery,
)
from aiogram.filters import CommandStart, Command
from aiogram.enums import ParseMode
import asyncio
import aiohttp
from aiohttp import web

# ===== Settings =====
BOT_TOKEN = os.getenv("BOT_TOKEN", "8743421316:AAGTd2mbjE7P6H1aVPIvXf3QZHW19yWg42E")
ADMIN_ID = int(os.getenv("ADMIN_ID", "7615522822"))
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://safomaga363-create.github.io/MYTelegramBot/")
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8080"))

DB_PATH = os.path.join(os.path.dirname(__file__), "database.db")

# Honey shop catalog
HONEY_CATALOG = [
    {
        "id": "may_honey",
        "name": "🌸 Майский мёд",
        "description": "Элитный весенний мёд. Натуральный, без добавок.",
        "price": 150,
        "currency": "сомони",
    },
    {
        "id": "cotton_honey",
        "name": "🌿 Хлопковый мёд (Асали пахта)",
        "description": "Нежный мёд с хлопковых полей. Мягкий вкус.",
        "price": 120,
        "currency": "сомони",
    },
    {
        "id": "pollen",
        "name": "🌾 Пчелиная пыльца (Гард)",
        "description": "Натуральный продукт. Богат витаминами и минералами.",
        "price": 200,
        "currency": "сомони",
    },
]

# Order conversation states
order_states = {}


# ===== Database =====
def init_db():
    """Create tables with full schema."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER UNIQUE NOT NULL,
            username TEXT,
            first_name TEXT,
            balance INTEGER DEFAULT 0,
            honey INTEGER DEFAULT 0,
            tickets INTEGER DEFAULT 5,
            last_tickets_update TEXT,
            nests INTEGER DEFAULT 0,
            queens INTEGER DEFAULT 0,
            workers INTEGER DEFAULT 0,
            soldiers INTEGER DEFAULT 0,
            smoker_level INTEGER DEFAULT 1,
            suit_level INTEGER DEFAULT 1,
            extractor_level INTEGER DEFAULT 1,
            is_premium INTEGER DEFAULT 0,
            referrer_id INTEGER DEFAULT NULL,
            referral_count INTEGER DEFAULT 0,
            cycles_completed INTEGER DEFAULT 0,
            games_played INTEGER DEFAULT 0,
            registered_at TEXT NOT NULL,
            last_active TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT,
            product_name TEXT,
            quantity_kg REAL,
            phone TEXT,
            total_price REAL,
            status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()


def migrate_db():
    """Safely add new columns if missing."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("PRAGMA table_info(users)")
    columns = {row[1] for row in cursor.fetchall()}

    migrations = {
        'honey': 'INTEGER DEFAULT 0',
        'nests': 'INTEGER DEFAULT 0',
        'queens': 'INTEGER DEFAULT 0',
        'workers': 'INTEGER DEFAULT 0',
        'soldiers': 'INTEGER DEFAULT 0',
        'smoker_level': 'INTEGER DEFAULT 1',
        'suit_level': 'INTEGER DEFAULT 1',
        'extractor_level': 'INTEGER DEFAULT 1',
        'is_premium': 'INTEGER DEFAULT 0',
        'referral_count': 'INTEGER DEFAULT 0',
        'cycles_completed': 'INTEGER DEFAULT 0',
        'games_played': 'INTEGER DEFAULT 0',
        'first_name': 'TEXT',
        'last_active': 'TEXT',
    }

    for col, typedef in migrations.items():
        if col not in columns:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {typedef}")

    # Ensure orders table exists
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            username TEXT,
            product_name TEXT,
            quantity_kg REAL,
            phone TEXT,
            total_price REAL,
            status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()


# ===== DB Helpers =====
def add_user(telegram_id, username, first_name, referrer_id=None):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute(
            """INSERT INTO users (telegram_id, username, first_name, referrer_id,
               last_tickets_update, registered_at, last_active)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (telegram_id, username, first_name, referrer_id, now, now, now),
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        # Update last_active on existing user
        cursor.execute(
            "UPDATE users SET last_active = ? WHERE telegram_id = ?",
            (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), telegram_id),
        )
        conn.commit()
        return False
    finally:
        conn.close()


def get_user(telegram_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
    user = cursor.fetchone()
    conn.close()
    return user


def get_user_columns():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(users)")
    cols = [row[1] for row in cursor.fetchall()]
    conn.close()
    return cols


def update_user_field(telegram_id, field, value):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(f"UPDATE users SET {field} = ? WHERE telegram_id = ?", (value, telegram_id))
    conn.commit()
    conn.close()


def update_balance(telegram_id, amount):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET balance = balance + ? WHERE telegram_id = ?", (amount, telegram_id))
    conn.commit()
    conn.close()


def user_exists(telegram_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM users WHERE telegram_id = ?", (telegram_id,))
    exists = cursor.fetchone() is not None
    conn.close()
    return exists


def get_referral_count(telegram_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users WHERE referrer_id = ?", (telegram_id,))
    count = cursor.fetchone()[0]
    conn.close()
    return count


def get_all_users():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT telegram_id, username, balance FROM users")
    users = cursor.fetchall()
    conn.close()
    return users


def count_users():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users")
    total = cursor.fetchone()[0]
    conn.close()
    return total


def get_top_users(limit=10):
    """Get top users by balance for leaderboard."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT telegram_id, username, first_name, balance FROM users ORDER BY balance DESC LIMIT ?",
        (limit,),
    )
    users = cursor.fetchall()
    conn.close()
    return users


def get_user_rank(telegram_id):
    """Get a user's rank by balance."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT balance FROM users WHERE telegram_id = ?", (telegram_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    balance = row[0]
    cursor.execute("SELECT COUNT(*) FROM users WHERE balance > ?", (balance,))
    rank = cursor.fetchone()[0] + 1
    conn.close()
    return rank


def create_order(user_id, username, product_name, quantity_kg, phone, total_price):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        """INSERT INTO orders (user_id, username, product_name, quantity_kg, phone, total_price, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (user_id, username, product_name, quantity_kg, phone, total_price, now),
    )
    conn.commit()
    order_id = cursor.lastrowid
    conn.close()
    return order_id


# ===== Bot Handlers =====
async def cmd_start(message: Message):
    user = message.from_user
    user_name = user.first_name
    username = user.username or "no_username"

    referrer_id = None
    if message.text and len(message.text.split()) > 1:
        ref_part = message.text.split()[1]
        if ref_part.startswith("ref"):
            try:
                referrer_id = int(ref_part[3:])
            except ValueError:
                referrer_id = None

    is_new = add_user(user.id, username, user_name, referrer_id)

    # Update premium status
    if user.is_premium:
        update_user_field(user.id, "is_premium", 1)

    if is_new and referrer_id and referrer_id != user.id and user_exists(referrer_id):
        update_balance(referrer_id, 500)
        update_balance(user.id, 500)
        update_user_field(referrer_id, "referral_count", get_referral_count(referrer_id))
        welcome = (
            f"👋 Добро пожаловать, <b>{user_name}</b>!\n\n"
            "🎉 Вы зарегистрированы!\n"
            "🎁 <b>+500 $BEE</b> за реферальную ссылку!\n\n"
            "🐝 <b>Bee Empire</b> — виртуальная пасека\n\n"
            "🛖 Строй гнёзда и заселяй пчёл\n"
            "⚙️ Прокачивай инструменты\n"
            "🍯 Собирай мёд и конвертируй в токены\n"
            "🎮 Играй и лови нектар\n"
            "🤝 Приглашай друзей за бонусы"
        )
    elif is_new:
        premium_text = "\n⭐ У вас <b>Telegram Premium</b> — +15% к добыче и +2 билета!" if user.is_premium else ""
        welcome = (
            f"👋 Добро пожаловать, <b>{user_name}</b>!\n\n"
            "🎉 Вы зарегистрированы!{premium}\n\n"
            "🐝 <b>Bee Empire</b> — виртуальная пасека\n\n"
            "🛖 Строй гнёзда и заселяй пчёл\n"
            "⚙️ Прокачивай инструменты\n"
            "🍯 Собирай мёд и конвертируй в токены\n"
            "🎮 Играй и лови нектар\n"
            "🤝 Приглашай друзей за бонусы"
        ).format(premium=premium_text)
    else:
        premium_text = "\n⭐ <b>Telegram Premium</b> бонус активен!" if user.is_premium else ""
        welcome = (
            "👋 С возвращением, <b>{name}</b>!{premium}\n\n"
            "🐝 <b>Bee Empire</b> — виртуальная пасека\n\n"
            "🛖 Строй гнёзда и заселяй пчёл\n"
            "⚙️ Прокачивай инструменты\n"
            "🍯 Собирай мёд и конвертируй в токены\n"
            "🎮 Играй и лови нектар\n"
            "🤝 Приглашай друзей за бонусы"
        ).format(name=user_name, premium=premium_text)

    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🐝 Открыть Bee Empire", web_app=WebAppInfo(url=MINI_APP_URL))],
        [InlineKeyboardButton(text="🤝 Пригласить друга", callback_data="invite_friend")],
        [InlineKeyboardButton(text="🍯 Купить натуральный мёд", callback_data="buy_honey")],
    ])

    await message.answer(welcome, reply_markup=keyboard, parse_mode=ParseMode.HTML)


async def cmd_admin(message: Message):
    if message.from_user.id != ADMIN_ID:
        await message.answer("⛔ У вас нет доступа.")
        return

    admin_kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📊 Статистика", callback_data="admin_stats"),
            InlineKeyboardButton(text="📢 Рассылка", callback_data="admin_broadcast"),
        ],
        [
            InlineKeyboardButton(text="📋 Заказы", callback_data="admin_orders"),
            InlineKeyboardButton(text="🏆 Топ-10", callback_data="admin_top"),
        ],
    ])
    await message.answer(
        "🔧 <b>Панель администратора</b>\n\nВыберите действие:",
        reply_markup=admin_kb, parse_mode=ParseMode.HTML,
    )


# ===== Honey Shop Callbacks =====
async def callback_buy_honey(callback_query: CallbackQuery):
    text_lines = [
        "🍯 <b>Каталог натурального мёда</b>\n",
    ]
    for i, item in enumerate(HONEY_CATALOG, 1):
        text_lines.append(f"{item['name']} — <b>{item['price']} {item['currency']}/кг</b>")
        text_lines.append(f"  _{item['description']}_\n")

    text_lines.append("✅ Натуральный, без добавок")
    text_lines.append("📦 Доставка по Таджикистану")
    text_lines.append("💳 Оплата при получении\n")
    text_lines.append("Выберите товар:")

    text = "\n".join(text_lines)

    buttons = []
    for item in HONEY_CATALOG:
        buttons.append([InlineKeyboardButton(
            text=f"{item['name']} — {item['price']} {item['currency']}",
            callback_data=f"honey_select_{item['id']}",
        )])
    buttons.append([InlineKeyboardButton(text="🔙 Назад", callback_data="back_to_menu")])

    kb = InlineKeyboardMarkup(inline_keyboard=buttons)
    await callback_query.message.edit_text(text, reply_markup=kb, parse_mode=ParseMode.HTML)
    await callback_query.answer()


async def callback_honey_select(callback_query: CallbackQuery):
    product_id = callback_query.data.replace("honey_select_", "")
    product = next((p for p in HONEY_CATALOG if p["id"] == product_id), None)

    if not product:
        await callback_query.answer("Товар не найден.", show_alert=True)
        return

    user_id = callback_query.from_user.id
    order_states[user_id] = {
        "step": "quantity",
        "product": product,
    }

    text = (
        f"🛒 <b>{product['name']}</b>\n\n"
        f"Цена: <b>{product['price']} {product['currency']}/кг</b>\n\n"
        "Введите количество в кг (например: 2 или 1.5):"
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="❌ Отмена", callback_data="cancel_order")],
    ])
    await callback_query.message.edit_text(text, reply_markup=kb, parse_mode=ParseMode.HTML)
    await callback_query.answer()


async def callback_cancel_order(callback_query: CallbackQuery):
    user_id = callback_query.from_user.id
    order_states.pop(user_id, None)

    text = (
        "❌ Заказ отменён.\n\n"
        "Вернитесь в главное меню:"
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 Назад", callback_data="back_to_menu")],
    ])
    await callback_query.message.edit_text(text, reply_markup=kb, parse_mode=ParseMode.HTML)
    await callback_query.answer()


# ===== Other Callbacks =====
async def callback_back_to_menu(callback_query: CallbackQuery):
    user_name = callback_query.from_user.first_name
    user = get_user(callback_query.from_user.id)
    premium_text = "\n⭐ <b>Telegram Premium</b> бонус активен!" if user and user[15] else ""

    text = (
        "👋 С возвращением, <b>{name}</b>!{premium}\n\n"
        "🐝 <b>Bee Empire</b> — виртуальная пасека\n\n"
        "🛖 Строй гнёзда и заселяй пчёл\n"
        "⚙️ Прокачивай инструменты\n"
        "🍯 Собирай мёд и конвертируй в токены\n"
        "🎮 Играй и лови нектар\n"
        "🤝 Приглашай друзей за бонусы"
    ).format(name=user_name, premium=premium_text)

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🐝 Открыть Bee Empire", web_app=WebAppInfo(url=MINI_APP_URL))],
        [InlineKeyboardButton(text="🤝 Пригласить друга", callback_data="invite_friend")],
        [InlineKeyboardButton(text="🍯 Купить натуральный мёд", callback_data="buy_honey")],
    ])
    await callback_query.message.edit_text(text, reply_markup=kb, parse_mode=ParseMode.HTML)
    await callback_query.answer()


async def callback_invite_friend(callback_query: CallbackQuery):
    user_id = callback_query.from_user.id
    bot_username = (await callback_query.bot.get_me()).username
    ref_link = f"https://t.me/{bot_username}?start=ref{user_id}"
    ref_count = get_referral_count(user_id)

    text = (
        "🤝 <b>Пригласи друга — получи бонус!</b>\n\n"
        "За каждого приглашённого вы оба получите <b>+500 $BEE</b>!\n\n"
        f"📊 Твои рефералы: <b>{ref_count}</b>\n\n"
        f"Твоя ссылка:\n<code>{ref_link}</code>"
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="📤 Поделиться",
            url=f"https://t.me/share/url?url={ref_link}&text=🐝+Присоединяйся+к+Bee+Empire!",
        )],
        [InlineKeyboardButton(text="🔙 Назад", callback_data="back_to_menu")],
    ])
    await callback_query.message.edit_text(text, reply_markup=kb, parse_mode=ParseMode.HTML)
    await callback_query.answer()


# ===== Admin Callbacks =====
async def callback_admin_stats(callback_query: CallbackQuery):
    if callback_query.from_user.id != ADMIN_ID:
        await callback_query.answer("⛔ Нет доступа.", show_alert=True)
        return

    total = count_users()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users WHERE referrer_id IS NOT NULL")
    ref_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM users WHERE is_premium = 1")
    premium_count = cursor.fetchone()[0]
    cursor.execute("SELECT SUM(balance) FROM users")
    total_balance = cursor.fetchone()[0] or 0
    cursor.execute("SELECT COUNT(*) FROM orders WHERE status = 'pending'")
    pending_orders = cursor.fetchone()[0]
    conn.close()

    text = (
        "📊 <b>Статистика Bee Empire</b>\n\n"
        f"👥 Всего игроков: <b>{total}</b>\n"
        f"🤝 По рефералам: <b>{ref_count}</b>\n"
        f"⭐ Premium: <b>{premium_count}</b>\n"
        f"🪙 Всего токенов: <b>{total_balance:,}</b>\n"
        f"📋 Ожидающих заказов: <b>{pending_orders}</b>"
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 Назад", callback_data="admin_back")],
    ])
    await callback_query.message.edit_text(text, reply_markup=kb, parse_mode=ParseMode.HTML)
    await callback_query.answer()


async def callback_admin_broadcast(callback_query: CallbackQuery):
    if callback_query.from_user.id != ADMIN_ID:
        await callback_query.answer("⛔ Нет доступа.", show_alert=True)
        return

    await callback_query.message.edit_text(
        "📢 <b>Рассылка</b>\n\nОтправьте текст для рассылки.\nДля отмены: /cancel",
        parse_mode=ParseMode.HTML,
    )
    await callback_query.answer()
    broadcast_state[callback_query.from_user.id] = True


broadcast_state = {}


async def handle_text_message(message: Message):
    """Unified text handler: broadcast (admin) → order → ignore."""
    user_id = message.from_user.id

    # 1. Admin broadcast
    if user_id == ADMIN_ID and broadcast_state.get(user_id):
        broadcast_state[user_id] = False

        if message.text == "/cancel":
            await message.answer("❌ Рассылка отменена.")
            return

        users = get_all_users()
        sent, failed = 0, 0
        for user in users:
            try:
                await message.bot.send_message(chat_id=user[0], text=message.text, parse_mode=ParseMode.HTML)
                sent += 1
            except Exception:
                failed += 1

        await message.answer(
            f"📢 <b>Рассылка завершена</b>\n\n✅ Доставлено: {sent}\n❌ Ошибок: {failed}",
            parse_mode=ParseMode.HTML,
        )
        return

    # 2. Order flow
    state = order_states.get(user_id)
    if not state:
        return

    if state["step"] == "quantity":
        try:
            qty = float(message.text.strip())
            if qty <= 0 or qty > 100:
                raise ValueError
        except ValueError:
            await message.answer("⚠️ Введите число от 0.1 до 100 кг:")
            return

        state["quantity"] = qty
        state["step"] = "phone"
        product = state["product"]
        total = qty * product["price"]
        await message.answer(
            f"🛒 <b>{product['name']}</b>\n"
            f"📦 Количество: <b>{qty} кг</b>\n"
            f"💰 Итого: <b>{total} {product['currency']}</b>\n\n"
            "📱 Введите номер телефона для связи:",
            parse_mode=ParseMode.HTML,
        )

    elif state["step"] == "phone":
        phone = message.text.strip()
        if len(phone) < 7 or not any(c.isdigit() for c in phone):
            await message.answer("⚠️ Введите корректный номер телефона:")
            return

        product = state["product"]
        qty = state["quantity"]
        total = qty * product["price"]
        username = message.from_user.username or "no_username"

        order_id = create_order(user_id, username, product["name"], qty, phone, total)
        order_states.pop(user_id, None)

        await message.answer(
            f"✅ <b>Заказ оформлен!</b>\n\n"
            f"🆔 Заказ #{order_id}\n"
            f"🛒 {product['name']}\n"
            f"📦 {qty} кг\n"
            f"💰 {total} {product['currency']}\n"
            f"📱 {phone}\n\n"
            "Мы свяжемся с вами в ближайшее время!",
            parse_mode=ParseMode.HTML,
        )

        admin_text = (
            f"🆕 <b>Новый заказ #{order_id}</b>\n\n"
            f"👤 Пользователь: @{username} (ID: {user_id})\n"
            f"🛒 Товар: {product['name']}\n"
            f"📦 Количество: {qty} кг\n"
            f"💰 Итого: {total} {product['currency']}\n"
            f"📱 Телефон: {phone}\n"
            f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        )
        try:
            await message.bot.send_message(chat_id=ADMIN_ID, text=admin_text, parse_mode=ParseMode.HTML)
        except Exception:
            pass


async def callback_admin_orders(callback_query: CallbackQuery):
    if callback_query.from_user.id != ADMIN_ID:
        await callback_query.answer("⛔ Нет доступа.", show_alert=True)
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, product_name, quantity_kg, phone, total_price, status, created_at "
        "FROM orders ORDER BY created_at DESC LIMIT 10"
    )
    orders = cursor.fetchall()
    conn.close()

    if not orders:
        text = "📋 <b>Заказов пока нет</b>"
    else:
        lines = ["📋 <b>Последние заказы:</b>\n"]
        for o in orders:
            status_emoji = "⏳" if o[6] == "pending" else "✅"
            lines.append(
                f"{status_emoji} #{o[0]} | @{o[1]} | {o[2]} | {o[3]}кг | {o[5]}см | {o[7]}"
            )
        text = "\n".join(lines)

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 Назад", callback_data="admin_back")],
    ])
    await callback_query.message.edit_text(text, reply_markup=kb, parse_mode=ParseMode.HTML)
    await callback_query.answer()


async def callback_admin_top(callback_query: CallbackQuery):
    if callback_query.from_user.id != ADMIN_ID:
        await callback_query.answer("⛔ Нет доступа.", show_alert=True)
        return

    top = get_top_users(10)
    medals = ["🥇", "🥈", "🥉"]

    lines = ["🏆 <b>Топ-10 игроков:</b>\n"]
    for i, user in enumerate(top):
        rank = medals[i] if i < 3 else f"{i+1}."
        name = user[2] or user[1] or "Игрок"
        lines.append(f"{rank} {name} — {user[3]:,} $BEE")

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 Назад", callback_data="admin_back")],
    ])
    await callback_query.message.edit_text("\n".join(lines), reply_markup=kb, parse_mode=ParseMode.HTML)
    await callback_query.answer()


async def callback_admin_back(callback_query: CallbackQuery):
    if callback_query.from_user.id != ADMIN_ID:
        await callback_query.answer("⛔ Нет доступа.", show_alert=True)
        return

    admin_kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📊 Статистика", callback_data="admin_stats"),
            InlineKeyboardButton(text="📢 Рассылка", callback_data="admin_broadcast"),
        ],
        [
            InlineKeyboardButton(text="📋 Заказы", callback_data="admin_orders"),
            InlineKeyboardButton(text="🏆 Топ-10", callback_data="admin_top"),
        ],
    ])
    await callback_query.message.edit_text(
        "🔧 <b>Панель администратора</b>\n\nВыберите действие:",
        reply_markup=admin_kb, parse_mode=ParseMode.HTML,
    )
    await callback_query.answer()


# ===== Mini App Data Handler =====
async def handle_webapp_data(message: Message):
    """Process data sent from Mini App via tg.sendData()."""
    if not message.web_app_data:
        return

    try:
        data = json.loads(message.web_app_data.data)
    except json.JSONDecodeError:
        return

    action = data.get("action")
    user_id = message.from_user.id
    is_admin = (user_id == ADMIN_ID)

    # Admin God Mode: maintain infinite resources in DB
    if is_admin:
        update_user_field(user_id, "balance", 999999999)
        update_user_field(user_id, "honey", 999999999)
        update_user_field(user_id, "tickets", 999999)
        update_user_field(user_id, "workers", 800000)
        update_user_field(user_id, "soldiers", 200000)
        update_user_field(user_id, "queens", 10)
        update_user_field(user_id, "nests", 10)
        update_user_field(user_id, "smoker_level", 100)
        update_user_field(user_id, "suit_level", 100)
        update_user_field(user_id, "extractor_level", 100)

    if action == "collect_reward":
        balance = data.get("balance", 0)
        update_balance(message.from_user.id, balance - (get_user(message.from_user.id) or [0, 0, 0])[2])
        update_user_field(message.from_user.id, "balance", balance)

    elif action == "game_result":
        earned = data.get("earned", 0)
        balance = data.get("balance", 0)
        update_user_field(message.from_user.id, "balance", balance)
        games = (get_user(message.from_user.id) or [0] * 22)
        update_user_field(message.from_user.id, "games_played", (games[21] if len(games) > 21 else 0) + 1)

    elif action == "extract_honey":
        balance = data.get("balance", 0)
        honey = data.get("honey", 0)
        update_user_field(message.from_user.id, "balance", balance)
        update_user_field(message.from_user.id, "honey", honey)

    elif action == "buy_bee":
        balance = data.get("balance", 0)
        update_user_field(message.from_user.id, "balance", balance)

    elif action == "buy_upgrade":
        balance = data.get("balance", 0)
        update_user_field(message.from_user.id, "balance", balance)

    elif action == "buy_ton":
        item_id = data.get("itemId", "unknown")
        ton_amount = data.get("tonAmount", 0)
        tx_hash = data.get("txHash", "unknown")
        try:
            await message.bot.send_message(
                chat_id=ADMIN_ID,
                text=(
                    f"💎 <b>TON оплата</b>\n\n"
                    f"👤 @{message.from_user.username} (ID: {message.from_user.id})\n"
                    f"🛒 Товар: {item_id}\n"
                    f"💎 Сумма: {ton_amount} TON\n"
                    f"🔑 TX: <code>{tx_hash}</code>"
                ),
                parse_mode=ParseMode.HTML,
            )
        except Exception:
            pass

    elif action == "get_leaderboard":
        top = get_top_users(10)
        user_rank = get_user_rank(message.from_user.id)
        medals = ["🥇", "🥈", "🥉"]

        lines = ["🏆 <b>Топ-10 игроков:</b>\n"]
        for i, u in enumerate(top):
            rank = medals[i] if i < 3 else f"{i+1}."
            name = u[2] or u[1] or "Игрок"
            lines.append(f"{rank} {name} — <b>{u[3]:,}</b> $BEE")

        lines.append(f"\n📍 <b>Ваше место:</b> №{user_rank}")

        await message.answer("\n".join(lines), parse_mode=ParseMode.HTML)


# ===== HTTP API for Leaderboard =====
async def api_leaderboard(request):
    """HTTP API endpoint for leaderboard data."""
    user_id = int(request.query.get("user_id", 0))

    top = get_top_users(10)
    user_rank = get_user_rank(user_id) if user_id else None

    top_data = []
    for i, u in enumerate(top):
        top_data.append({
            "rank": i + 1,
            "user_id": u[0],
            "username": u[1] or u[2] or "Игрок",
            "balance": u[3],
        })

    return web.json_response({
        "top": top_data,
        "userRank": user_rank,
    })


async def api_health(request):
    return web.json_response({"status": "ok", "service": "bee_empire_api"})


def create_api_app():
    app = web.Application()
    app.router.add_get("/api/leaderboard", api_leaderboard)
    app.router.add_get("/api/health", api_health)
    return app


# ===== Main =====
async def main():
    init_db()
    migrate_db()

    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher()

    # Register handlers
    dp.message.register(cmd_start, CommandStart())
    dp.message.register(cmd_admin, Command("admin"))
    dp.message.register(handle_webapp_data, F.web_app_data)
    dp.message.register(handle_text_message, F.text & ~F.command)

    dp.callback_query.register(callback_buy_honey, F.data == "buy_honey")
    dp.callback_query.register(callback_back_to_menu, F.data == "back_to_menu")
    dp.callback_query.register(callback_invite_friend, F.data == "invite_friend")
    dp.callback_query.register(callback_honey_select, F.data.startswith("honey_select_"))
    dp.callback_query.register(callback_cancel_order, F.data == "cancel_order")
    dp.callback_query.register(callback_admin_stats, F.data == "admin_stats")
    dp.callback_query.register(callback_admin_broadcast, F.data == "admin_broadcast")
    dp.callback_query.register(callback_admin_orders, F.data == "admin_orders")
    dp.callback_query.register(callback_admin_top, F.data == "admin_top")
    dp.callback_query.register(callback_admin_back, F.data == "admin_back")

    # Start HTTP API server
    api_app = create_api_app()
    runner = web.AppRunner(api_app)
    await runner.setup()
    site = web.TCPSite(runner, API_HOST, API_PORT)
    try:
        await site.start()
        print(f"API server started on {API_HOST}:{API_PORT}")
    except OSError as e:
        print(f"API server port {API_PORT} busy, skipping HTTP API: {e}")

    print("Bee Empire bot started!")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
