// 主游戏逻辑文件
// 注意：config, Easing, AudioManager, ParticleSystem, RippleSystem, CloudSystem, ResourceManager, createCharacterMesh 已移至独立模块

// 全局变量
let scene, camera, renderer, dirLight;
let player, innerPlayer, audioManager, particleSystem;
let cloudSystem, rippleSystem; // 新增特效系统
let blocks = [];
let score = 0;
let combo = 0;
let isGameRunning = false;
let isCharging = false;
let chargeStartTime = 0;
let velocity = { x: 0, y: 0, z: 0 };
let rotateSpeed = 0; 
let targetRotationY = 0; 
let animations = []; 
let nickname = 'Unknown';
let powerBar, powerBarContainer; // 缓存 DOM 元素
let guideOverlay, guideCloseBtn, guideNeverBtn;
let connectionStatusBar, audioToggleBtn;
let audioEnabled = true;
let hasSeenGuide = false;
let connectionStatusTimer = null;

let cameraShake = { x: 0, y: 0, z: 0 }; // 相机震动
let cameraZoom = 1; // 相机缩放
let nextBlockBuff = null; // 'large', 'small'
let likeCount = 0;
let isWaitingRevive = false;
let reviveTimer = null;
let currentBlockScale = 1;

// 多人游戏变量
let isSpectator = false;
let spectatorTargetId = null; // 观战目标 ID
let networkManager; // NetworkManager 实例

function init() {
    // 场景
    scene = new THREE.Scene();

    // 相机
    const aspect = window.innerWidth / window.innerHeight;
    const d = 18; 
    camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    camera.position.set(20, 20, 20);
    camera.lookAt(scene.position);

    // 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); 
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 解决模糊问题，限制最大2倍提升性能
    renderer.shadowMap.enabled = true;
    // 使用 PCF 阴影（平衡质量和性能），低端设备可改为 BasicShadowMap
    renderer.shadowMap.type = THREE.PCFShadowMap; // 从 PCFSoftShadowMap 改为 PCFShadowMap 提升性能
    document.body.appendChild(renderer.domElement);

    // 灯光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const dirLightObj = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLightObj.position.set(10, 30, 20);
    dirLightObj.castShadow = true;
    // 优化阴影贴图尺寸：降低到 1024 提升性能（原 2048）
    dirLightObj.shadow.mapSize.width = config.shadowMapSize;
    dirLightObj.shadow.mapSize.height = config.shadowMapSize;
    // 缩小阴影相机范围，只渲染必要区域
    dirLightObj.shadow.camera.left = -config.shadowCameraSize;
    dirLightObj.shadow.camera.right = config.shadowCameraSize;
    dirLightObj.shadow.camera.top = config.shadowCameraSize;
    dirLightObj.shadow.camera.bottom = -config.shadowCameraSize;
    dirLightObj.shadow.camera.near = 0.5;
    dirLightObj.shadow.camera.far = 50;
    // 使用更高效的阴影类型
    dirLightObj.shadow.bias = -0.0001; // 减少阴影瑕疵
    scene.add(dirLightObj);
    dirLight = dirLightObj;

    // 辅助系统
    audioManager = new AudioManager();
    particleSystem = new ParticleSystem(scene);
    cloudSystem = new CloudSystem(scene);
    rippleSystem = new RippleSystem(scene);
    ResourceManager.init();
    
    // 读取音频偏好
    const storedAudio = localStorage.getItem(config.audioStorageKey);
    audioEnabled = storedAudio !== 'false';
    audioManager.setEnabled(audioEnabled);
    
    // 初始化网络管理器（传入场景引用）
    networkManager = new NetworkManager(scene);
    networkManager.setStatusHandler(updateConnectionStatusUI);
    networkManager.setScoreGetter(() => score);
    networkManager.setLeaderboardUpdateCallback(() => {
        if (isSpectator && spectatorTargetId) {
             document.querySelectorAll('#leaderboard-list li').forEach(el => {
                if (el.dataset.id === spectatorTargetId) {
                    el.style.background = 'rgba(255, 255, 255, 0.2)';
                } else {
                    el.style.background = '';
                }
            });
        }
    });
    
    // 缓存 DOM
    powerBar = document.getElementById('power-bar');
    powerBarContainer = document.getElementById('power-bar-container');
    guideOverlay = document.getElementById('guide-overlay');
    guideCloseBtn = document.getElementById('guide-close');
    guideNeverBtn = document.getElementById('guide-never');
    connectionStatusBar = document.getElementById('connection-status');
    audioToggleBtn = document.getElementById('audio-toggle');

    hasSeenGuide = localStorage.getItem(config.guideStorageKey) === '1';
    updateAudioToggleUI();

    // resetGame();

    document.getElementById('spectate-btn').addEventListener('click', startSpectatorMode);

    // 观战模式下点击排行榜切换视角
    document.getElementById('leaderboard-list').addEventListener('click', (e) => {
        if (!isSpectator) return;
        const li = e.target.closest('li');
        if (li && li.dataset.id) {
            setSpectatorTarget(li.dataset.id);
        }
    });

    // 事件
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.repeat) onMouseDown(e);
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') onMouseUp(e);
    });
    
    const inputStart = (e) => {
        // 如果点击的是 UI 元素 (按钮等)，则不触发游戏逻辑，也不阻止默认行为
        if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'INPUT') {
            return;
        }

        if(e.type === 'touchstart') e.preventDefault();
        onMouseDown(e);
    };
    const inputEnd = (e) => {
        // 同样放行按钮点击
        if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'INPUT') {
            return;
        }

        if(e.type === 'touchend') e.preventDefault();
        onMouseUp(e);
    };

    document.addEventListener('mousedown', inputStart);
    document.addEventListener('mouseup', inputEnd);
    document.addEventListener('touchstart', inputStart, { passive: false });
    document.addEventListener('touchend', inputEnd, { passive: false });
    
    document.getElementById('restart-btn').addEventListener('click', () => {
        document.getElementById('game-over').style.display = 'none';
        resetGame();
    });

    if (audioToggleBtn) {
        audioToggleBtn.addEventListener('click', toggleAudio);
    }

    if (guideCloseBtn) {
        guideCloseBtn.addEventListener('click', () => hideGuide(true));
    }
    if (guideNeverBtn) {
        guideNeverBtn.addEventListener('click', () => hideGuide(true, true));
    }

    // 登录逻辑
    document.getElementById('start-game-btn').addEventListener('click', () => {
        const input = document.getElementById('nickname-input');
        const val = input.value.trim();
        if (val) {
            nickname = val;
            document.getElementById('login-modal').style.display = 'none';
            startGame();
            showGuideIfNeeded();
        } else {
            alert('请输入昵称');
        }
    });

    // 检查是否为主播模式
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'streamer') {
        initStreamerMode();
    }

    animate();
}

