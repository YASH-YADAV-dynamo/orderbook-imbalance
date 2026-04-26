
/**
 * Generates a high-entropy unique ID for liquidation events.
 * Combines timestamp, a random component, and an optional counter.
 */
let idCounter = 0;

export function generateUniqueId(timestamp: number): string {
  idCounter = (idCounter + 1) % 10000;
  // Use a combination of timestamp, a large random number, and a counter
  const randomPart = Math.floor(Math.random() * 1000000).toString(16);
  const counterPart = idCounter.toString(16).padStart(4, '0');
  return `${timestamp}-${randomPart}-${counterPart}`;
}

/**
 * Bitget API Signature Helper
 * Required for authenticated historical data requests
 */
export function getBitgetHeaders(method: string, path: string, params: string = '') {
  const apiKey = process.env.BITGET_API_KEY;
  const apiSecret = process.env.BITGET_API_SECRET;
  const passphrase = process.env.BITGET_API_PASSPHRASE;

  if (!apiKey || !apiSecret || !passphrase) {
    return { 'Content-Type': 'application/json' };
  }

  const timestamp = Date.now().toString();
  const message = timestamp + method.toUpperCase() + path + (params ? '?' + params : '');
  
  const crypto = require('crypto');
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(message)
    .digest('base64');

  return {
    'ACCESS-KEY': apiKey,
    'ACCESS-SIGN': signature,
    'ACCESS-PASSPHRASE': passphrase,
    'ACCESS-TIMESTAMP': timestamp,
    'Content-Type': 'application/json',
    'locale': 'en-US'
  };
}
