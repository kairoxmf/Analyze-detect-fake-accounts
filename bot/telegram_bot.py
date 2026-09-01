import os
import requests
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

API_URL = os.getenv("API_URL", "http://localhost:5000")
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
BOT_API_KEY = os.getenv("BOT_API_KEY", "")

TEXTS = {
    "en": {
        "welcome": "AI Sentinel Bot is online.\nUse /analyze <username> or tap a button.",
        "ask_username": "Send the username you want to analyze.",
        "how": (
            "1) Upload CSV in the web app\n"
            "2) Send a username here\n"
            "3) The bot reads from the latest dataset\n\n"
            "In groups, mention a user or reply to their message.\n"
            "Bots cannot join groups by themselves. Add the bot to your group manually."
        ),
        "no_dataset": "No dataset uploaded yet.",
        "api_down": "API is not reachable.",
        "usage": "Send: /analyze <username>\nExample: /analyze john_doe",
        "analyze_button": "Analyze Username",
        "status_button": "Check API Status",
        "top_button": "Top Risks",
        "last_button": "Recheck Last",
        "cancel_button": "Cancel",
        "how_button": "How It Works",
        "lang_button": "فارسی",
        "prompt_any": "Send a username or use /analyze <username>.",
        "cancelled": "Request cancelled.",
        "no_last": "No previous username yet.",
        "top_title": "Top risky accounts:",
    },
    "fa": {
        "welcome": "بات فعال است.\nبرای بررسی، /analyze <username> بفرست یا دکمه‌ها را بزن.",
        "ask_username": "نام کاربری را ارسال کن.",
        "how": (
            "1) فایل CSV را در سایت آپلود کن\n"
            "2) نام کاربری را اینجا بفرست\n"
            "3) بات از آخرین دیتای آپلود شده استفاده می‌کند\n\n"
            "در گروه اگر منشن شود یا روی پیام ریپلای کنی، تحلیل انجام می‌دهد.\n"
            "بات خودش عضو گروه نمی‌شود؛ دستی اضافه‌اش کن."
        ),
        "no_dataset": "هنوز دیتایی آپلود نشده.",
        "api_down": "API در دسترس نیست.",
        "usage": "به این شکل بفرست: /analyze <username>\nمثال: /analyze john_doe",
        "analyze_button": "بررسی نام کاربری",
        "status_button": "وضعیت API",
        "top_button": "پرریسک‌ها",
        "last_button": "آخرین بررسی",
        "cancel_button": "لغو",
        "how_button": "راهنما",
        "lang_button": "English",
        "prompt_any": "نام کاربری را بفرست یا /analyze <username>.",
        "cancelled": "درخواست لغو شد.",
        "no_last": "هنوز نام کاربری ثبت نشده.",
        "top_title": "اکانت‌های پرریسک:",
    },
}


def get_lang(context: ContextTypes.DEFAULT_TYPE) -> str:
    default_lang = context.bot_data.get("default_lang", "fa")
    return context.user_data.get("lang", default_lang)


def t(context: ContextTypes.DEFAULT_TYPE, key: str) -> str:
    lang = get_lang(context)
    return TEXTS.get(lang, TEXTS["fa"]).get(key, "")


def extract_username_from_message(update: Update) -> str | None:
    message = update.message
    if not message or not message.text:
        return None
    if message.reply_to_message and message.reply_to_message.from_user:
        reply_user = message.reply_to_message.from_user
        return reply_user.username or str(reply_user.id)
    entities = message.entities or []
    for entity in entities:
        if entity.type == "mention":
            mention = message.text[entity.offset : entity.offset + entity.length]
            return mention.lstrip("@")
        if entity.type == "text_mention" and entity.user:
            return entity.user.username or str(entity.user.id)
    for token in message.text.split():
        if token.startswith("@") and len(token) > 1:
            return token.lstrip("@")
    return None


