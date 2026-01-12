;(function(){
  const URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  function Net(){
    this.ws = null;
    this.connected = false;
    this.roomId = 'default';
    this.name = 'player_' + Math.random().toString(36).slice(2,6);
    this.handlers = { room: null, state: null };
    this.handlers.leaderboard = null;
  }
  Net.prototype.connect = function(roomId, name){
    if (roomId) this.roomId = roomId;
    if (name) this.name = name;
    this.ws = new WebSocket(URL);
    this.ws.onopen = () => {
      this.connected = true;
      this.ws.send(JSON.stringify({ type: 'join_room', roomId: this.roomId, name: this.name }));
    };
    this.ws.onmessage = (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'room_update' && this.handlers.room) this.handlers.room(msg);
      if (msg.type === 'state_update' && this.handlers.state) this.handlers.state(msg);
      if (msg.type === 'start' && this.handlers.room) this.handlers.room(msg);
      if (msg.type === 'leaderboard' && this.handlers.leaderboard) this.handlers.leaderboard(msg);
    };
    this.ws.onclose = () => { this.connected = false; };
  };
  Net.prototype.onRoomUpdate = function(fn){ this.handlers.room = fn; };
  Net.prototype.onStateUpdate = function(fn){ this.handlers.state = fn; };
  Net.prototype.onLeaderboard = function(fn){ this.handlers.leaderboard = fn; };
  Net.prototype.ready = function(){ if (this.ws) this.ws.send(JSON.stringify({ type: 'ready' })); };
  Net.prototype.start = function(){ if (this.ws) this.ws.send(JSON.stringify({ type: 'start' })); };
  Net.prototype.inputDown = function(){ if (this.ws) this.ws.send(JSON.stringify({ type: 'input_down' })); };
  Net.prototype.inputUp = function(t){ if (this.ws) this.ws.send(JSON.stringify({ type: 'input_up', t })); };
  Net.prototype.sendScore = function(score, combo){ if (this.ws) this.ws.send(JSON.stringify({ type: 'score_update', score, combo })); };
  window.MultiplayerNet = new Net();
})();
