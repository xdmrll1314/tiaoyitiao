;(function(){
  const el = document.getElementById('mp-leaderboard');
  const statusEl = document.getElementById('mp-status');
  const state = { list: [], meId: null };
  function setStatus(text){
    if (!statusEl) return;
    statusEl.textContent = text || '';
  }
  function renderList(arr){
    if (!el) return;
    const fragment = document.createDocumentFragment();
    arr.forEach((p, idx) => {
      const row = document.createElement('div');
      row.className = 'mp-row' + (p.id === state.meId ? ' me' : '');
      const rank = document.createElement('div');
      rank.className = 'mp-rank';
      rank.textContent = String(idx + 1);
      const name = document.createElement('div');
      name.className = 'mp-name';
      name.textContent = p.name || p.id;
      const score = document.createElement('div');
      score.className = 'mp-score';
      score.textContent = (p.score || 0);
      const combo = document.createElement('div');
      combo.className = 'mp-combo';
      combo.textContent = p.combo > 0 ? ('x' + p.combo) : '';
      row.appendChild(rank);
      row.appendChild(name);
      row.appendChild(score);
      row.appendChild(combo);
      fragment.appendChild(row);
    });
    el.innerHTML = '';
    el.appendChild(fragment);
  }
  function sortPlayers(players){
    return players.slice().sort((a,b) => (b.score||0) - (a.score||0));
  }
  function updateLeaderboard(players){
    state.list = sortPlayers(players);
    renderList(state.list);
  }
  window.MPLeaderboard = {
    setMeId: function(id){ state.meId = id; },
    update: updateLeaderboard,
    status: setStatus
  };
  // 初始状态文本
  setStatus('未加入多人房间');
  var toggle = document.getElementById('lb-toggle');
  if (toggle && el) {
    toggle.onclick = function(){ el.classList.toggle('collapsed'); };
  }
})(); 
