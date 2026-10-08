// The always-on part (Cloudflare Worker "hevre-api"): the AI and the notifications.
// Empty = the site works without them.
export const API = 'https://hevre-api.taltulsadovoy.workers.dev';
// Public key for web push (Firebase → Cloud Messaging → Web Push certificates). Public by design.
export const VAPID_KEY = 'BFERq6rn07avQ-ugH4OBA2f-2viKtpuS_3--QlRUw_pDg2tkqHJtnqSXpbchRhXsxlXnbdOp8Kw6KXRY99WeOH8';
// Who sees the 📊 button on the home page. Only shows the button: the server decides who gets
// the numbers (ADMIN_UIDS in hevre-api/wrangler.toml). A uid isn't a secret, it's just an account id.
export const SITE_ADMINS = ['znB8m7hf6BPKpXVLfAS13WvIRFG2'];
