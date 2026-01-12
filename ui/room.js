;(function(){
  function $(id){ return document.getElementById(id); }
  const ready = $('btn-ready');
  const start = $('btn-start');
  const toggle = $('room-toggle');
  const panel = $('room-ui');
  const quick = $('btn-quick');
  const createBtn = $('btn-create');
  const codeBtn = $('btn-code');
  const modal = $('mp-join-modal');
  const inputCode = $('input-room-code');
  const inputName = $('input-name');
  const modalJoin = $('modal-join');
  const modalCancel = $('modal-cancel');
  const roomDisplay = $('room-display');
  const overlay = $('mp-overlay');
  const ovClose = $('mp-close');
  const ovQuick = $('ov-quick');
  const ovCreate = $('ov-create');
  const ovJoin = $('ov-join');
  const ovRoomCode = $('ov-room-code');
  const ovName = $('ov-name');
  const ovReady = $('ov-ready');
  const ovStart = $('ov-start');
  const ovPlayers = $('mp-players');
  const tabs = Array.from(document.querySelectorAll('.mp-tab'));
  const sections = Array.from(document.querySelectorAll('.mp-section'));
  function randId(len){
    const chars = 'ABCDEFGHJKMNPQRSTWXYZ23456789';
    let s = '';
    for (let i=0;i<len;i++) s += chars[Math.floor(Math.random()*chars.length)];
    return s;
  }
  function setRoomText(id){
    if (roomDisplay) roomDisplay.textContent = id ? ('房间：' + id) : '';
    const el = document.getElementById('mp-status');
    if (el) el.textContent = id ? ('房间：' + id) : '';
  }
  function connect(room, name){
    if (!window.MultiplayerNet) return;
    if (typeof window.useMultiplayer !== 'undefined') window.useMultiplayer = true;
    window.MultiplayerNet.connect(room || 'default', name || ('玩家' + randId(3)));
    if (window.MPLeaderboard) window.MPLeaderboard.status('已加入房间：' + (room || 'default'));
    setRoomText(room || 'default');
  }
  if (toggle) toggle.onclick = function(){
    if (overlay) overlay.classList.toggle('hidden');
  };
  if (ovClose) ovClose.onclick = function(){ if (overlay) overlay.classList.add('hidden'); };
  tabs.forEach(btn => {
    btn.onclick = function(){
      tabs.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const key = btn.getAttribute('data-tab');
      sections.forEach(sec => sec.classList.toggle('hidden', sec.getAttribute('data-section') !== key));
    };
  });
  if (quick) quick.onclick = function(){
    connect('public-' + randId(5), '');
  };
  if (ovQuick) ovQuick.onclick = function(){
    connect('public-' + randId(5), '');
    if (overlay) overlay.classList.add('hidden');
  };
  if (createBtn) createBtn.onclick = async function(){
    const id = 'room-' + randId(6);
    const url = new URL(location.href);
    url.searchParams.set('room', id);
    const name = '玩家' + randId(3);
    url.searchParams.set('name', name);
    try {
      await navigator.clipboard.writeText(url.toString());
      if (window.MPLeaderboard) window.MPLeaderboard.status('邀请链接已复制：' + id);
    } catch(e) {
      if (window.MPLeaderboard) window.MPLeaderboard.status('复制失败，请手动分享：' + url.toString());
    }
    connect(id, name);
  };
  if (ovCreate) ovCreate.onclick = async function(){
    const id = 'room-' + randId(6);
    const url = new URL(location.href);
    url.searchParams.set('room', id);
    const name = '玩家' + randId(3);
    url.searchParams.set('name', name);
    try {
      await navigator.clipboard.writeText(url.toString());
      if (window.MPLeaderboard) window.MPLeaderboard.status('邀请链接已复制：' + id);
    } catch(e) {
      if (window.MPLeaderboard) window.MPLeaderboard.status('复制失败，请手动分享：' + url.toString());
    }
    connect(id, name);
    if (overlay) overlay.classList.add('hidden');
  };
  if (codeBtn) codeBtn.onclick = function(){
    if (modal) modal.classList.remove('hidden');
  };
  if (modalCancel) modalCancel.onclick = function(){
    if (modal) modal.classList.add('hidden');
  };
  if (modalJoin) modalJoin.onclick = function(){
    const id = (inputCode && inputCode.value || '').trim();
    const name = (inputName && inputName.value || '').trim();
    if (!id) {
      if (window.MPLeaderboard) window.MPLeaderboard.status('请输入房间码');
      return;
    }
    connect(id, name);
    if (modal) modal.classList.add('hidden');
  };
  if (ovJoin) ovJoin.onclick = function(){
    const id = (ovRoomCode && ovRoomCode.value || '').trim();
    const name = (ovName && ovName.value || '').trim();
    if (!id) {
      if (window.MPLeaderboard) window.MPLeaderboard.status('请输入房间码');
      return;
    }
    connect(id, name);
    if (overlay) overlay.classList.add('hidden');
  };
  if (ready) ready.onclick = function(){
    if (!window.MultiplayerNet) return;
    window.MultiplayerNet.ready();
    if (window.MPLeaderboard) window.MPLeaderboard.status('已准备，等待开始');
  };
  if (start) start.onclick = function(){
    if (!window.MultiplayerNet) return;
    window.MultiplayerNet.start();
    if (window.MPLeaderboard) window.MPLeaderboard.status('游戏开始！');
  };
  if (ovReady) ovReady.onclick = function(){
    if (!window.MultiplayerNet) return;
    window.MultiplayerNet.ready();
    if (window.MPLeaderboard) window.MPLeaderboard.status('已准备，等待开始');
  };
  if (ovStart) ovStart.onclick = function(){
    if (!window.MultiplayerNet) return;
    window.MultiplayerNet.start();
    if (window.MPLeaderboard) window.MPLeaderboard.status('游戏开始！');
  };

  if (window.MultiplayerNet) {
    window.MultiplayerNet.onLeaderboard((msg) => {
      if (window.MPLeaderboard) window.MPLeaderboard.update(msg.players || []);
      if (ovPlayers) {
        const arr = (msg.players || []).slice();
        ovPlayers.innerHTML = '';
        arr.forEach(p => {
          const row = document.createElement('div');
          row.className = 'mp-player';
          const name = document.createElement('div');
          name.className = 'mp-player-name';
          name.textContent = p.name || p.id;
          const readyChip = document.createElement('div');
          readyChip.className = 'mp-ready';
          readyChip.textContent = p.ready ? '已准备' : '';
          row.appendChild(name);
          row.appendChild(readyChip);
          ovPlayers.appendChild(row);
        });
      }
    });
    window.MultiplayerNet.onRoomUpdate((msg) => {
      if (window.MPLeaderboard) window.MPLeaderboard.update(msg.players || []);
      if (ovPlayers) {
        const arr = (msg.players || []).slice();
        ovPlayers.innerHTML = '';
        arr.forEach(p => {
          const row = document.createElement('div');
          row.className = 'mp-player';
          const name = document.createElement('div');
          name.className = 'mp-player-name';
          name.textContent = p.name || p.id;
          const readyChip = document.createElement('div');
          readyChip.className = 'mp-ready';
          readyChip.textContent = p.ready ? '已准备' : '';
          row.appendChild(name);
          row.appendChild(readyChip);
          ovPlayers.appendChild(row);
        });
      }
    });
  }
  // URL参数支持：?room=XXXX&name=YYY&auto=1
  (function(){
    const usp = new URLSearchParams(location.search);
    const r = usp.get('room'); const n = usp.get('name'); const auto = usp.get('auto');
    setRoomText(r);
    if (auto === '1' && r) connect(r, n || undefined);
  })();
})(); 