function initStreamerMode() {
    // 隐藏登录框
    document.getElementById('login-modal').style.display = 'none';
    
    // 设置背景透明
    document.body.classList.add('streamer-mode');
    
    // 自动登录
    nickname = '主播';
    startGame();
    
    // 隐藏不必要的 UI
    if (audioToggleBtn) audioToggleBtn.style.display = 'none';
    const guide = document.getElementById('touch-indicator');
    if (guide) guide.style.display = 'none';

    // 初始化直播模拟器
    initLiveSimulator();
}

function initLiveSimulator() {
    const simDiv = document.createElement('div');
    simDiv.style.position = 'absolute';
    simDiv.style.bottom = '10px';
    simDiv.style.right = '10px';
    simDiv.style.background = 'rgba(0,0,0,0.7)';
    simDiv.style.padding = '10px';
    simDiv.style.borderRadius = '8px';
    simDiv.style.color = '#fff';
    simDiv.style.zIndex = '100';
    simDiv.style.display = 'flex';
    simDiv.style.flexDirection = 'column';
    simDiv.style.gap = '5px';
    
    simDiv.innerHTML = `
        <div style="font-weight:bold;margin-bottom:5px;">直播互动模拟器</div>
        <div style="display:flex;gap:5px;">
            <input type="text" id="sim-user" placeholder="用户名" style="width:60px;padding:3px;">
            <input type="text" id="sim-content" placeholder="弹幕内容" style="width:100px;padding:3px;">
            <button id="sim-send-chat" style="padding:3px 8px;">发送弹幕</button>
        </div>
        <div style="display:flex;gap:5px;">
             <button id="sim-gift-1" style="flex:1;padding:3px;">送爱心</button>
             <button id="sim-gift-2" style="flex:1;padding:3px;">送火箭</button>
        </div>
    `;
    
    document.body.appendChild(simDiv);
    
    document.getElementById('sim-send-chat').addEventListener('click', () => {
        const user = document.getElementById('sim-user').value || '观众' + Math.floor(Math.random()*100);
        const content = document.getElementById('sim-content').value || '加入';
        onLiveComment(user, content);
    });
    
    document.getElementById('sim-gift-1').addEventListener('click', () => {
        const user = document.getElementById('sim-user').value || '老板';
        onLiveGift(user, 'heart');
    });

    document.getElementById('sim-gift-2').addEventListener('click', () => {
        const user = document.getElementById('sim-user').value || '土豪';
        onLiveGift(user, 'rocket');
    });

    // 模拟点赞和炸弹
    const likeBtn = document.createElement('button');
    likeBtn.innerText = '模拟点赞';
    likeBtn.onclick = () => onLiveLike('观众' + Math.floor(Math.random()*100));
    simDiv.appendChild(likeBtn);

    const bombBtn = document.createElement('button');
    bombBtn.innerText = '模拟炸弹';
    bombBtn.onclick = () => onLiveGift('捣蛋鬼', 'bomb');
    simDiv.appendChild(bombBtn);
}

function onLiveComment(user, content) {
    console.log(`[直播弹幕] ${user}: ${content}`);
    
    // 简单的关键词逻辑
    if (content.includes('加入') || content.includes('1')) {
        spawnAudienceCharacter(user);
    }
    
    // 显示弹幕气泡（简单实现，仅在控制台或后续添加 UI）
    showToast(`${user}: ${content}`);
}

function onLiveLike(user) {
    // console.log(`[直播点赞] ${user}`);
    likeCount++;
    spawnHeartEffect(true); // 借用爱心特效
    
    // 每 10 个赞，触发大方块 Buff
    if (likeCount % 10 === 0) {
        nextBlockBuff = 'large';
        showFloatingText('点赞助力! 下个方块变大', 0x67C23A);
    }
}

