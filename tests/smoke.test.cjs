const { WebSocket } = require('ws');

function delay(ms){ return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const url = 'ws://localhost:8080/ws';
  const a = new WebSocket(url);
  const b = new WebSocket(url);
  const msgsA = [];
  const msgsB = [];
  a.on('message', d => msgsA.push(JSON.parse(d.toString())));
  b.on('message', d => msgsB.push(JSON.parse(d.toString())));
  await new Promise(res => a.on('open', res));
  await new Promise(res => b.on('open', res));
  a.send(JSON.stringify({ type: 'join_room', roomId: 'default', name: 'A' }));
  b.send(JSON.stringify({ type: 'join_room', roomId: 'default', name: 'B' }));
  await delay(200);
  a.send(JSON.stringify({ type: 'start' }));
  await delay(200);
  a.send(JSON.stringify({ type: 'input_down' }));
  await delay(100);
  a.send(JSON.stringify({ type: 'input_up', t: 500 }));
  await delay(300);
  const lastA = msgsA.filter(m => m.type === 'state_update').pop();
  if (!lastA || !Array.isArray(lastA.players) || lastA.players.length < 1) {
    console.error('state_update not received or players missing');
    process.exit(1);
  }
  console.log('Smoke test passed');
  a.close();
  b.close();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
