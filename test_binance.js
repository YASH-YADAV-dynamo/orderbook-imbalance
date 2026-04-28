const WebSocket = require('ws');

const ws = new WebSocket('wss://fstream.binance.com/ws/btcusdt@aggTrade');
console.log('Connecting to Binance...');

ws.on('open', () => {
    console.log('OPENED');
    ws.send(JSON.stringify({
        method: 'SUBSCRIBE',
        params: ['ethusdt@aggTrade', 'solusdt@aggTrade'],
        id: 1
    }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('RAW:', msg);
    if (msg.e === 'aggTrade') {
        console.log('PARSED:', {
            symbol: msg.s.replace('USDT', ''),
            price: parseFloat(msg.p),
            qty: parseFloat(msg.q)
        });
        process.exit(0);
    }
});

ws.on('error', (err) => console.log('ERROR:', err));
