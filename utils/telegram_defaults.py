"""Shared defaults for Telegram replies, edits and notifications."""
from telegram import LinkPreviewOptions
from telegram.ext import Defaults


TELEGRAM_DEFAULTS = Defaults(
    link_preview_options=LinkPreviewOptions(is_disabled=True),
)
