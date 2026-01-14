// 网络同步模块
class NetworkManager {
    constructor(scene) {
        Logger.info("Network", "🌐 初始化网络管理器", "处理WebSocket连接与状态同步");
        this.scene = scene; // 传入场景引用
        this.socket = null;
        this.remotePlayers = {}; // { socketId: mesh }
        this.nameTags = {}; // { socketId: htmlElement }
        this.lastMovementEmitTime = 0;
        this.statusHandler = null;
        this.scoreGetter = null;
        this.nickname = '';
        this.characterType = 'nezha';
        this.leaderboardUpdateCallback = null;
    }

    connect(nickname, characterType = 'nezha') {
        Logger.info("Network", `🔗 开始连接服务器: ${nickname}`, "建立Socket.io长连接");
        this.nickname = nickname;
        this.characterType = characterType;
        this.notifyStatus('connecting');
        
        // 检查 socket.io 是否加载
        if (typeof io === 'undefined') {
            Logger.error("Network", "Socket.io 库未加载", "无法建立连接，进入单机模式");
            this.notifyStatus('error');
            return;
        }

        try {
            this.socket = io();
        } catch (e) {
            Logger.error("Network", "连接失败", e.message);
            this.notifyStatus('error');
            return;
        }

        this.setupHandlers();
        
        // 连接成功后发送昵称
        this.socket.on('connect', () => {
            this.notifyStatus('connected');
            this.socket.emit('setNickname', this.nickname);
            this.socket.emit('setCharacterType', this.characterType);
            const currentScore = this.scoreGetter ? this.scoreGetter() : 0;
            this.socket.emit('scoreUpdate', currentScore);
        });

        this.socket.on('disconnect', () => {
            this.notifyStatus('disconnected');
        });

        this.socket.io.on('reconnect_attempt', () => {
            this.notifyStatus('reconnecting');
        });

        this.socket.io.on('reconnect', () => {
            this.notifyStatus('connected');
            this.clearRemoteState();
            this.socket.emit('setNickname', this.nickname);
            this.socket.emit('setCharacterType', this.characterType);
            const currentScore = this.scoreGetter ? this.scoreGetter() : 0;
            this.socket.emit('scoreUpdate', currentScore);
        });

        this.socket.io.on('reconnect_failed', () => {
            this.notifyStatus('error');
        });
    }

    setupHandlers() {
        this.socket.on('currentPlayers', (players) => {
            Object.keys(players).forEach((id) => {
                if (id === this.socket.id) return;
                this.createRemotePlayer(id, players[id]);
            });
        });

        this.socket.on('newPlayer', (playerInfo) => {
            if (playerInfo.id === this.socket.id) return;
            this.createRemotePlayer(playerInfo.id, playerInfo);
        });
        
        this.socket.on('playerInfoUpdate', (playerInfo) => {
            if (playerInfo.isSpectator) {
                // 如果玩家转为观战者，移除其实体
                this.removeRemotePlayer(playerInfo.id);
                return;
            }
            // 更新昵称显示
            this.createNameTag(playerInfo.id, playerInfo.nickname, playerInfo.id === this.socket.id);
        });

        this.socket.on('playerMoved', (playerInfo) => {
            if (this.remotePlayers[playerInfo.id]) {
                const rp = this.remotePlayers[playerInfo.id];
                // 平滑移动目标
                rp.userData.targetPos = { x: playerInfo.x, y: playerInfo.y, z: playerInfo.z };
                rp.userData.targetRot = playerInfo.rotationY;
            }
        });

        this.socket.on('playerDisconnected', (id) => {
            this.removeRemotePlayer(id);
        });

        this.socket.on('leaderboardUpdate', (leaderboard) => {
            this.updateLeaderboardUI(leaderboard);
        });

        this.socket.on('highScoresUpdate', (scores) => {
            this.updateHighScoresUI(scores);
        });

        // 初始化 Tab 事件
        if (!this.tabsInitialized) {
            this.initLeaderboardTabs();
            this.tabsInitialized = true;
        }
    }

