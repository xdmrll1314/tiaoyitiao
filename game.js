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

    animate();
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

function createBlock(x, z, delay = 0) {
    const color = config.colors[Math.floor(Math.random() * config.colors.length)];
    const geometry = ResourceManager.geometries.box;
    const material = ResourceManager.getColoredMaterial(color);
    const block = new THREE.Mesh(geometry, material);
    
    block.position.set(x, 0, z);
    block.castShadow = true;
    block.receiveShadow = true;
    
    const center = new THREE.Mesh(ResourceManager.geometries.center, ResourceManager.materials.center);
    center.position.set(0, config.cubeSize.height / 2 + 0.05, 0); 
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
    const distance = 4 + Math.random() * 5; 
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
    
    createBlock(x, z, animate ? 1 : 0);
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
        
        updateCamera();
        
        // 发送玩家状态（通过 NetworkManager 节流）
        if (networkManager) {
            networkManager.emitMovement(player.position, player.rotation.y);
        }
        
        // 更新名牌位置
        if (networkManager) {
            networkManager.updateNameTags(player.position, camera);
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
    if (dx < 2.3 && dz < 2.3) {
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
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over').style.display = 'block';
}

init();
