import crypto from 'crypto';

const KEY  = 'bg_82095b6182363326bebfa8b3928dae4a';
const SEC  = 'f7b4c10ed5455526469a217258ef78ec9dd5327eca9088fef0df65daed59825b';
const PASS = 'SkewXToken2024';

function hdrs(method, path, query='') {
  const ts   = Date.now().toString();
  const pre  = ts + method + path + (query ? '?'+query : '');
  const sign = crypto.createHmac('sha256', SEC).update(pre).digest('base64');
  return { 'ACCESS-KEY': KEY, 'ACCESS-SIGN': sign, 'ACCESS-TIMESTAMP': ts, 'ACCESS-PASSPHRASE': PASS, 'locale': 'en-US' };
}

async function probe(path, query='') {
  const url = 'https://api.bitget.com' + path + (query ? '?'+query : '');
  try {
    const r = await fetch(url, { headers: hdrs('GET', path, query) });
    const d = await r.json();
    const dlen = Array.isArray(d.data) ? d.data.length : typeof d.data;
    console.log(`[${r.status}] ${path.slice(-45)} | code=${d.code} msg=${String(d.msg).slice(0,60)} data=${dlen}`);
    if (Array.isArray(d.data) && d.data[0]) console.log('  sample keys:', Object.keys(d.data[0]).join(', '));
  } catch(e) { console.log(`[ERR] ${path} | ${e.message}`); }
}

// Probe all plausible endpoints
await Promise.all([
  probe('/api/v2/mix/market/history-liquidation',     'productType=USDT-FUTURES&limit=20'),
  probe('/api/v2/mix/market/liquidation-history',     'productType=USDT-FUTURES&limit=20'),
  probe('/api/v2/position/liquidation-history',       'productType=USDT-FUTURES&limit=20'),
  probe('/api/v2/mix/market/liquidation',             'productType=USDT-FUTURES&symbol=BTCUSDT&limit=20'),
  probe('/api/v2/mix/market/fills',                   'productType=USDT-FUTURES&symbol=BTCUSDT&limit=20'),
  probe('/api/v2/mix/market/insurance',               'productType=USDT-FUTURES'),
]);
