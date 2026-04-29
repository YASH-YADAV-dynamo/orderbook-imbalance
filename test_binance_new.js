const WebSocket = require('ws');

const ws = new WebSocket('wss://fstream.binance.com/ws');

ws.on('open', () => {
  console.log('Connected to Binance');
  
  const payload = {
    method: 'SUBSCRIBE',
    params: [
      'btcusdt@aggTrade',
      'ethusdt@aggTrade'
    ],
    id: 1
  };
  
  console.log('Sending payload:', JSON.stringify(payload));
  ws.send(JSON.stringify(payload));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
});

ws.on('error', (err) => {
  console.error('Error:', err);
});

ws.on('close', () => {
  console.log('Connection closed');
});
