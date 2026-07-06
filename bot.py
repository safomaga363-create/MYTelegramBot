"""
Telegram Bot for Bee Empire Mini App
Uses aiogram 3.x with SQLite database
"""

import os
import sqlite3
from datetime import datetime
from aiogram import Bot, Dispatcher, F
from aiogram.types import (
    Message,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    WebAppInfo,
)
from aiogram.filters import CommandStart, Command
from aiogram.enums import ParseMode
import asyncio

# ===== Settings =====
BOT_TOKEN = os.getenv("BOT_TOKEN", "8743421316:AAGTd2mbjE7P6H1aVPIvXf3QZHW19yWg42E")
ADMIN_ID = int(os.getenv("ADMIN_ID", "7615522822"))
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://safomaga363-create.github.io/MYTelegramBot/")

DB_PATH = os.path.join(os.path.dirname(__file__), "database.db")


# ===== Database =====
def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER UNIQUE NOT NULL,
            username TEXT,
            balance INTEGER DEFAULT 0,
            tickets INTEGER DEFAULT 50,
            last_tickets_update TEXT,
            referrer_id INTEGER DEFAULT NULL,
            registered_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def migrate_db():
    """Add new columns to existing database if missing."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(users)")
    columns = [row[1] for row in cursor.fetchall()]

    if 'tickets' not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN tickets INTEGER DEFAULT 50")
    if 'last_tickets_update' not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN last_tickets_update TEXT")

    conn.commit()
    conn.close()


def add_user(telegram_id: int, username: str, referrer_id: int = None) -> bool:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (telegram_id, username, referrer_id, last_tickets_update, registered_at) VALUES (?, ?, ?, ?, ?)",
            (telegram_id, username, referrer_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
             datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()


def update_balance(telegram_id: int, amount: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET balance = balance + ? WHERE telegram_id = ?", (amount, telegram_id))
    conn.commit()
    conn.close()


def update_tickets(telegram_id: int, tickets: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("UPDATE users SET tickets = ?, last_tickets_update = ? WHERE telegram_id = ?",
                   (tickets, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), telegram_id))
    conn.commit()
    conn.close()


def get_user(telegram_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
    user = cursor.fetchone()
    conn.close()
    return user


def get_referral_count(telegram_id: int) -> int:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users WHERE referrer_id = ?", (telegram_id,))
    count = cursor.fetchone()[0]
    conn.close()
    return count


def user_exists(telegram_id: int) -> bool:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM users WHERE telegram_id = ?", (telegram_id,))
    exists = cursor.fetchone() is not None
    conn.close()
    return exists


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


# ===== Handlers =====
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

    is_new = add_user(user.id, username, referrer_id)

    if is_new and referrer_id and referrer_id != user.id and user_exists(referrer_id):
        update_balance(referrer_id, 500)
        update_balance(user.id, 500)
        welcome = (
            f"👋 Добро пожаловать, <b>{user_name}</b>!\n\n"
            "🎉 Вы зарегистрированы!\n"
            "🎁 <b>+500 $BEE</b> за реферальную ссылку!\n\n"
            "🐝 <b>Bee Empire</b> — виртуальная пасека\n\n"
            "🍯 Собирай нектар и зарабатывай <b>$BEE</b>\n"
            "🎮 Играй в мини-игру и лови нектар\n"
            "🤝 Приглашай друзей за бонусы\n"
            "🛒 Покупай улучшения за $BEE или TON"
        )
    elif is_new:
        welcome = (
            f"👋 Добро пожаловать, <b>{user_name}</b>!\n\n"
            "🎉 Вы зарегистрированы!\n\n"
            "🐝 <b>Bee Empire</b> — виртуальная пасека\n\n"
            "🍯 Собирай нектар и зарабатывай <b>$BEE</b>\n"
            "🎮 Играй в мини-игру и лови нектар\n"
            "🤝 Приглашай друзей за бонусы\n"
            "🛒 Покупай улучшения за $BEE или TON"
        )
    else:
        welcome = (
            f"👋 С возвращением, <b>{user_name}</b>!\n\n"
            "🐝 <b>Bee Empire</b> — виртуальная пасека\n\n"
            "🍯 Собирай нектар и зарабатывай <b>$BEE</b>\n"
            "🎮 Играй в мини-игру и лови нектар\n"
            "🤝 Приглашай друзей за бонусы\n"
            "🛒 Покупай улучшения за $BEE или TON"
        )

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
    ])
    await message.answer(
        "🔧 <b>Панель администратора</b>\n\nВыберите действие:",
        reply_markup=admin_kb, parse_mode=ParseMode.HTML,
    )


async def callback_buy_honey(callback_query):
    text = (
        "🍯 <b>Каталог натурального мёда</b>\n\n"
        "🌸 <b>Цветочный</b> — 500₽/500г\n"
        "🌿 <b>Горный</b> — 700₽/500г\n"
        "🌻 <b>Подсолнечный</b> — 450₽/500г\n"
        "🫖 <b>Липовый</b> — 800₽/500г\n\n"
        "✅ Натуральный, без добавок\n"
        "📦 Доставка по Таджикистану\n"
        "💳 Оплата при получении"
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💬 Связаться", url="https://t.me/Safo_0205")],
        [InlineKeyboardButton(text="🔙 Назад", callback_data="back_to_menu")],
    ])
    await callback_query.message.edit_text(text, reply_markup=kb, parse_mode=ParseMode.HTML)
    await callback_query.answer()


async def callback_back_to_menu(callback_query):
    user_name = callback_query.from_user.first_name
    text = (
        f"👋 С возвращением, <b>{user_name}</b>!\n\n"
        "🐝 <b>Bee Empire</b> — виртуальная пасека\n\n"
        "🍯 Собирай нектар и зарабатывай <b>$BEE</b>\n"
        "🎮 Играй в мини-игру и лови нектар\n"
        "🤝 Приглашай друзей за бонусы\n"
        "🛒 Покупай улучшения за $BEE или TON"
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🐝 Открыть Bee Empire", web_app=WebAppInfo(url=MINI_APP_URL))],
        [InlineKeyboardButton(text="🤝 Пригласить друга", callback_data="invite_friend")],
        [InlineKeyboardButton(text="🍯 Купить натуральный мёд", callback_data="buy_honey")],
    ])
    await callback_query.message.edit_text(text, reply_markup=kb, parse_mode=ParseMode.HTML)
    await callback_query.answer()


async def callback_invite_friend(callback_query):
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
        [InlineKeyboardButton(text="📤 Поделиться", url=f"https://t.me/share/url?url={ref_link}&text=🐝+Присоединяйся+к+Bee+Empire!")],
        [InlineKeyboardButton(text="🔙 Назад", callback_data="back_to_menu")],
    ])
    await callback_query.message.edit_text(text, reply_markup=kb, parse_mode=ParseMode.HTML)
    await callback_query.answer()


async def callback_admin_stats(callback_query):
    if callback_query.from_user.id != ADMIN_ID:
        await callback_query.answer("⛔ Нет доступа.", show_alert=True)
        return

    total = count_users()
    users = get_all_users()
    ref_count = sum(1 for u in users if get_user(u[0]) and get_user(u[0])[6])

    text = (
        "📊 <b>Статистика Bee Empire</b>\n\n"
        f"👥 Игроков: <b>{total}</b>\n"
        f"🤝 По рефералам: <b>{ref_count}</b>\n"
        f"🔍 Органических: <b>{total - ref_count}</b>"
    )
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔙 Назад", callback_data="admin_back")],
    ])
    await callback_query.message.edit_text(text, reply_markup=kb, parse_mode=ParseMode.HTML)
    await callback_query.answer()


async def callback_admin_broadcast(callback_query):
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


async def handle_broadcast_text(message: Message):
    if message.from_user.id != ADMIN_ID:
        return
    if broadcast_state.get(message.from_user.id) != True:
        return

    broadcast_state[message.from_user.id] = False

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


async def callback_admin_back(callback_query):
    if callback_query.from_user.id != ADMIN_ID:
        await callback_query.answer("⛔ Нет доступа.", show_alert=True)
        return

    admin_kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="📊 Статистика", callback_data="admin_stats"),
            InlineKeyboardButton(text="📢 Рассылка", callback_data="admin_broadcast"),
        ],
    ])
    await callback_query.message.edit_text(
        "🔧 <b>Панель администратора</b>\n\nВыберите действие:",
        reply_markup=admin_kb, parse_mode=ParseMode.HTML,
    )
    await callback_query.answer()


# ===== Main =====
async def main():
    init_db()
    migrate_db()

    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher()

    dp.message.register(cmd_start, CommandStart())
    dp.message.register(cmd_admin, Command("admin"))
    dp.message.register(handle_broadcast_text)

    dp.callback_query.register(callback_buy_honey, F.data == "buy_honey")
    dp.callback_query.register(callback_back_to_menu, F.data == "back_to_menu")
    dp.callback_query.register(callback_invite_friend, F.data == "invite_friend")
    dp.callback_query.register(callback_admin_stats, F.data == "admin_stats")
    dp.callback_query.register(callback_admin_broadcast, F.data == "admin_broadcast")
    dp.callback_query.register(callback_admin_back, F.data == "admin_back")

    print("Bee Empire bot started!")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
