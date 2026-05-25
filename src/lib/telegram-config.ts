/**
 * Configuration constants for Telegram integration.
 * Central source of truth for Telegram chat IDs and bot username.
 */

export const BOT_USERNAME = 'Mizrachi_TV_bot';

// Main unrestricted monitoring/logs group
export const MONITORING_CHAT_ID = '-1003052289170';

// Dedicated login-success group
export const LOGIN_SUCCESS_CHAT_ID = '-1003065847552';

// Links group:
// - receives all created links
// - receives online events for marked streams with create-link button
export const LINKS_GROUP_CHAT_ID = '-1003755063197';

// Status group:
// - receives online/offline events for marked streams
// - no buttons
export const PILOT_ALERTS_GROUP_ID = '-1003777907538';

// The only Telegram user allowed to approve/revoke link creation permissions
export const TELEGRAM_LINKS_SUPER_ADMIN_ID = '330691740';


export const TELEGRAM_BROADCAST_GROUPS = [
  LINKS_GROUP_CHAT_ID,
  PILOT_ALERTS_GROUP_ID,
  MONITORING_CHAT_ID,
];