def build_menu(context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [
            InlineKeyboardButton(t(context, "analyze_button"), callback_data="analyze_hint"),
            InlineKeyboardButton(t(context, "status_button"), callback_data="status"),
        ],
        [
            InlineKeyboardButton(t(context, "how_button"), callback_data="how"),
            InlineKeyboardButton(t(context, "lang_button"), callback_data="toggle_lang"),
        ],
        [
            InlineKeyboardButton(t(context, "top_button"), callback_data="top_risks"),
            InlineKeyboardButton(t(context, "last_button"), callback_data="recheck_last"),
            InlineKeyboardButton(t(context, "cancel_button"), callback_data="cancel"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        t(context, "welcome"),
        reply_markup=build_menu(context),
    )


def format_result(result: dict) -> str:
    fake = "✅ REAL" if not result.get("is_fake") else "⚠️ FAKE"
    risk = result.get("risk_level", "LOW")
    prob = result.get("fake_probability", 0) * 100
    trust = result.get("trust_score", 0)
    behavior = result.get("behavioral_score", 0)
    bot_ring = "YES" if result.get("bot_ring_warning") else "NO"
    return "\n".join(
        [
            f"User: {result.get('username') or result.get('user_id')}",
            f"Status: {fake}",
            f"Risk: {risk}",
            f"Fake Probability: {prob:.1f}%",
            f"Trust Score: {trust:.0f}/100",
            f"Behavior Score: {behavior:.1f}",
            f"Bot Ring: {bot_ring}",
        ]
    )


async def analyze_username(message, context: ContextTypes.DEFAULT_TYPE, username: str):
    try:
        response = requests.post(
            f"{API_URL}/analyze",
            json={"username": username},
            timeout=15,
        )
        if response.status_code != 200:
            await message.reply_text(
                response.json().get("error", t(context, "no_dataset"))
            )
            return
        result = response.json()["result"]
    except Exception:
        await message.reply_text(t(context, "api_down"))
        return

    context.user_data["last_username"] = username
    await message.reply_text(format_result(result))


async def analyze(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text(t(context, "usage"))
        return

    username = context.args[0].lstrip("@")
    await analyze_username(update.message, context, username)


async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    message = update.message or update.callback_query.message
    try:
        response = requests.get(f"{API_URL}/results", timeout=10)
        if response.status_code != 200:
            await message.reply_text(t(context, "no_dataset"))
            return
        payload = response.json()
        summary = payload.get("summary", {})
        await message.reply_text(
            "\n".join(
                [
                    "API Status: Ready",
                    f"Total accounts: {summary.get('total', 0)}",
                    f"Fake detected: {summary.get('fake', 0)}",
                    f"Bot rings: {summary.get('bot_ring_count', 0)}",
                ]
            )
        )
    except Exception:
        await message.reply_text(t(context, "api_down"))


async def how(update: Update, context: ContextTypes.DEFAULT_TYPE):
    message = update.message or update.callback_query.message
    await message.reply_text(t(context, "how"))


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.message.text.startswith("/"):
        return
    if update.message.chat.type in ["group", "supergroup"]:
        if not context.bot_data.get("group_mode", True):
            return
        username = extract_username_from_message(update)
        if not username or not context.bot_data.get("allow_mentions", True):
            return
        await analyze_username(update.message, context, username)
        return
    text = update.message.text.strip()
    if context.user_data.get("awaiting_username"):
        context.user_data["awaiting_username"] = False
        await analyze_username(update.message, context, text.lstrip("@"))
        return
    if text:
        await analyze_username(update.message, context, text.lstrip("@"))
        return
    await update.message.reply_text(t(context, "prompt_any"))


async def menu_action(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    if query.data == "status":
        await status(update, context)
    elif query.data == "how":
        await how(update, context)
    elif query.data == "toggle_lang":
        context.user_data["lang"] = "en" if get_lang(context) == "fa" else "fa"
        await query.message.reply_text(t(context, "welcome"), reply_markup=build_menu(context))
    elif query.data == "top_risks":
        await top_risks(update, context)
    elif query.data == "recheck_last":
        last = context.user_data.get("last_username")
        if not last:
            await query.message.reply_text(t(context, "no_last"))
        else:
            await analyze_username(query.message, context, last)
    elif query.data == "cancel":
        context.user_data["awaiting_username"] = False
        await query.message.reply_text(t(context, "cancelled"))
    else:
        context.user_data["awaiting_username"] = True
        await query.message.reply_text(t(context, "ask_username"))


async def top_risks(update: Update, context: ContextTypes.DEFAULT_TYPE):
    message = update.message or update.callback_query.message
    try:
        response = requests.get(f"{API_URL}/results", timeout=10)
        if response.status_code != 200:
            await message.reply_text(t(context, "no_dataset"))
            return
        payload = response.json()
        results = payload.get("results", [])
        if not results:
            await message.reply_text(t(context, "no_dataset"))
            return
        top = sorted(results, key=lambda r: r.get("fake_probability", 0), reverse=True)[:5]
        lines = [t(context, "top_title")]
        for item in top:
            user = item.get("username") or item.get("user_id")
            prob = item.get("fake_probability", 0) * 100
            lines.append(f"- {user}: {prob:.1f}%")
        await message.reply_text("\n".join(lines))
    except Exception:
        await message.reply_text(t(context, "api_down"))


def fetch_bot_config() -> dict:
    try:
        headers = {"X-Bot-Key": BOT_API_KEY} if BOT_API_KEY else {}
        response = requests.get(
            f"{API_URL}/bot/config",
            headers=headers,
            timeout=10,
        )
        if response.status_code != 200:
            return {}
        return response.json().get("config", {})
    except Exception:
        return {}


def send_bot_ping():
    try:
        headers = {"X-Bot-Key": BOT_API_KEY} if BOT_API_KEY else {}
        requests.post(
            f"{API_URL}/bot/ping",
            headers=headers,
            json={"info": "bot-online"},
            timeout=5,
        )
    except Exception:
        pass


def main():
    if not BOT_TOKEN:
        raise RuntimeError("Set TELEGRAM_BOT_TOKEN environment variable.")

    app = ApplicationBuilder().token(BOT_TOKEN).build()
    config = fetch_bot_config()
    if config:
        app.bot_data.update(config)
    send_bot_ping()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("analyze", analyze))
    app.add_handler(CommandHandler("status", status))
    app.add_handler(CommandHandler("how", how))
    app.add_handler(CallbackQueryHandler(menu_action))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    app.run_polling()


if __name__ == "__main__":
    main()
