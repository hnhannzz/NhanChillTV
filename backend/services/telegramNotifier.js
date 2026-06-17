const axios = require('axios');
const config = require('../config');

const sentAt = new Map();
const DEFAULT_COOLDOWN_MS = Number(process.env.TELEGRAM_ALERT_COOLDOWN_MS || 30 * 60 * 1000);

function isEnabled() {
  return Boolean(config.telegramBotToken && config.telegramChatId);
}

async function sendTelegramMessage(text) {
  if (!isEnabled()) return { skipped: true, reason: 'telegram_not_configured' };
  const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  const response = await axios.post(url, {
    chat_id: config.telegramChatId,
    text,
    disable_web_page_preview: true,
  }, {
    timeout: 8000,
    validateStatus: status => status < 500,
  });
  if (response.status < 200 || response.status >= 300 || response.data?.ok === false) {
    throw new Error(response.data?.description || `Telegram HTTP ${response.status}`);
  }
  return { sent: true };
}

async function alertOnce(key, text, cooldownMs = DEFAULT_COOLDOWN_MS) {
  if (!isEnabled()) return { skipped: true, reason: 'telegram_not_configured' };
  const now = Date.now();
  const last = sentAt.get(key) || 0;
  if (now - last < cooldownMs) return { skipped: true, reason: 'cooldown' };
  sentAt.set(key, now);
  try {
    return await sendTelegramMessage(text);
  } catch (err) {
    console.error('[Telegram] Alert failed:', err.message);
    return { error: err.message };
  }
}

module.exports = {
  isEnabled,
  alertOnce,
};