function onLiveGift(user, type) {
    console.log(`[直播礼物] ${user} 送出了 ${type}`);
    
    let icon = '🎁';
    if (type === 'heart') icon = '❤️';
    else if (type === 'rocket') icon = '🚀';
    else if (type === 'bomb') icon = '💣';
    
    showToast(`${user} 送出了 ${icon}!`);
    
    if (type === 'rocket') {
        triggerFireworks();
        if (isWaitingRevive) {
            revivePlayer();
        } else {
             // 游戏中送火箭，加分
             score += 50;
             updateScoreUI();
             showFloatingScore(50, true);
        }
    } else if (type === 'bomb') {
        nextBlockBuff = 'small';
        showFloatingText('小心! 捣蛋鬼出没', 0xF56C6C);
    } else {
        // 小特效
        spawnHeartEffect();
        score += 5;
        updateScoreUI();
    }
}

function showFloatingText(text, colorHex) {
    const div = document.createElement('div');
    div.innerText = text;
    div.style.position = 'absolute';
    div.style.top = '30%';
    div.style.left = '50%';
    div.style.transform = 'translate(-50%, -50%)';
    div.style.color = '#' + colorHex.toString(16);
    div.style.fontSize = '24px';
    div.style.fontWeight = 'bold';
    div.style.textShadow = '0 0 5px black';
    div.style.pointerEvents = 'none';
    div.style.animation = 'floatUpFade 1.5s forwards';
    document.body.appendChild(div);
    
    // 动态添加动画样式（如果不存在）
    if (!document.getElementById('float-anim-style')) {
        const style = document.createElement('style');
        style.id = 'float-anim-style';
        style.innerHTML = `
            @keyframes floatUpFade {
                0% { opacity: 0; transform: translate(-50%, 0) scale(0.5); }
                20% { opacity: 1; transform: translate(-50%, -20px) scale(1.2); }
                100% { opacity: 0; transform: translate(-50%, -80px) scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
    
    setTimeout(() => {
        if (div.parentNode) div.parentNode.removeChild(div);
    }, 1500);
}

function spawnAudienceCharacter(name) {
    // 在当前方块附近生成一个装饰性小人
    if (!player) return;
    
    const color = Math.random() * 0xffffff;
    // 临时创建，不走 createCharacterMesh 以免太复杂，用简单方块代替
    const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const material = new THREE.MeshLambertMaterial({ color: color });
    const mesh = new THREE.Mesh(geometry, material);
    
    // 随机位置（在主角周围）
    const offsetAngle = Math.random() * Math.PI * 2;
    const distance = 3 + Math.random() * 3;
    mesh.position.x = player.position.x + Math.cos(offsetAngle) * distance;
    mesh.position.z = player.position.z + Math.sin(offsetAngle) * distance;
    mesh.position.y = 10; // 从天而降
    
    scene.add(mesh);
    
    // 简单的下落动画
    const anim = {
        mesh: mesh,
        velocity: 0,
        y: 10,
        targetY: 0.4, // 地面高度
        active: true
    };
    
    // 临时加个动画循环处理它（为了演示简单，直接挂在 animations 列表里）
    animations.push({
        time: 0,
        duration: 200, // 存活时间
        update: function() {
            if (mesh.position.y > anim.targetY) {
                anim.velocity -= 0.05; // 重力
                mesh.position.y += anim.velocity;
            } else {
                if (anim.velocity < -0.1) {
                    anim.velocity = -anim.velocity * 0.5; // 弹跳
                    mesh.position.y = anim.targetY + 0.1;
                } else {
                    mesh.position.y = anim.targetY;
                    // 偶尔跳一下
                    if (Math.random() < 0.02) {
                        anim.velocity = 0.5;
                    }
                }
            }
            
            // 慢慢旋转
            mesh.rotation.y += 0.05;
            
            this.time++;
            if (this.time > this.duration) {
                // 消失动画
                mesh.scale.multiplyScalar(0.9);
                if (mesh.scale.x < 0.1) {
                    scene.remove(mesh);
                    return true;
                }
            }
            return false;
        }
    });
    
    // 名字标签
    if (networkManager) {
        const tag = networkManager.createNameTag('aud_' + Date.now(), name, false);
        // 这里有个小问题，createNameTag 需要 ID 且会根据 remotePlayers 更新位置
        // 我们的观众小人不在 remotePlayers 里。
        // 所以我们需要手动更新标签位置，或者简单的创建一个临时的 DOM
        // 为了方便，复用 updateNameTags 的逻辑太复杂，不如直接手动创建一个临时的
        
        // 还是用简单的方式：
        // 实际上 networkManager.createNameTag 会把它加到 this.nameTags
        // 但是 updateNameTags 只会更新 activeIds 里的。
        // 我们可以把这个小人伪装成 remotePlayer 加入到 networkManager? 
        // 不太好，会混淆逻辑。
        
        // 简单实现一个跟随的标签动画
        const label = document.createElement('div');
        label.className = 'player-name-tag';
        label.innerText = name;
        label.style.fontSize = '12px';
        label.style.padding = '2px 6px';
        document.body.appendChild(label);
        
        animations.push({
            update: function() {
                if (!mesh.parent) { // mesh removed
                    if(label.parentNode) label.parentNode.removeChild(label);
                    return true;
                }
                const tempV = mesh.position.clone();
                tempV.y += 1.5;
                tempV.project(camera);
                const x = (tempV.x * .5 + .5) * window.innerWidth;
                const y = (-(tempV.y * .5) + .5) * window.innerHeight;
                label.style.left = `${x}px`;
                label.style.top = `${y}px`;
                label.style.display = (Math.abs(tempV.z) > 1) ? 'none' : 'block';
                return false;
            }
        });
    }
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.innerText = msg;
    toast.style.position = 'absolute';
    toast.style.top = '20%';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(0,0,0,0.7)';
    toast.style.color = '#fff';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '20px';
    toast.style.animation = 'floatUp 2s forwards';
    toast.style.pointerEvents = 'none';
    
    // Add keyframes if not exists
    if (!document.getElementById('toast-style')) {
        const style = document.createElement('style');
        style.id = 'toast-style';
        style.innerHTML = `
            @keyframes floatUp {
                0% { opacity: 0; transform: translate(-50%, 20px); }
                10% { opacity: 1; transform: translate(-50%, 0); }
                80% { opacity: 1; transform: translate(-50%, -20px); }
                100% { opacity: 0; transform: translate(-50%, -40px); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    setTimeout(() => {
        if(toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2000);
}

function triggerFireworks() {
    // 简单的全屏闪烁模拟
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.background = 'rgba(255, 215, 0, 0.3)';
    flash.style.zIndex = '99';
    flash.style.pointerEvents = 'none';
    flash.style.transition = 'opacity 0.5s';
    document.body.appendChild(flash);
    
    setTimeout(() => flash.style.opacity = '0', 100);
    setTimeout(() => { if(flash.parentNode) flash.parentNode.removeChild(flash); }, 600);
    
    // 生成一堆粒子
    for(let i=0; i<50; i++) {
        spawnHeartEffect(true);
    }
}

function spawnHeartEffect(random = false) {
    // 简单的 DOM 粒子
    const el = document.createElement('div');
    el.innerText = Math.random() > 0.5 ? '❤️' : '✨';
    el.style.position = 'absolute';
    el.style.fontSize = (20 + Math.random() * 30) + 'px';
    el.style.left = (random ? Math.random() * 100 : 50) + '%';
    el.style.top = (random ? Math.random() * 100 : 50) + '%';
    el.style.pointerEvents = 'none';
    el.style.transition = 'all 1s ease-out';
    el.style.zIndex = '100';
    document.body.appendChild(el);
    
    requestAnimationFrame(() => {
        el.style.transform = `translate(${Math.random()*200-100}px, ${-200-Math.random()*200}px) scale(0)`;
        el.style.opacity = '0';
    });
    
    setTimeout(() => { if(el.parentNode) el.parentNode.removeChild(el); }, 1000);
}

function startGame() {
    networkManager.connect(nickname);
    resetGame();
}

function startSpectatorMode() {
    isSpectator = true;
    document.getElementById('login-modal').style.display = 'none';
    
    // 显示观战状态
    const scoreContainer = document.getElementById('score-container');
    let statusDiv = document.getElementById('spectator-status');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'spectator-status';
        statusDiv.style.fontSize = '16px';
        statusDiv.style.color = '#555';
        statusDiv.style.marginTop = '15px';
        statusDiv.style.background = 'rgba(255, 255, 255, 0.6)';
        statusDiv.style.padding = '5px 10px';
        statusDiv.style.borderRadius = '15px';
        statusDiv.style.display = 'inline-block';
        scoreContainer.appendChild(statusDiv);
    }
    statusDiv.innerText = '查看榜单模式';

    // 连接服务器
    networkManager.connect('Spectator');
    
    // 监听连接成功事件，发送 joinSpectator
    // 注意：networkManager.connect 内部也会监听 connect，这里我们追加一个监听器
    // 由于 socket 实例是在 connect 中创建的，我们需要确保在 socket 创建后绑定
    // 但 connect 是同步创建 socket (io())，所以可以直接访问 networkManager.socket
    if (networkManager.socket) {
        networkManager.socket.on('connect', () => {
            networkManager.socket.emit('joinSpectator');
        });
    } else {
        // 如果 connect 还没创建 socket (不太可能，除非 socket.io 加载失败)，稍微延迟一下
        // 或者因为 connect 方法内部就是同步 io()，所以应该没问题。
        // 但为了保险，我们可以修改 connect 方法返回 socket，或者假设它已经设置了。
        // 实际上 networkManager.connect 里的 socket 是立马赋值的。
        // 可是为了更稳健，我们可以利用 networkManager 已经有的机制。
        // 简单起见，利用 setTimeout 0
        setTimeout(() => {
             if(networkManager.socket) {
                 networkManager.socket.emit('joinSpectator'); // 如果已经连接了
                 networkManager.socket.on('connect', () => {
                     networkManager.socket.emit('joinSpectator');
                 });
             }
        }, 100);
    }

    resetGame();
}

function setSpectatorTarget(id) {
    if (spectatorTargetId === id) return;

    // 恢复旧目标透明度
    if (spectatorTargetId && networkManager) {
        networkManager.setPlayerOpacity(spectatorTargetId, 0.7);
    }

    spectatorTargetId = id;

    // 设置新目标不透明
    if (spectatorTargetId && networkManager) {
        networkManager.setPlayerOpacity(spectatorTargetId, 1.0);
    }

    updateSpectatorInfoUI();
    
    // 排行榜高亮更新
    document.querySelectorAll('#leaderboard-list li').forEach(el => {
        if (el.dataset.id === spectatorTargetId) {
            el.style.background = 'rgba(255, 255, 255, 0.2)';
        } else {
            el.style.background = '';
        }
    });
}

function updateSpectatorInfoUI() {
    let statusDiv = document.getElementById('spectator-status');
    if (!statusDiv) return;
    
    let targetName = '无人';
    if (spectatorTargetId && networkManager) {
        targetName = networkManager.getRemotePlayerNickname(spectatorTargetId) || 'Unknown';
    }
    
    statusDiv.innerHTML = `正在观战: <span style="color: #409EFF; font-weight: bold;">${targetName}</span>`;
}

function showGuideIfNeeded() {
    if (!guideOverlay || hasSeenGuide) return;
    guideOverlay.style.display = 'flex';
}

function hideGuide(markSeen = false, remember = false) {
    if (guideOverlay) guideOverlay.style.display = 'none';
    if (markSeen) {
        hasSeenGuide = true;
        if (remember) {
            localStorage.setItem(config.guideStorageKey, '1');
        }
    }
}

function toggleAudio() {
    audioEnabled = !audioEnabled;
    audioManager.setEnabled(audioEnabled);
    localStorage.setItem(config.audioStorageKey, audioEnabled ? 'true' : 'false');
    updateAudioToggleUI();
}

function updateAudioToggleUI() {
    if (!audioToggleBtn) return;
    audioToggleBtn.innerText = audioEnabled ? '🔊 音效开' : '🔇 静音';
    audioToggleBtn.setAttribute('aria-pressed', audioEnabled ? 'false' : 'true');
}

function updateConnectionStatusUI(status) {
    if (!connectionStatusBar) return;
    let text = '';
    switch (status) {
        case 'connecting':
            text = '正在连接...';
            break;
        case 'reconnecting':
            text = '正在重连...';
            break;
        case 'disconnected':
            text = '连接已断开，重试中...';
            break;
        case 'error':
            text = '连接失败，请检查网络';
            break;
        case 'connected':
        default:
            text = '已连接';
            break;
    }
    connectionStatusBar.innerText = text;
    connectionStatusBar.dataset.state = status;
    connectionStatusBar.style.opacity = status === 'connected' ? '0' : '1';
    if (status === 'connected') {
        if (networkManager) {
            networkManager.createNameTag(networkManager.getId(), nickname, true);
        }
        clearTimeout(connectionStatusTimer);
        connectionStatusTimer = setTimeout(() => {
            connectionStatusBar.style.opacity = '0';
        }, 1200);
    } else {
        clearTimeout(connectionStatusTimer);
    }
}

// 网络相关函数已移至 NetworkManager 类

function resetGame() {
    blocks.forEach(block => {
        scene.remove(block);
    });
    blocks = [];
    
    // 玩家
    if (player) {
        scene.remove(player);
        player.traverse(child => {
            if (child.isMesh) {
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
                if (child.geometry) child.geometry.dispose();
            }
        });
    }

    score = 0;
    combo = 0;
    updateScoreUI();
    isGameRunning = true;
    velocity = { x: 0, y: 0, z: 0 };
    rotateSpeed = 0;
    targetRotationY = 0;
    animations = [];

    // 通知服务器重置分数
    if (networkManager) {
        networkManager.emitScore(0);
        const selfId = networkManager.getId();
        if (selfId) {
        // 重置时也更新一下我的名牌 (防止断线重连等情况)
            networkManager.createNameTag(selfId, nickname, true);
        }
    }

    // 初始方块
    createBlock(0, 0, 0, false);
    
    if (!isSpectator) {
        createPlayer();
        spawnNextBlock(false);
    } else {
        // 观战模式下，初始不需要创建本地玩家，也不需要生成下一个方块（由服务器同步或其他玩家触发）
        // 但为了看到场景，我们可以先生成初始方块
        // 实际观战中，方块应该由服务器同步，目前简化版先保留基本场景
    }
    
    // 重置相机
    const aspect = window.innerWidth / window.innerHeight;
    const d = 18;
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
    camera.position.set(20, 20, 20);
    camera.lookAt(0, 0, 0);
}

function createBlock(x, z, delay = 0, scale = 1) {
    const color = config.colors[Math.floor(Math.random() * config.colors.length)];
    const geometry = ResourceManager.geometries.box;
    const material = ResourceManager.getColoredMaterial(color);
    const block = new THREE.Mesh(geometry, material);
    
    block.position.set(x, 0, z);
    block.scale.set(scale, 1, scale); // 应用缩放
    block.castShadow = true;
    block.receiveShadow = true;
    
    const center = new THREE.Mesh(ResourceManager.geometries.center, ResourceManager.materials.center);
    center.position.set(0, config.cubeSize.height / 2 + 0.05, 0); 
    // 中心点标记也要根据方块大小调整吗？不，保持原大小即可，或者稍微调大一点点
    // center.scale.set(scale, 1, scale); 
    block.add(center);

    if (delay > 0) {
        const targetY = 0;
        block.position.y = 10;
        animations.push({
            time: 0,
            duration: 40, 
            update: function() {
                this.time++;
                const progress = this.time / this.duration;
                if (progress >= 1) {
                    block.position.y = targetY;
                    return true; 
                }
                const val = Easing.easeOutElastic(progress);
                block.position.y = 10 - val * 10;
                return false;
            }
        });
    }

    scene.add(block);
    blocks.push(block);
    block.userData.color = color;
    block.userData.scale = scale; // 记录缩放比例
    return block;
}

// createCharacterMesh 已移至 js/character.js

function createPlayer() {
    player = createCharacterMesh(true);
    player.position.set(0, 1, 0);
    scene.add(player);
}

function spawnNextBlock(animate = true) {
    const lastBlock = blocks[blocks.length - 1];
    // 根据当前方块和下一个方块的缩放调整距离，避免重叠或太远
    // 默认距离是 4 + random * 5
    // 如果方块变大了，距离应该适当增加
    
    // 确定下一个方块的缩放
    let nextScale = 1;
    if (nextBlockBuff === 'large') {
        nextScale = 1.5;
        showFloatingText('方块变大!', 0xffff00);
    } else if (nextBlockBuff === 'small') {
        nextScale = 0.6;
        showFloatingText('小心陷阱!', 0xff0000);
    }
    nextBlockBuff = null; // 重置 buff
    currentBlockScale = nextScale;

    // 基础距离
    let minDistance = 4;
    // 考虑当前方块和下一个方块的半径
    // 默认半径是 2 (width 4 / 2)
    const lastScale = lastBlock.userData.scale || 1;
    minDistance = 2 * lastScale + 2 * nextScale + Math.random() * 5;

    const distance = minDistance; 
    const direction = Math.random() > 0.5 ? 'x' : 'z';
    
    let x = lastBlock.position.x;
    let z = lastBlock.position.z;
    
    if (direction === 'x') {
        x -= distance;
        targetRotationY = -Math.PI / 2; 
    } else {
        z -= distance;
        targetRotationY = Math.PI; 
    }
    
    createBlock(x, z, animate ? 1 : 0, nextScale);
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const d = 18;
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseDown(e) {
    if (!isGameRunning || velocity.y !== 0 || player.position.y < 1) return;
    
    hideGuide(true);
    isCharging = true;
    chargeStartTime = Date.now();
    audioManager.startCharge();
    
    innerPlayer.scale.set(1, 1, 1);
}

function onMouseUp(e) {
    if (!isGameRunning || !isCharging) return;
    
    isCharging = false;
    audioManager.stopCharge();
    audioManager.playJump();
    
    const chargeDuration = Date.now() - chargeStartTime;
    jump(chargeDuration);
}

function jump(duration) {
    const maxTime = 1500; 
    const power = Math.min(duration, maxTime) * config.jumpFactor;
    
    const lastBlock = blocks[blocks.length - 2];
    const nextBlock = blocks[blocks.length - 1];
    
    let dir = { x: 0, z: 0 };
    if (nextBlock.position.x < lastBlock.position.x) {
        dir.x = -1;
    } else {
        dir.z = -1;
    }
    
    velocity.x = dir.x * power * 0.055;
    velocity.z = dir.z * power * 0.055;
    velocity.y = power * 0.08; 
    
    rotateSpeed = -0.15;
    
    animations.push({
        time: 0,
        duration: 10,
        update: function() {
            this.time++;
            const p = this.time / this.duration;
            innerPlayer.scale.y = config.maxCompression + (1 - config.maxCompression) * Easing.easeOutQuad(p);
            const scaleXZ = 1 + (config.maxCompression - innerPlayer.scale.y) / 2;
            innerPlayer.scale.x = scaleXZ;
            innerPlayer.scale.z = scaleXZ;
            return p >= 1;
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    
    for (let i = animations.length - 1; i >= 0; i--) {
        const finished = animations[i].update();
        if (finished) animations.splice(i, 1);
    }
    
    if (isCharging && isGameRunning) {
        // 更新蓄力条
        const duration = Date.now() - chargeStartTime;
        const maxTime = 1500; 
        const percentage = Math.min((duration / maxTime) * 100, 100);
        
        if (powerBar && powerBarContainer) {
            powerBarContainer.style.display = 'block';
            powerBar.style.width = percentage + '%';
            
            // 变色提示
            if (percentage < 50) {
                powerBar.style.background = '#67C23A'; // Green
            } else if (percentage < 80) {
                powerBar.style.background = '#E6A23C'; // Yellow
            } else {
                powerBar.style.background = '#F56C6C'; // Red
            }
        }

        if (innerPlayer.scale.y > config.maxCompression) {
            innerPlayer.scale.y -= 0.015;
            innerPlayer.scale.x += 0.01;
            innerPlayer.scale.z += 0.01;
        }
    } else {
        // 隐藏蓄力条
        if (powerBarContainer) powerBarContainer.style.display = 'none';
    }
    
    if (isGameRunning) {
        if (player) {
            if (player.rotation.y !== targetRotationY) {
                let delta = targetRotationY - player.rotation.y;
                if (Math.abs(delta) > 0.01) {
                    player.rotation.y += delta * 0.1;
                } else {
                    player.rotation.y = targetRotationY;
                }
            }

            if (velocity.y !== 0 || player.position.y > 1) {
                player.position.x += velocity.x;
                player.position.z += velocity.z;
                player.position.y += velocity.y;
                velocity.y -= config.gravity; 
                
                if (velocity.y > 0 || player.position.y > 1.5) {
                    innerPlayer.rotation.x += rotateSpeed;
                }

                if (player.userData.wheels) {
                    player.userData.wheels.forEach(wheel => {
                        wheel.rotation.z -= 0.2; 
                    });
                }
                
                if (player.position.y <= 1 && velocity.y < 0) {
                    if (checkLanding()) {
                        player.position.y = 1;
                        velocity = { x: 0, y: 0, z: 0 };
                        rotateSpeed = 0;
                        innerPlayer.rotation.x = 0; 
                        
                        animations.push({
                            time: 0,
                            duration: 10,
                            update: function() {
                                this.time++;
                                const p = this.time / this.duration;
                                const y = 1 - Math.sin(p * Math.PI) * 0.2;
                                innerPlayer.scale.y = y;
                                innerPlayer.scale.x = 1 + (1-y)/2;
                                innerPlayer.scale.z = 1 + (1-y)/2;
                                return p >= 1;
                            }
                        });

                    } else {
                    }
                }
            } else {
                 if (player.position.y !== 1) player.position.y = 1;
                 if (velocity.y !== 0) velocity.y = 0;
            } 
            
            if (player.position.y < -5) {
                gameOver();
            }
        }
        
        updateCamera();
        
        // 发送玩家状态（通过 NetworkManager 节流）
        if (networkManager && player) {
            networkManager.emitMovement(player.position, player.rotation.y);
        }
        
        // 更新名牌位置
        if (networkManager) {
            networkManager.updateNameTags(player ? player.position : null, camera);
        }
    }
    
    // 更新远程玩家（通过 NetworkManager）
    if (networkManager) {
        networkManager.updateRemotePlayers();
    }
    
    particleSystem.update();
    if (cloudSystem) cloudSystem.update();
    if (rippleSystem) rippleSystem.update();
    renderer.render(scene, camera);
}

function updateCamera() {
    let targetX, targetZ;
    let lookAtX, lookAtZ;

    if (isSpectator) {
        let targetPos = { x: 0, y: 0, z: 0 };
        // 尝试跟随目标
        if (spectatorTargetId && networkManager.remotePlayers[spectatorTargetId]) {
            targetPos = networkManager.remotePlayers[spectatorTargetId].position;
        } else {
            // 目标丢失或未设置，自动寻找新目标
            const ids = Object.keys(networkManager.remotePlayers);
            if (ids.length > 0) {
                // 优先选择第一个（通常是分数最高的，因为排行榜顺序可能和keys顺序不一致，但暂时随机选一个）
                setSpectatorTarget(ids[0]);
                targetPos = networkManager.remotePlayers[ids[0]].position;
            } else {
                 // 没有任何玩家，重置目标
                 if (spectatorTargetId) {
                     spectatorTargetId = null;
                     updateSpectatorInfoUI();
                 }
            }
        }
        targetX = targetPos.x + 20;
        targetZ = targetPos.z + 20;
        lookAtX = targetPos.x;
        lookAtZ = targetPos.z;
    } else {
        if (!player) return;
        targetX = player.position.x + 20;
        targetZ = player.position.z + 20;
        lookAtX = player.position.x;
        lookAtZ = player.position.z;
    }
    
    // 震动衰减
    cameraShake.x *= 0.85;
    cameraShake.y *= 0.85;
    cameraShake.z *= 0.85;

    // 动态缩放 (蓄力时拉远)
    const targetZoom = isCharging ? 0.7 : 1.0;
    cameraZoom += (targetZoom - cameraZoom) * 0.05;
    camera.zoom = cameraZoom;
    camera.updateProjectionMatrix();

    // 平滑跟随
    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.z += (targetZ - camera.position.z) * 0.05;
    
    // 叠加震动偏移
    const finalX = camera.position.x + cameraShake.x;
    const finalY = 20 + cameraShake.y;
    const finalZ = camera.position.z + cameraShake.z;

    camera.position.set(finalX, finalY, finalZ);
    camera.lookAt(lookAtX, 0, lookAtZ);

    // 恢复原来的 position 供下一次计算 (去除震动偏移，否则震动会累积漂移)
    camera.position.x -= cameraShake.x;
    camera.position.y = 20;
    camera.position.z -= cameraShake.z;

    if (dirLight) {
        dirLight.position.set(
            lookAtX + 10,
            20 + 30, // player.position.y is usually around 1, simplifying
            lookAtZ + 20
        );
        // dirLight.target needs an object. We can create a dummy object or just update target's position if it was a Object3D.
        // But dirLight.target is usually an Object3D. 
        // Let's just update the target's position directly if we can access it.
        // Or better, set dirLight.target.position.set(lookAtX, 0, lookAtZ); 
        // Note: dirLight.target must be in the scene for updateMatrixWorld to work automatically?
        // Default target is (0,0,0).
        dirLight.target.position.set(lookAtX, 0, lookAtZ);
        dirLight.target.updateMatrixWorld();
    }
}

function checkLanding() {
    let landedBlock = null;
    let landedIndex = -1;
    
    for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const dx = Math.abs(player.position.x - b.position.x);
        const dz = Math.abs(player.position.z - b.position.z);
        
        // 动态判定范围
        const scale = b.userData.scale || 1;
        const limit = 2 * scale + 0.3; // 基础半径 2 * 缩放 + 容差
        
        if (dx < limit && dz < limit) {
            landedBlock = b;
            landedIndex = i;
            break;
        }
    }

    if (landedBlock) {
        audioManager.playLand();
        particleSystem.emit(player.position, landedBlock.userData.color);
        
        if (landedIndex === blocks.length - 1) {
            const dist = Math.sqrt(
                Math.pow(player.position.x - landedBlock.position.x, 2) + 
                Math.pow(player.position.z - landedBlock.position.z, 2)
            );
            
            // 落地震动 (轻微)
            cameraShake.y = -0.3;

            // 波纹特效
            if (rippleSystem) {
                const rippleColor = dist < 0.5 ? 0xFFD700 : 0xFFFFFF;
                rippleSystem.spawn(landedBlock.position, rippleColor);
            }
            
            let addScore = 1;
            let isPerfect = false;
            
            if (dist < 0.5) { 
                combo++;
                addScore = Math.pow(2, combo); 
                isPerfect = true;
                
                // 完美落地强力震动
                cameraShake.x = (Math.random() - 0.5) * 0.5;
                cameraShake.z = (Math.random() - 0.5) * 0.5;
                cameraShake.y = -0.8;
            } else {
                combo = 0;
                addScore = 1;
            }
            
            score += addScore;
            // 上传分数
            if (networkManager) {
                networkManager.emitScore(score);
            }

            audioManager.playScore(combo);
            updateScoreUI();
            showFloatingScore(addScore, isPerfect);
            
            spawnNextBlock();
            
            if (blocks.length > 6) {
                const old = blocks.shift();
                scene.remove(old);
            }
        } else if (landedIndex < blocks.length - 1) {
            combo = 0;
            updateScoreUI();
        }
        
        return true;
    }
    
    return false;
}

function updateScoreUI() {
    document.getElementById('score').innerText = score;
    const comboEl = document.getElementById('combo-text');
    if (combo > 0) {
        comboEl.innerText = `连击 x${combo}`;
        comboEl.style.opacity = 1;
    } else {
        comboEl.style.opacity = 0;
    }
}

function showFloatingScore(num, isPerfect) {
    const div = document.createElement('div');
    div.className = 'floating-score';
    div.innerText = `+${num}`;
    
    div.style.left = '50%';
    div.style.top = '40%';
    div.style.transform = 'translateX(-50%)';
    
    if (isPerfect) {
        div.style.color = '#e67e22';
        div.style.fontSize = '40px';
        div.innerText = `完美! +${num}`;
    }
    
    document.body.appendChild(div);
    
    setTimeout(() => {
        if (div.parentNode) div.parentNode.removeChild(div);
    }, 1000);
}

function gameOver() {
    isGameRunning = false;
    audioManager.playFail();

    // 如果已经是复活状态，不再触发
    if (isWaitingRevive) return;
    
    // 如果是观战模式，直接结束
    if (isSpectator) {
        finalizeGameOver();
        return;
    }

    isWaitingRevive = true;
    
    // 创建或显示复活倒计时界面
    let reviveOverlay = document.getElementById('revive-overlay');
    if (!reviveOverlay) {
        reviveOverlay = document.createElement('div');
        reviveOverlay.id = 'revive-overlay';
        reviveOverlay.style.position = 'absolute';
        reviveOverlay.style.top = '0';
        reviveOverlay.style.left = '0';
        reviveOverlay.style.width = '100%';
        reviveOverlay.style.height = '100%';
        reviveOverlay.style.background = 'rgba(0,0,0,0.6)';
        reviveOverlay.style.display = 'flex';
        reviveOverlay.style.flexDirection = 'column';
        reviveOverlay.style.justifyContent = 'center';
        reviveOverlay.style.alignItems = 'center';
        reviveOverlay.style.color = '#fff';
        reviveOverlay.style.zIndex = '100';
        
        reviveOverlay.innerHTML = `
            <h2>等待复活...</h2>
            <div id="revive-timer" style="font-size: 48px; font-weight: bold; color: #E6A23C;">10</div>
            <p style="font-size: 18px; margin-top: 10px;">打赏 🚀 火箭 立即复活！</p>
            <button id="skip-revive-btn" style="margin-top: 20px; padding: 10px 20px; background: transparent; border: 1px solid #fff; color: #fff; border-radius: 20px; cursor: pointer;">放弃治疗</button>
        `;
        document.body.appendChild(reviveOverlay);
        
        document.getElementById('skip-revive-btn').onclick = () => {
            clearTimeout(reviveTimer);
            finalizeGameOver();
        };
    }
    
    reviveOverlay.style.display = 'flex';
    let timeLeft = 10;
    const timerEl = document.getElementById('revive-timer');
    timerEl.innerText = timeLeft;
    
    const tick = () => {
        timeLeft--;
        if (timeLeft >= 0) {
            timerEl.innerText = timeLeft;
            reviveTimer = setTimeout(tick, 1000);
        } else {
            finalizeGameOver();
        }
    };
    reviveTimer = setTimeout(tick, 1000);
}

function finalizeGameOver() {
    isWaitingRevive = false;
    const reviveOverlay = document.getElementById('revive-overlay');
    if (reviveOverlay) reviveOverlay.style.display = 'none';
    
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over').style.display = 'block';

    // 提交本次挑战分数
    if (networkManager && !isSpectator) {
        networkManager.submitResult(score);
    }
}

function revivePlayer() {
    if (!isWaitingRevive) return;
    
    clearTimeout(reviveTimer);
    isWaitingRevive = false;
    
    const reviveOverlay = document.getElementById('revive-overlay');
    if (reviveOverlay) reviveOverlay.style.display = 'none';
    
    // 恢复位置到起跳方块
    const targetBlock = blocks.length >= 2 ? blocks[blocks.length - 2] : blocks[0];
    
    // 重置玩家状态
    player.position.set(targetBlock.position.x, 1, targetBlock.position.z);
    player.rotation.set(0, 0, 0); // 重置旋转
    // 还需要根据下一个方块的位置设置朝向，不过 animate 会处理一点点，但最好还是设置好
    // 如果有下一个方块，计算一下方向
    if (blocks.length >= 2) {
         const nextBlock = blocks[blocks.length - 1];
         if (nextBlock.position.x < targetBlock.position.x) {
             targetRotationY = -Math.PI / 2;
         } else {
             targetRotationY = Math.PI;
         }
         player.rotation.y = targetRotationY;
    }
    
    velocity = { x: 0, y: 0, z: 0 };
    innerPlayer.rotation.x = 0;
    innerPlayer.scale.set(1, 1, 1);
    
    isGameRunning = true;
    showFloatingText('复活成功!', 0x67C23A);
}

init();
