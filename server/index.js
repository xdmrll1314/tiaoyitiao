import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

function contentType(p) {
  if (p.endsWith('.html')) return 'text/html; charset=utf-8';
  if (p.endsWith('.css')) return 'text/css; charset=utf-8';
  if (p.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg';
  return 'text/plain; charset=utf-8';
}

const server = http.createServer((req, res) => {
  if (req.url === '/ws') {
    res.writeHead(426);
    res.end('Use WebSocket');
    return;
  }
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  const filePath = path.join(root, urlPath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    res.end(data);
  });
});

const wss = new WebSocketServer({ noServer: true });

const rooms = new Map();

function getRoom(id) {
  if (!rooms.has(id)) {
    rooms.set(id, {
      id,
      phase: 'waiting',
      players: new Map(),
      tick: 0,
      blocks: []
    });
  }
  return rooms.get(id);
}

function broadcast(room, msg) {
  const data = JSON.stringify(msg);
  room.players.forEach(p => {
    if (p.ws.readyState === 1) p.ws.send(data);
  });
}

function randomBlocks(seed = Date.now()) {
  const rng = (function(s){ let x = s; return () => (x = (x * 1664525 + 1013904223) % 0xffffffff) / 0xffffffff; })(seed);
  const arr = [];
  let x = 0, z = 0;
  for (let i = 0; i < 8; i++) {
    const distance = 4 + Math.floor(rng() * 5);
    const dirX = rng() > 0.5;
    if (dirX) x -= distance; else z -= distance;
    arr.push({ id: i, x, z });
  }
  return arr;
}

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws) => {
  let room = null;
  let me = null;
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const buildLB = () => {
      const arr = Array.from(room.players.values()).map(p => p.state);
      arr.sort((a,b) => (b.score||0) - (a.score||0));
      return arr;
    };
    if (msg.type === 'join_room') {
      room = getRoom(msg.roomId || 'default');
      const id = 'p_' + Math.random().toString(36).slice(2, 8);
      me = { id, name: msg.name || id, color: msg.color || '#409EFF', isCharging: false, score: 0, combo: 0, x: 0, y: 1, z: 0 };
      room.players.set(id, { ws, state: me });
      ws.send(JSON.stringify({ type: 'room_update', players: Array.from(room.players.values()).map(p => p.state), phase: room.phase }));
      broadcast(room, { type: 'room_update', players: Array.from(room.players.values()).map(p => p.state), phase: room.phase });
      broadcast(room, { type: 'leaderboard', players: buildLB() });
    } else if (msg.type === 'ready') {
      if (!room) return;
      room.phase = 'ready';
      broadcast(room, { type: 'room_update', players: Array.from(room.players.values()).map(p => p.state), phase: room.phase });
      broadcast(room, { type: 'leaderboard', players: buildLB() });
    } else if (msg.type === 'start') {
      if (!room) return;
      room.phase = 'playing';
      room.blocks = randomBlocks(Date.now());
      room.tick = 0;
      broadcast(room, { type: 'start', seed: Date.now(), blocksInit: room.blocks });
      broadcast(room, { type: 'leaderboard', players: buildLB() });
    } else if (msg.type === 'input_down') {
      if (!room || !me) return;
      me.isCharging = true;
      broadcast(room, { type: 'room_update', players: Array.from(room.players.values()).map(p => p.state), phase: room.phase });
    } else if (msg.type === 'input_up') {
      if (!room || !me) return;
      const maxTime = 1500;
      const duration = Math.min(msg.t || 0, maxTime);
      const power = duration * 0.01;
      const last = room.blocks[Math.max(0, room.blocks.length - 2)] || { x: 0, z: 0 };
      const next = room.blocks[room.blocks.length - 1] || { x: -4, z: 0 };
      let dirx = 0, dirz = 0;
      if (next.x < last.x) dirx = -1; else dirz = -1;
      const tx = me.x + dirx * power * 0.055 * 60;
      const tz = me.z + dirz * power * 0.055 * 60;
      me.x = tx;
      me.z = tz;
      me.y = 1;
      me.isCharging = false;
      room.tick++;
      broadcast(room, { type: 'state_update', tick: room.tick, players: Array.from(room.players.values()).map(p => p.state) });
      broadcast(room, { type: 'leaderboard', players: buildLB() });
    } else if (msg.type === 'score_update') {
      if (!room || !me) return;
      me.score = Number(msg.score || 0);
      me.combo = Number(msg.combo || 0);
      broadcast(room, { type: 'leaderboard', players: buildLB() });
    }
  });
  ws.on('close', () => {
    if (room && me) {
      room.players.delete(me.id);
      broadcast(room, { type: 'room_update', players: Array.from(room.players.values()).map(p => p.state), phase: room.phase });
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log('Server listening on http://localhost:' + PORT);
});
