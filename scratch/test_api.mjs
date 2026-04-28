
async function testFetch() {
  const sources = [
    { name: 'Binance', url: 'https://fapi.binance.com/fapi/v1/allForceOrders?symbol=BTCUSDT&limit=10' },
    { name: 'OKX', url: 'https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&limit=10' },
    { name: 'Bybit', url: 'https://api.bybit.com/v5/market/liquidation?category=linear&symbol=BTCUSDT&limit=10' },
    { name: 'Bitget', url: 'https://api.bitget.com/api/v2/mix/market/history-liquidation?symbol=BTCUSDT&productType=usdt-futures&limit=10' },
    { name: 'Gate', url: 'https://api.gateio.ws/api/v4/futures/usdt/liquidates?contract=BTC_USDT' },
    { name: 'HTX', url: 'https://api.hbdm.com/linear-swap-ex/market/liquidation_orders?contract_code=BTC-USDT&trade_type=0&create_date=7&page_index=1&page_size=10' }
  ];

  for (const source of sources) {
    console.log(`Testing ${source.name}...`);
    try {
      const start = Date.now();
      const resp = await fetch(source.url, { signal: AbortSignal.timeout(5000) });
      const status = resp.status;
      const end = Date.now();
      console.log(`${source.name} status: ${status} in ${end - start}ms`);
      if (status !== 200) {
        const text = await resp.text();
        console.log(`${source.name} error: ${text.substring(0, 100)}`);
      }
    } catch (e) {
      console.log(`${source.name} failed: ${e.message}`);
    }
  }
}

testFetch();