    initLeaderboardTabs() {
        const tabs = document.querySelectorAll('.lb-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.stopPropagation(); // 防止触发 canvas 点击
                // 切换 Tab 样式
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // 切换列表显示
                const target = tab.dataset.target;
                const onlineList = document.getElementById('leaderboard-list');
                const historyList = document.getElementById('highscore-list');
                
                if (target === 'online') {
                    onlineList.style.display = 'block';
                    historyList.style.display = 'none';
                    onlineList.classList.add('active');
                    historyList.classList.remove('active');
                } else {
                    onlineList.style.display = 'none';
                    historyList.style.display = 'block';
                    onlineList.classList.remove('active');
                    historyList.classList.add('active');
                }
            });
        });
    }

    emitMovement(position, rotationY) {
        if (!this.socket) return;
        
        const now = Date.now();
        if (now - this.lastMovementEmitTime >= config.movementEmitInterval) {
            this.socket.emit('playerMovement', {
                x: position.x,
                y: position.y,
                z: position.z,
                rotationY: rotationY
            });
            this.lastMovementEmitTime = now;
        }
    }

    emitScore(score) {
        if (this.socket) {
            this.socket.emit('scoreUpdate', score);
        }
    }

    submitResult(score) {
        if (this.socket) {
            this.socket.emit('submitResult', score);
        }
    }

    createRemotePlayer(id, data) {
        // 观战者不创建实体
        if (data.isSpectator) return;

        // 远程玩家也是哪吒，但可能半透明或者颜色不同
        const mesh = createCharacterMesh(false, data.characterType || 'nezha'); 
        mesh.position.set(data.x, data.y, data.z);
        mesh.rotation.y = data.rotationY;
        
        mesh.userData.targetPos = { x: data.x, y: data.y, z: data.z };
        mesh.userData.targetRot = data.rotationY;
        mesh.userData.nickname = data.nickname;

        // 默认半透明
        this.setMeshOpacity(mesh, 0.7);

        this.scene.add(mesh);
        this.remotePlayers[id] = mesh;
        
        // 创建名牌
        if (data.nickname) {
            this.createNameTag(id, data.nickname, false);
        }
    }

    setMeshOpacity(mesh, opacity) {
        mesh.traverse(child => {
            if (child.isMesh && child.material) {
                if (!Array.isArray(child.material)) {
                    // 确保 material 是唯一的，不影响其他实例
                    if (!child.userData.hasClonedMaterial) {
                         child.material = child.material.clone();
                         child.userData.hasClonedMaterial = true;
                    }
                    child.material.transparent = opacity < 1;
                    child.material.opacity = opacity;
                }
            }
        });
    }

    setPlayerOpacity(id, opacity) {
        if (this.remotePlayers[id]) {
            this.setMeshOpacity(this.remotePlayers[id], opacity);
        }
    }

    getRemotePlayerNickname(id) {
        // 从 nameTag 获取或者存储在 userData 中
        // 目前 createRemotePlayer 没有存 nickname 到 mesh.userData，只用来创建 nameTag
        // 我们可以从 nameTags 中反查，或者最好在 createRemotePlayer 时存一下
        if (this.remotePlayers[id] && this.remotePlayers[id].userData.nickname) {
            return this.remotePlayers[id].userData.nickname;
        }
        return 'Unknown';
    }


    removeRemotePlayer(id) {
        if (this.remotePlayers[id]) {
            this.scene.remove(this.remotePlayers[id]);
            // 清理
            this.remotePlayers[id].traverse(child => {
                 if (child.isMesh) {
                     if (child.geometry) child.geometry.dispose();
                     if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material.dispose();
                     }
                 }
            });
            delete this.remotePlayers[id];
        }
        // 清理名牌
        if (this.nameTags[id]) {
            if (this.nameTags[id].parentNode) this.nameTags[id].parentNode.removeChild(this.nameTags[id]);
            delete this.nameTags[id];
        }
    }

    createNameTag(id, name, isMe) {
        // 尝试通过 ID 查找现有的 DOM 元素，防止 nameTags 引用丢失导致的重复
        let tag = this.nameTags[id];
        if (!tag) {
            tag = document.querySelector(`.player-name-tag[data-id="${id}"]`);
        }

        // 移除旧的
        if (tag && tag.parentNode) {
            tag.parentNode.removeChild(tag);
        }

        tag = document.createElement('div');
        tag.className = 'player-name-tag' + (isMe ? ' me' : '');
        tag.innerText = name;
        tag.dataset.id = id; // 绑定 ID 到 DOM
        document.body.appendChild(tag);
        this.nameTags[id] = tag;
        return tag;
    }

    updateNameTags(playerPosition, camera) {
        const activeIds = new Set();

        // 更新我的名牌
        if (playerPosition && this.socket) {
            activeIds.add(this.socket.id);
            if (this.nameTags[this.socket.id]) {
                this.updateTagPosition(playerPosition, this.nameTags[this.socket.id], camera);
            }
        }

        // 更新远程玩家名牌
        Object.keys(this.remotePlayers).forEach(id => {
            activeIds.add(id);
            if (this.remotePlayers[id] && this.nameTags[id]) {
                this.updateTagPosition(this.remotePlayers[id].position, this.nameTags[id], camera);
            }
        });

        // 清理僵尸标签
        Object.keys(this.nameTags).forEach(id => {
            if (!activeIds.has(id)) {
                if (this.nameTags[id].parentNode) this.nameTags[id].parentNode.removeChild(this.nameTags[id]);
                delete this.nameTags[id];
            }
        });

        // 扫描 DOM 清理漏网之鱼
        document.querySelectorAll('.player-name-tag').forEach(tag => {
            const id = tag.dataset.id;
            if (!id || !activeIds.has(id)) {
                if (tag.parentNode) tag.parentNode.removeChild(tag);
            }
        });
    }

    updateTagPosition(pos, tag, camera) {
        // 头部上方
        const tempV = new THREE.Vector3(pos.x, pos.y + 2.5, pos.z);
        tempV.project(camera);

        const x = (tempV.x * .5 + .5) * window.innerWidth;
        const y = (-(tempV.y * .5) + .5) * window.innerHeight;

        tag.style.left = `${x}px`;
        tag.style.top = `${y}px`;
        
        // 如果在视野外隐藏
        if (Math.abs(tempV.z) > 1) {
            tag.style.display = 'none';
        } else {
            tag.style.display = 'block';
        }
    }

    updateRemotePlayers() {
        Object.keys(this.remotePlayers).forEach(id => {
            const rp = this.remotePlayers[id];
            if (rp.userData.targetPos) {
                // 计算距离，根据距离调整插值速度
                const dx = rp.userData.targetPos.x - rp.position.x;
                const dy = rp.userData.targetPos.y - rp.position.y;
                const dz = rp.userData.targetPos.z - rp.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                // 动态插值系数
                const lerpFactor = Math.min(0.3, Math.max(0.05, distance * 0.05));
                
                // 插值平滑移动
                rp.position.x += dx * lerpFactor;
                rp.position.y += dy * lerpFactor;
                rp.position.z += dz * lerpFactor;
                
                // 如果距离很小，直接设置目标位置
                if (distance < 0.01) {
                    rp.position.set(rp.userData.targetPos.x, rp.userData.targetPos.y, rp.userData.targetPos.z);
                }
                
                // 角度插值
                let delta = rp.userData.targetRot - rp.rotation.y;
                if (delta > Math.PI) delta -= 2 * Math.PI;
                if (delta < -Math.PI) delta += 2 * Math.PI;
                
                if (Math.abs(delta) > 0.01) {
                    rp.rotation.y += delta * lerpFactor * 2;
                } else {
                    rp.rotation.y = rp.userData.targetRot;
                }
            }
            // 风火轮动画
            if (rp.userData.wheels) {
                 rp.userData.wheels.forEach(wheel => {
                     wheel.rotation.z -= 0.2; 
                 });
            }
        });
    }

    updateLeaderboardUI(leaderboard) {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '';
        leaderboard.forEach((p, index) => {
            const li = document.createElement('li');
            li.dataset.id = p.id; // 绑定 ID 方便点击
            li.style.cursor = 'pointer';
            
            const displayName = p.nickname || p.id.substring(0, 4);
            const isMe = p.id === this.socket.id ? ' (我)' : '';
            li.innerHTML = `<span>#${index + 1} ${displayName}${isMe}</span> <span>${p.score}</span>`;
            
            list.appendChild(li);
        });

        if (this.leaderboardUpdateCallback) {
            this.leaderboardUpdateCallback();
        }
    }

    updateHighScoresUI(scores) {
        const list = document.getElementById('highscore-list');
        list.innerHTML = '';
        scores.forEach((p, index) => {
            const li = document.createElement('li');
            // const date = new Date(p.date);
            // const dateStr = `${date.getMonth()+1}/${date.getDate()}`;
            li.innerHTML = `<span>#${index + 1} ${p.nickname}</span> <span>${p.score}</span>`;
            list.appendChild(li);
        });
    }

    getId() {
        return this.socket ? this.socket.id : null;
    }

    setStatusHandler(handler) {
        this.statusHandler = handler;
    }

    notifyStatus(status) {
        if (typeof this.statusHandler === 'function') {
            this.statusHandler(status);
        }
    }

    setScoreGetter(fn) {
        this.scoreGetter = fn;
    }

    setLeaderboardUpdateCallback(cb) {
        this.leaderboardUpdateCallback = cb;
    }

    clearRemoteState() {
        Object.keys(this.remotePlayers).forEach((id) => this.removeRemotePlayer(id));
    }
}
