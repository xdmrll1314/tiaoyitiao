// =============================================================================
// 🎮 H5 跳一跳 (Jump Jump) - 主游戏逻辑
// =============================================================================
// 
// 📚 给新手的游戏开发概念指南：
// 
// 1. 游戏循环 (Game Loop): 
//    游戏本质上是一个无限循环，每一帧(Frame)都会执行两个主要步骤：
//    - Update: 更新游戏状态（如角色位置、得分、物理计算）。
//    - Render: 将更新后的状态绘制到屏幕上。
//    在 Web 中，我们使用 requestAnimationFrame 来实现高效的循环。
//
// 2. 场景图 (Scene Graph):
//    Three.js 使用树状结构管理物体。scene 是根节点，所有物体(Mesh)、灯光(Light)
//    都必须添加到 scene 中才能被看见。物体可以有子物体，子物体会跟随父物体移动。
//
// 3. 坐标系 (Coordinate System):
//    3D 世界使用 X, Y, Z 轴。
//    - Y 轴通常表示高度（向上）。
//    - X 和 Z 轴构成水平地面。
//    - (0, 0, 0) 是世界原点。
//    - 在本项目中，方块的高度是 2，中心在 y=0，所以方块表面高度是 y=1。
//      因此，玩家站在方块上时，其 y 坐标应该是 1。
//
// 4. 向量 (Vector):
//    用于表示位置(Position)、速度(Velocity)和方向。
//    例如，速度向量 {x:1, y:0, z:0} 表示每帧向 X 轴正方向移动 1 单位。
//
// =============================================================================

// 模块化引入在 index.html 中完成，这里直接使用全局变量
// 这样做的目的是为了让代码结构对初学者更直观，避免过于复杂的构建工具配置

// --- 全局变量定义 ---
// 渲染核心组件
let scene, camera, renderer, dirLight;

// 游戏实体与系统
let player;             // 玩家主容器 (Mesh)
let innerPlayer;        // 玩家内部容器 (用于形变动画)
let audioManager;       // 音频管理器
let particleSystem;     // 粒子系统
let cloudSystem;        // 云层系统
let rippleSystem;       // 波纹系统
let uiManager;          // UI 管理器
let audienceSystem;     // 观众系统
let streamerManager;    // 主播模式管理器
let networkManager;     // 网络管理器

// 游戏状态数据
let blocks = [];                    // 存放所有方块的数组
let score = 0;                      // 当前分数
let scoreMultiplier = 1;            // 分数倍率
let scoreMultiplierEndTime = 0;     // 倍率结束时间
let magnetEndTime = 0;              // 吸铁石结束时间
let combo = 0;                      // 连击次数（中心命中）
let isGameRunning = false;          // 游戏运行状态标记
let isCharging = false;             // 是否正在蓄力
let chargeStartTime = 0;            // 蓄力开始时间戳
let velocity = { x: 0, y: 0, z: 0 };// 玩家当前速度向量
let rotateSpeed = 0;                // 空中旋转速度
let targetRotationY = 0;            // 目标朝向角度
let animations = [];                // 待执行的动画队列
let nickname = 'Unknown';           // 玩家昵称

// 相机控制
let cameraShake = { x: 0, y: 0, z: 0 }; // 相机震动偏移量
let cameraZoom = 1;                     // 相机缩放倍率

// 游戏机制变量
let audioEnabled = true;            // 音效开关状态
let nextBlockBuff = null;           // 下一个方块的特殊效果 ('large', 'small')
let isWaitingRevive = false;        // 是否等待复活
let currentBlockScale = 1;          // 当前方块缩放比例
let isStreamerMode = false;         // 是否处于主播模式
let selectedCharacterType = 'nezha';// 当前选择的角色类型

// 多人模式变量
let isSpectator = false;            // 是否为观战者
let spectatorTargetId = null;       // 观战目标 ID
let connectionStatusTimer = null;   // 连接状态提示定时器

// DOM 元素缓存 (避免频繁查询 DOM)
let powerBar, powerBarContainer;
let connectionStatusBar, audioToggleBtn;

/**
 * 🚀 游戏入口函数
 * 负责初始化所有系统，并启动游戏循环
 */
function init() {
    Logger.info("Game", "🚀 游戏初始化开始...");

    // 1. 初始化 3D 引擎 (场景、相机、渲染器)
    //    详细逻辑在 js/core/scene-setup.js 中
    const setup = SceneSetup.init(config);
    scene = setup.scene;
    camera = setup.camera;
    renderer = setup.renderer;
    dirLight = setup.dirLight;

    // 2. 初始化各个子系统
    //    将复杂功能拆分为独立模块，便于维护
    Logger.info("System", "装载游戏子系统...");
    uiManager = new UIManager();                // 负责 UI 显示
    audioManager = new AudioManager();          // 负责声音
    particleSystem = new ParticleSystem(scene); // 负责粒子特效
    cloudSystem = new CloudSystem(scene);       // 负责背景云
    rippleSystem = new RippleSystem(scene);     // 负责落地波纹
    audienceSystem = new AudienceSystem(scene, camera); // 负责观众
    
    // 初始化资源管理器 (预加载材质和几何体)
    ResourceManager.init();
    
    // 3. 读取用户设置
    const storedAudio = localStorage.getItem(config.audioStorageKey);
    // 如果没有存过设置，默认开启 (undefined !== 'false' => true)
    audioEnabled = storedAudio !== 'false';
    audioManager.setEnabled(audioEnabled);
    
    // 4. 初始化网络模块 (Socket.io)
    Logger.info("Network", "初始化网络连接模块...");
    networkManager = new NetworkManager(scene);
    // 绑定网络状态回调，当连接状态变化时更新 UI
    networkManager.setStatusHandler(updateConnectionStatusUI);
    // 提供获取分数的接口给网络模块
    networkManager.setScoreGetter(() => score);
    // 排行榜更新回调
    networkManager.setLeaderboardUpdateCallback(() => {
        if (isSpectator && spectatorTargetId) {
             // 高亮显示当前观战的目标
             document.querySelectorAll('#leaderboard-list li').forEach(el => {
                if (el.dataset.id === spectatorTargetId) {
                    el.style.background = 'rgba(255, 255, 255, 0.2)';
                } else {
                    el.style.background = '';
                }
            });
        }
    });

    // 5. 初始化主播/直播互动管理器
    //    将游戏内的核心操作暴露给 StreamerManager
    const gameContext = {
        getPlayerPosition: () => player ? player.position : null,
        revivePlayer: revivePlayer,
        addScore: (val) => { score += val; updateScoreUI(); },
        showFloatingScore: (val) => showFloatingScore(val, true),
        setNextBlockBuff: (buff) => { nextBlockBuff = buff; },
        spawnHeartEffect: (random) => spawnHeartEffect(random),
        triggerFireworks: () => triggerFireworks(),
        isWaitingRevive: () => isWaitingRevive
    };
    streamerManager = new StreamerManager(gameContext, uiManager, audienceSystem);
    
    // 6. 获取页面 DOM 元素
    powerBar = document.getElementById('power-bar');
    powerBarContainer = document.getElementById('power-bar-container');
    connectionStatusBar = document.getElementById('connection-status');
    audioToggleBtn = document.getElementById('audio-toggle');

    updateAudioToggleUI();

    // 7. 绑定事件监听器
    setupEventListeners();

    // 8. 检查 URL 参数 (是否为主播模式)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'streamer') {
        nickname = '主播';
        isStreamerMode = true;
        startGame(); // 自动开始
        streamerManager.init();
    }

    Logger.success("Game", "初始化完成，开始渲染循环。");
    // 启动游戏循环
    animate();
}

/**
 * 🎮 设置输入事件监听
 * 处理鼠标、触摸和键盘输入
 */
function setupEventListeners() {
    Logger.info("Input", "绑定输入事件监听器 (Mouse/Touch/Keyboard)...");
    
    // 窗口大小改变时调整相机和渲染器
    window.addEventListener('resize', onWindowResize, false);
    
    // 键盘空格键控制
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.repeat) onMouseDown(e);
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') onMouseUp(e);
    });
    
    // 统一处理鼠标和触摸开始事件
    const inputStart = (e) => {
        // 忽略按钮和输入框上的点击
        if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'INPUT') {
            return;
        }
        if(e.type === 'touchstart') e.preventDefault(); // 防止移动端滚动
        onMouseDown(e);
    };
    
    // 统一处理鼠标和触摸结束事件
    const inputEnd = (e) => {
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
    
    // UI 按钮事件
    document.getElementById('restart-btn').addEventListener('click', () => {
        document.getElementById('game-over').style.display = 'none';
        resetGame();
    });

    if (audioToggleBtn) {
        audioToggleBtn.addEventListener('click', toggleAudio);
    }
    
    document.getElementById('spectate-btn').addEventListener('click', startSpectatorMode);
    
    // 观战模式点击排行榜切换视角
    document.getElementById('leaderboard-list').addEventListener('click', (e) => {
        if (!isSpectator) return;
        const li = e.target.closest('li');
        if (li && li.dataset.id) {
            setSpectatorTarget(li.dataset.id);
        }
    });

    // 角色选择逻辑
    const charOptions = document.querySelectorAll('.char-option');
    const customSettings = document.getElementById('custom-settings');
    
    charOptions.forEach(option => {
        option.addEventListener('click', () => {
            // 移除所有 active 类
            charOptions.forEach(opt => opt.classList.remove('active'));
            // 添加当前 active 类
            option.classList.add('active');
            // 更新选择的角色
            selectedCharacterType = option.dataset.type;
            
            // 显示/隐藏自定义设置
            if (customSettings) {
                customSettings.style.display = selectedCharacterType === 'custom' ? 'block' : 'none';
            }

            // 播放点击音效 (可选)
            if (audioManager && audioManager.playClick) audioManager.playClick();
        });
    });

    // 登录按钮
    document.getElementById('start-game-btn').addEventListener('click', () => {
        const input = document.getElementById('nickname-input');
        const val = input.value.trim();
        if (val) {
            nickname = val;
            document.getElementById('login-modal').style.display = 'none';
            startGame();
            // 显示新手引导
            if (localStorage.getItem(config.guideStorageKey) !== '1') {
                document.getElementById('guide-overlay').style.display = 'flex';
            }
        } else {
            alert('请输入昵称');
        }
    });
    
    // 主播模式入口
    document.getElementById('enter-streamer-mode').addEventListener('click', (e) => {
        e.preventDefault();
        nickname = '主播';
        isStreamerMode = true;
        startGame();
        streamerManager.init();
    });
    
    // 引导页关闭按钮
    document.getElementById('guide-close').addEventListener('click', () => {
        document.getElementById('guide-overlay').style.display = 'none';
    });
    document.getElementById('guide-never').addEventListener('click', () => {
        document.getElementById('guide-overlay').style.display = 'none';
        localStorage.setItem(config.guideStorageKey, '1');
    });
}

// 简单的 UI 辅助函数
function showFloatingText(text, colorHex) {
    uiManager.showFloatingText(text, colorHex);
}
function triggerFireworks() {
    // 简单实现，这里可以扩展
    Logger.info("Effect", "触发烟花特效");
}
function spawnHeartEffect(random) {
    // 简单实现
}

/**
 * ▶️ 开始游戏
 */
function startGame() {
    Logger.info("Game", `开始游戏，玩家: ${nickname}, 角色: ${selectedCharacterType}`);
    networkManager.connect(nickname, selectedCharacterType);
    resetGame();
}

/**
 * 👀 进入观战模式
 */
function startSpectatorMode() {
    Logger.info("Game", "进入观战模式");
    isSpectator = true;
    document.getElementById('login-modal').style.display = 'none';
    
    // 显示观战状态提示
    const scoreContainer = document.getElementById('score-container');
    let statusDiv = document.getElementById('spectator-status');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'spectator-status';
        Object.assign(statusDiv.style, {
            fontSize: '16px', color: '#555', marginTop: '15px',
            background: 'rgba(255, 255, 255, 0.6)', padding: '5px 10px',
            borderRadius: '15px', display: 'inline-block'
        });
        scoreContainer.appendChild(statusDiv);
    }
    statusDiv.innerText = '查看榜单模式';

    // 连接网络，但不创建本地玩家
    networkManager.connect('Spectator');
    if (networkManager.socket) {
        networkManager.socket.on('connect', () => networkManager.socket.emit('joinSpectator'));
    } else {
        setTimeout(() => {
             if(networkManager.socket) {
                 networkManager.socket.emit('joinSpectator'); 
                 networkManager.socket.on('connect', () => networkManager.socket.emit('joinSpectator'));
             }
        }, 100);
    }

    resetGame();
}

/**
 * 🔄 重置游戏状态 (重新开始)
 * 这里包含了游戏核心逻辑的初始化
 */
function resetGame() {
    Logger.info("Game", "🔄 重置游戏状态");
    
    // 1. 清理旧物体
    //    遍历 blocks 数组，从场景中移除所有方块 Mesh
    blocks.forEach(block => scene.remove(block));
    blocks = [];
    
    //    移除玩家
    if (player) {
        scene.remove(player);
        // 释放内存 (Three.js 需要手动释放 geometry 和 material)
        player.traverse(child => {
            if (child.isMesh) {
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
                if (child.geometry) child.geometry.dispose();
            }
        });
        player = null; // 确保引用被清空
    }

    // 2. 重置变量
    score = 0;
    scoreMultiplier = 1;
    scoreMultiplierEndTime = 0;
    magnetEndTime = 0;
    combo = 0;
    updatePlayerGlow(0); // 重置发光
    updateScoreUI();
    isGameRunning = true;
    velocity = { x: 0, y: 0, z: 0 };
    rotateSpeed = 0;
    targetRotationY = 0;
    animations = [];

    // 3. 网络重置
    if (networkManager) {
        networkManager.emitScore(0);
        const selfId = networkManager.getId();
        if (selfId) networkManager.createNameTag(selfId, nickname, true);
    }

    // 4. 创建初始方块
    //    在 (0, 0, 0) 位置创建一个方块
    createBlock(0, 0, false);
    
    // 初始化环境颜色
    updateEnvironment(0);
    
    // 5. 创建玩家 (如果不是观战模式)
    if (!isSpectator) {
        createPlayer();
        // 确保玩家位置绝对正确：
        // 方块高度是 2，中心在 y=0，所以方块顶部是 y=1。
        // 玩家应该站在 y=1 的位置。
        player.position.set(0, 1, 0); 
        player.userData.hasFailed = false; // 重置失败标记
        
        // 生成第二个方块
        spawnNextBlock(false);
    }
    
    // 6. 重置相机位置
    const aspect = window.innerWidth / window.innerHeight;
    const d = 18;
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
    camera.bottom = -d;
    camera.updateProjectionMatrix();
    // 典型的等轴测视角位置
    camera.position.set(20, 20, 20);
    camera.lookAt(0, 0, 0);
}

/**
 * 📦 创建一个方块
 * @param {number} x - X 坐标
 * @param {number} z - Z 坐标
 * @param {boolean} animate - 是否播放出现动画
 * @param {number} scale - 缩放比例
 */
function createBlock(x, z, animate = false, scale = 1) {
    const color = config.colors[Math.floor(Math.random() * config.colors.length)];
    // 复用几何体和材质，优化性能
    const geometry = ResourceManager.geometries.box;
    
    // 随机选择材质类型：纯色、木纹、石材、网格
    let material;
    const rand = Math.random();
    if (rand < 0.6) {
        // 60% 概率纯色
        material = ResourceManager.getColoredMaterial(color);
    } else if (rand < 0.75) {
        // 15% 木纹
        material = ResourceManager.getTexturedMaterial('wood', color);
    } else if (rand < 0.9) {
        // 15% 石材
        material = ResourceManager.getTexturedMaterial('stone', color);
    } else {
        // 10% 网格
        material = ResourceManager.getTexturedMaterial('grid', color);
    }
    
    const block = new THREE.Mesh(geometry, material);
    // 设置位置：y=0 表示方块中心在水平面上
    // 因为高度是 2，所以范围是 y=[-1, 1]
    block.position.set(x, 0, z); 
    block.scale.set(scale, 1, scale); 
    block.castShadow = true;
    block.receiveShadow = true;
    
    // 添加中心白点（目标点）
    const center = new THREE.Mesh(ResourceManager.geometries.center, ResourceManager.materials.center);
    center.position.set(0, config.cubeSize.height / 2 + 0.05, 0); // 略微浮起，防止Z-fighting
    block.add(center);

    // 出现动画 (从上方掉落)
    if (animate) {
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
                    return true; // 动画结束
                }
                // 使用弹跳缓动函数
                const val = Easing.easeOutElastic(progress);
                block.position.y = 10 - val * 10;
                return false;
            }
        });
    }

    scene.add(block);
    blocks.push(block);
    block.userData.color = color;
    block.userData.scale = scale; 
    
    // 内存管理：限制方块数量，移除太旧的方块
    if (blocks.length > 10) {
        const oldBlock = blocks.shift();
        scene.remove(oldBlock);
        // 注意：复用的 Geometry/Material 不需要 dispose，除非确实不再使用了
    }
    
    return block;
}

/**
 * 🎁 生成道具
 */
function spawnItem(block, type) {
    let geometry = ResourceManager.geometries.item;
    let material;
    
    if (type === 'bonus') {
        material = ResourceManager.materials.item_bonus;
    } else {
        material = ResourceManager.materials.item_double;
    }
    
    const item = new THREE.Mesh(geometry, material);
    // 方块中心在 y=0, 顶部在 y=1
    // 道具悬浮在方块上方
    item.position.set(0, 2, 0); 
    
    item.userData.isItem = true;
    item.userData.itemType = type;
    item.userData.floatOffset = Math.random() * 100;
    
    block.add(item);
    block.userData.item = item; // 方便索引
}

/**
 * 👤 创建玩家角色
 */
function createPlayer() {
    Logger.info("Entities", "创建主角 Player");
    
    let options = {};
    if (selectedCharacterType === 'custom') {
        const headColor = document.getElementById('color-head').value;
        const bodyColor = document.getElementById('color-body').value;
        const legsColor = document.getElementById('color-legs').value;
        options.colors = { head: headColor, body: bodyColor, legs: legsColor };
    }

    // 调用实体工厂创建 Mesh
    player = createCharacterMesh(true, selectedCharacterType, options);
    scene.add(player);
}

/**
 * 🎯 生成下一个方块
 */
function spawnNextBlock(animate = true) {
    const lastBlock = blocks[blocks.length - 1];
    let nextScale = 1;
    let specialType = null;
    
    // 1. 处理外部/直播指令 Buff
    if (nextBlockBuff === 'large') {
        nextScale = 1.5;
        showFloatingText('方块变大!', 0xffff00);
    } else if (nextBlockBuff === 'small') {
        nextScale = 0.6;
        showFloatingText('小心陷阱!', 0xff0000);
    } else if (nextBlockBuff === 'moving') {
        specialType = 'moving';
        showFloatingText('移动方块!', 0xff0000);
    }
    
    // 2. 随机生成特殊方块 (仅在没有外部指令时)
    if (!nextBlockBuff && score > 5) {
        const rand = Math.random();
        // 难度随分数增加
        const prob = Math.min(0.1 + score / 500, 0.3); // 最大 30% 概率出特殊方块
        
        if (rand < prob) {
            const typeRand = Math.random();
            if (typeRand < 0.4) specialType = 'moving';     // 40% 移动
            else if (typeRand < 0.7) specialType = 'sinking'; // 30% 下沉
            else specialType = 'shrinking';                   // 30% 缩小
        }
    }

    nextBlockBuff = null; 
    currentBlockScale = nextScale;

    // 计算距离
    const lastScale = lastBlock.userData.scale || 1;
    const minDistance = 2 * lastScale + 2 * nextScale + 2; 
    // 最小距离保证不重叠，最大距离随分数增加而增加 (难度提升)
    const difficultyMultiplier = Math.min(score / 50, 2); // 0 -> 2
    const distanceRange = 4 + difficultyMultiplier * 3; 
    const distance = minDistance + Math.random() * distanceRange; 
    
    // 随机决定方向：向左(X) 或 向前(Z)
    const direction = Math.random() > 0.5 ? 'x' : 'z';
    
    let x = lastBlock.position.x;
    let z = lastBlock.position.z;
    
    if (direction === 'x') {
        x -= distance;
    } else {
        z -= distance;
    }
    
    const block = createBlock(x, z, animate, nextScale);

    // 🎯 优化：让小人面向下一个方块的实际位置
    // 即使小人在当前方块的边缘，也会准确转向目标中心
    if (player) {
        const dx = x - player.position.x;
        const dz = z - player.position.z;
        targetRotationY = Math.atan2(dx, dz);
    }
    
    // 应用特殊效果
    if (specialType === 'moving') {
        block.userData.isMoving = true;
        block.userData.initialPos = { x, y: 0, z };
        block.userData.moveAxis = direction; // 'x' or 'z'
        block.userData.moveSpeed = 0.03 + Math.random() * 0.04;
        block.userData.moveRange = 2.5; // 移动范围
        block.userData.moveOffset = Math.random() * Math.PI;
    } else if (specialType === 'sinking') {
        block.userData.isSinking = true;
        // 视觉提示：稍微变暗
        if (!block.material.map) { // 只有纯色方块才变色，纹理方块保持
            block.material = block.material.clone();
            block.material.color.offsetHSL(0, 0, -0.2);
        }
    } else if (specialType === 'shrinking') {
        block.userData.isShrinking = true;
    }
    
    // 🎁 随机生成道具 (20% 概率)
    if (specialType !== 'moving' && score > 5 && Math.random() < 0.2) {
        const r = Math.random();
        let itemType = 'bonus';
        if (r > 0.9) itemType = 'magnet'; // 10%
        else if (r > 0.7) itemType = 'double'; // 20%
        // 70% bonus
        
        spawnItem(block, itemType);
    }
}

/**
 * 🎁 生成道具
 */
function spawnItem(block, type) {
    if (!ResourceManager.geometries.item) return;

    let geometry = ResourceManager.geometries.item;
    let material;
    
    if (type === 'bonus') {
        material = ResourceManager.materials.item_bonus;
    } else if (type === 'double') {
        material = ResourceManager.materials.item_double;
    } else if (type === 'magnet') {
        material = ResourceManager.materials.item_magnet;
    }
    
    if (!material) return;
    
    const item = new THREE.Mesh(geometry, material);
    item.position.set(0, 2, 0); 
    
    item.userData.isItem = true;
    item.userData.itemType = type;
    item.userData.floatOffset = Math.random() * 100;
    
    block.add(item);
    block.userData.item = item;
}    


// 窗口调整处理
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

/**
 * 🖱️ 鼠标/触摸按下：开始蓄力
 */
function onMouseDown(e) {
    // 只有在游戏运行、静止且在地面时才能蓄力
    // 移除 player.position.y < 0.9 的限制，因为下沉方块会使高度降低
    if (!isGameRunning || velocity.y !== 0) return;
    
    isCharging = true;
    chargeStartTime = Date.now();
    audioManager.startCharge(); // 播放蓄力音效
    
    innerPlayer.scale.set(1, 1, 1); // 重置形变
}

/**
 * 🖱️ 鼠标/触摸抬起：触发跳跃
 */
function onMouseUp(e) {
    if (!isGameRunning || !isCharging) return;
    
    isCharging = false;
    audioManager.stopCharge(); // 停止蓄力音效
    audioManager.playJump();   // 播放跳跃音效
    
    const chargeDuration = Date.now() - chargeStartTime;
    jump(chargeDuration);
}

/**
 * 🦘 执行跳跃物理逻辑
 * @param {number} duration - 蓄力时长(ms)
 */
function jump(duration) {
    // 1. 防止误触：如果蓄力时间太短，忽略（或给予最小跳跃力）
    // 这里选择忽略极短的点击，防止玩家意外死亡
    if (duration < 30) return;

    const maxTime = 1500; 
    // 计算力度：时长越长，力度越大
    const power = Math.min(duration, maxTime) * config.jumpFactor;
    
    Logger.info("Physics", `跳跃! 蓄力时间: ${duration}ms, 力度: ${power.toFixed(2)}`);

    // 确定跳跃方向
    // 优化：直接使用玩家当前的朝向进行跳跃
    // 这样可以确保跳跃方向与视觉朝向一致（解决移动方块或边缘起跳的问题）
    // Math.sin(y) 对应 X 轴分量, Math.cos(y) 对应 Z 轴分量
    const dirX = Math.sin(player.rotation.y);
    const dirZ = Math.cos(player.rotation.y);
    
    // 设置初始速度 (抛物线运动)
    velocity.x = dirX * power * 0.055;
    velocity.z = dirZ * power * 0.055;
    velocity.y = power * 0.08; // 垂直速度
    
    rotateSpeed = -0.15; // 空中翻滚速度
    
    // 添加跳跃时的形变动画（拉伸）
    animations.push({
        time: 0,
        duration: 10,
        update: function() {
            this.time++;
            const p = this.time / this.duration;
            // 恢复原状
            innerPlayer.scale.y = config.maxCompression + (1 - config.maxCompression) * Easing.easeOutQuad(p);
            const scaleXZ = 1 + (config.maxCompression - innerPlayer.scale.y) / 2;
            innerPlayer.scale.x = scaleXZ;
            innerPlayer.scale.z = scaleXZ;
            return p >= 1;
        }
    });
}

/**
 * 🔄 游戏主循环 (每秒约60帧)
 */
function animate() {
    requestAnimationFrame(animate); // 请求下一帧
    
    // 1. 更新通用动画 (如方块生成、形变等)
    for (let i = animations.length - 1; i >= 0; i--) {
        const finished = animations[i].update();
        if (finished) animations.splice(i, 1);
    }

    // 2. 更新观众系统 (如有人围观)
    if (audienceSystem) audienceSystem.update();
    
    // 3. 处理蓄力过程中的逻辑
    if (isCharging && isGameRunning) {
        const duration = Date.now() - chargeStartTime;
        const maxTime = 1500; 
        const percentage = Math.min((duration / maxTime) * 100, 100);
        
        // 更新力度条 UI
        if (powerBar && powerBarContainer) {
            powerBarContainer.style.display = 'block';
            powerBar.style.width = percentage + '%';
            if (percentage < 50) powerBar.style.background = '#67C23A';
            else if (percentage < 80) powerBar.style.background = '#E6A23C';
            else powerBar.style.background = '#F56C6C';
        }

        // 蓄力时的形变 (压扁)
        if (innerPlayer.scale.y > config.maxCompression) {
            innerPlayer.scale.y -= 0.015;
            innerPlayer.scale.x += 0.01;
            innerPlayer.scale.z += 0.01;
        }
    } else {
        if (powerBarContainer) powerBarContainer.style.display = 'none';
    }
    
    // 4. 处理游戏逻辑 (如果游戏正在进行)
    if (isGameRunning) {
        if (player) {
            // 平滑旋转角色朝向
            if (player.rotation.y !== targetRotationY) {
                let delta = targetRotationY - player.rotation.y;
                if (Math.abs(delta) > 0.01) {
                    player.rotation.y += delta * 0.1; // 插值平滑
                } else {
                    player.rotation.y = targetRotationY;
                }
            }

            // --- 物理模拟核心 ---
            // 1. 计算当前地面高度 (支持下沉方块)
            let groundHeight = -10; 
            for (let b of blocks) {
                 const size = (b.userData.scale || 1) * config.cubeSize.width / 2;
                 const dx = player.position.x - b.position.x;
                 const dz = player.position.z - b.position.z;
                 if (dx*dx + dz*dz < (size + 0.6)**2) {
                     const h = b.position.y + 1;
                     if (h > groundHeight) groundHeight = h;
                 }
            }

            // 如果有垂直速度，或者高于当前地面一定距离，则应用物理
            // 阈值设为 0.1 以容忍下沉方块的速度 (0.03)，避免每一帧都进入掉落状态
            if (velocity.y !== 0 || player.position.y > groundHeight + 0.1) {
                // 更新位置
                player.position.x += velocity.x;
                player.position.z += velocity.z;
                player.position.y += velocity.y;
                
                // 应用重力
                velocity.y -= config.gravity; 
                
                // 空中翻滚动画
                if (velocity.y > 0 || player.position.y > groundHeight + 0.5) {
                    innerPlayer.rotation.x += rotateSpeed;
                    
                    // 拖尾特效
                    if (particleSystem) {
                         particleSystem.emitTrail(player.position);
                    }
                }

                // 风火轮旋转
                if (player.userData.wheels) {
                    player.userData.wheels.forEach(wheel => wheel.rotation.z -= 0.2);
                }
                
                // --- 落地检测 ---
                if (player.position.y <= groundHeight && velocity.y < 0) {
                    if (checkLanding()) {
                        // 成功落地
                        player.position.y = groundHeight; 
                        velocity = { x: 0, y: 0, z: 0 }; 
                        rotateSpeed = 0;
                        innerPlayer.rotation.x = 0; 
                        
                        // 落地弹动动画
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
                        // 没落在方块上，继续掉落
                    }
                }
            } else {
                // 在地面静止时的修正 (跟随方块升降)
                 if (groundHeight > -5 && Math.abs(player.position.y - groundHeight) < 0.2) {
                     player.position.y = groundHeight;
                 }
                 if (velocity.y !== 0) velocity.y = 0;
            } 
            
            // 掉出世界判定
            if (player.position.y < -5) {
                gameOver();
            }
        }
        
        // 更新相机跟随
        updateCamera();
        
        // 发送网络位置同步
        if (networkManager && player) {
            networkManager.emitMovement(player.position, player.rotation.y);
        }
        
        // 更新玩家头顶名字
        if (networkManager) {
            networkManager.updateNameTags(player ? player.position : null, camera);
        }
    }
    
    // 5. 更新其他系统
    if (networkManager) networkManager.updateRemotePlayers();
    particleSystem.update();
    if (cloudSystem) cloudSystem.update();
    if (rippleSystem) rippleSystem.update();
    
    // 检查分数倍率过期
    if (scoreMultiplier > 1 && Date.now() > scoreMultiplierEndTime) {
        scoreMultiplier = 1;
        showFloatingText('双倍时间结束', 0xcccccc);
    }

    // 检查吸铁石过期
    if (magnetEndTime > 0 && Date.now() > magnetEndTime) {
        magnetEndTime = 0;
        showFloatingText('吸铁石失效', 0xcccccc);
    }
    
    // 动态更新环境颜色
    updateEnvironment(score);
    
    // 移动/特殊方块逻辑
    blocks.forEach(block => {
        if (!isGameRunning) return;
        
        // 1. 移动方块
        if (block.userData.isMoving) {
            block.userData.moveOffset += block.userData.moveSpeed;
            const offset = Math.sin(block.userData.moveOffset) * block.userData.moveRange;
            
            if (block.userData.moveAxis === 'x') {
                block.position.z = block.userData.initialPos.z + offset; 
            } else {
                block.position.x = block.userData.initialPos.x + offset;
            }
        }
        
        // 2. 下沉方块 (玩家站立时下沉)
        if (block.userData.isSinking && player) {
            const blockSize = (block.userData.scale || 1) * config.cubeSize.width / 2;
            const dx = player.position.x - block.position.x;
            const dz = player.position.z - block.position.z;
            
            // 判定玩家是否站在方块上 (XZ范围 + Y高度接近)
            // Block Top = block.position.y + 1
            if (dx*dx + dz*dz < (blockSize + 0.5)**2 && Math.abs(player.position.y - (block.position.y + 1)) < 0.5) {
                block.position.y -= 0.03; // 下沉速度
            }
        }
        
        // 3. 缩小方块 (玩家站立时缩小)
        if (block.userData.isShrinking && player) {
            const blockSize = (block.userData.scale || 1) * config.cubeSize.width / 2;
            const dx = player.position.x - block.position.x;
            const dz = player.position.z - block.position.z;
            
            if (dx*dx + dz*dz < (blockSize + 0.5)**2 && Math.abs(player.position.y - (block.position.y + 1)) < 0.5) {
                block.scale.multiplyScalar(0.99);
                block.userData.scale *= 0.99;
                if (block.scale.x < 0.1) block.scale.setScalar(0.1); // 最小限制
            }
        }
        
        // 4. 道具旋转浮动 & 吸铁石吸引
        if (block.userData.item) {
            const item = block.userData.item;
            let attracted = false;
            
            if (magnetEndTime > Date.now() && player) {
                 const worldPos = new THREE.Vector3();
                 item.getWorldPosition(worldPos);
                 const dist = worldPos.distanceTo(player.position);
                 
                 if (dist < 8) {
                     attracted = true;
                     const target = player.position.clone();
                     target.y += 1; 
                     worldPos.lerp(target, 0.1);
                     block.worldToLocal(worldPos);
                     item.position.copy(worldPos);
                     item.rotation.y += 0.2; 
                 }
            }
            
            if (!attracted) {
                item.rotation.y += 0.05;
                const time = Date.now() * 0.002 + item.userData.floatOffset;
                item.position.y = 2 + Math.sin(time) * 0.2;
            }
        }
    });

    // 6. 渲染画面
    renderer.render(scene, camera);
}

function updatePlayerGlow(comboLevel) {
    if (!player) return;
    
    let glowColor = 0x000000;
    let intensity = 0;
    
    if (comboLevel >= 5) {
        glowColor = 0xff0000; // 红色怒气
        intensity = 0.5;
    } else if (comboLevel >= 3) {
        glowColor = 0xffd700; // 金色光芒
        intensity = 0.3;
    }
    
    player.traverse(child => {
        if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(m => {
                    if (m.emissive) m.emissive.setHex(glowColor);
                    if (m.emissiveIntensity !== undefined) m.emissiveIntensity = intensity;
                });
            } else {
                if (child.material.emissive) child.material.emissive.setHex(glowColor);
                if (child.material.emissiveIntensity !== undefined) child.material.emissiveIntensity = intensity;
            }
        }
    });
}

/**
 * 🌍 动态环境系统
 * 根据分数改变背景颜色
 */
function updateEnvironment(currentScore) {
    if (!scene) return;
    
    // 定义不同阶段的背景色
    const colors = {
        day: new THREE.Color(0xd4e9ff),    // 白天 (0分)
        dusk: new THREE.Color(0xffd8a8),   // 黄昏 (50分)
        night: new THREE.Color(0x1a1a2e)   // 深夜 (100分+)
    };
    
    let targetColor;
    
    if (currentScore < 50) {
        // 白天 -> 黄昏
        const t = Math.min(currentScore / 50, 1);
        targetColor = colors.day.clone().lerp(colors.dusk, t);
    } else {
        // 黄昏 -> 深夜
        const t = Math.min((currentScore - 50) / 50, 1);
        targetColor = colors.dusk.clone().lerp(colors.night, t);
    }
    
    scene.background = targetColor;
    // 也可以同步调整雾气颜色，如果之后添加了 Fog
    // if (scene.fog) scene.fog.color.copy(targetColor);
}



/**
 * 📸 更新相机位置 (平滑跟随)
 */
function updateCamera() {
    let targetX, targetZ;
    let lookAtX, lookAtZ;

    if (isSpectator) {
        // 观战模式逻辑...
        let targetPos = { x: 0, y: 0, z: 0 };
        if (spectatorTargetId && networkManager.remotePlayers[spectatorTargetId]) {
            targetPos = networkManager.remotePlayers[spectatorTargetId].position;
        } else {
            // 自动寻找第一个玩家观看
            const ids = Object.keys(networkManager.remotePlayers);
            if (ids.length > 0) {
                setSpectatorTarget(ids[0]);
                targetPos = networkManager.remotePlayers[ids[0]].position;
            }
        }
        targetX = targetPos.x + 20;
        targetZ = targetPos.z + 20;
        lookAtX = targetPos.x;
        lookAtZ = targetPos.z;
    } else {
        // 玩家模式
        if (!player) return;
        targetX = player.position.x + 20;
        targetZ = player.position.z + 20;
        lookAtX = player.position.x;
        lookAtZ = player.position.z;
    }
    
    // 应用震动衰减
    cameraShake.x *= 0.85;
    cameraShake.y *= 0.85;
    cameraShake.z *= 0.85;

    // 应用缩放 (蓄力时拉近)
    const targetZoom = isCharging ? 0.7 : 1.0;
    cameraZoom += (targetZoom - cameraZoom) * 0.05;
    camera.zoom = cameraZoom;
    camera.updateProjectionMatrix();

    // 线性插值 (Lerp) 实现平滑移动
    // 当前位置 += (目标位置 - 当前位置) * 系数
    camera.position.x += (targetX - camera.position.x) * 0.1 + cameraShake.x;
    camera.position.z += (targetZ - camera.position.z) * 0.1 + cameraShake.z;
    camera.position.y += (20 - camera.position.y) * 0.1 + cameraShake.y;
    
    camera.lookAt(lookAtX, 0, lookAtZ);
}

/**
 * ✅ 检查是否成功落地
 */
function checkLanding() {
    // 如果已经判定为失败，不再重复检测，防止音效爆炸和重复逻辑
    if (player.userData.hasFailed) return false;

    const lastBlock = blocks[blocks.length - 1]; // 目标方块
    const currentBlock = blocks[blocks.length - 2]; // 起跳方块
    
    // 0. 检查是否原地起跳（落回当前方块）
    // 这种情况不算成功也不算失败，允许玩家继续蓄力
    const distToCurrent = Math.sqrt(
        Math.pow(player.position.x - currentBlock.position.x, 2) + 
        Math.pow(player.position.z - currentBlock.position.z, 2)
    );
    const currentBlockSize = (currentBlock.userData.scale || 1) * config.cubeSize.width / 2;
    
    if (distToCurrent < currentBlockSize + 0.6) {
        // 安全落回原处
        player.position.y = currentBlock.position.y + 1; 
        velocity = { x: 0, y: 0, z: 0 }; 
        rotateSpeed = 0;
        innerPlayer.rotation.x = 0; 
        audioManager.playLand();
        return true; // 保持游戏继续，但不加分不生成新方块
    }

    // 计算玩家与目标方块中心的距离
    // 忽略 Y 轴，只看 X-Z 平面
    const dx = player.position.x - lastBlock.position.x;
    const dz = player.position.z - lastBlock.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    
    // 判断是否在方块范围内
    // 方块宽度的一半约等于 2 (config.cubeSize.width / 2)
    // 稍微放宽一点判定范围
    const targetBlockSize = (lastBlock.userData.scale || 1) * config.cubeSize.width / 2;

    if (distance < targetBlockSize + 0.3) {
        
        // 成功落地!
        Logger.success("Game", "✅ 落地成功!");

        // 🎁 检查道具收集
        if (lastBlock.userData.item) {
            const item = lastBlock.userData.item;
            const type = item.userData.itemType;
            
            // 移除道具
            lastBlock.remove(item);
            lastBlock.userData.item = null;
            
            // 应用效果
            if (type === 'bonus') {
                score += 5;
                showFloatingText('额外+5分!', 0xffd700);
                if(audioManager.playScore) audioManager.playScore(1);
            } else if (type === 'double') {
                scoreMultiplier = 2;
                scoreMultiplierEndTime = Date.now() + 10000; // 10秒双倍
                showFloatingText('双倍积分 10s!', 0x00ffff);
                if(audioManager.playScore) audioManager.playScore(3);
            } else if (type === 'magnet') {
                magnetEndTime = Date.now() + 15000; // 15秒吸铁石
                showFloatingText('吸铁石 15s!', 0xff0000);
                if(audioManager.playScore) audioManager.playScore(2);
            }
        }

        // 停止方块移动，方便玩家进行下一次跳跃
        if (lastBlock.userData.isMoving) {
            lastBlock.userData.isMoving = false;
        }
        
        // 播放音效
        audioManager.playLand();

        // 判定是否是中心命中 (Perfect)
        if (distance < 0.5) {
            combo++;
            const points = (2 * combo) * scoreMultiplier;
            score += points; // 连击加分
            showFloatingScore(points, true);
            showFloatingText('Perfect!', 0xffd700); // 金色提示
            
            // 完美落地音效
            audioManager.playScore(combo);
            
            // 震动特效
            cameraShake = { x: (Math.random()-0.5)*2, y: (Math.random()-0.5)*2, z: (Math.random()-0.5)*2 };
            
            // 完美落地特效 (金色波纹 + 更多粒子)
            rippleSystem.spawn(lastBlock.position, 0xffd700);
            particleSystem.emit(player.position, 0xffd700, 50);
            
            // 更新角色发光
            updatePlayerGlow(combo);
            
        } else {
            combo = 0;
            updatePlayerGlow(0); // 重置发光
            const points = 1 * scoreMultiplier;
            score += points;
            showFloatingScore(points, false);
            // 普通落地特效
            rippleSystem.spawn(lastBlock.position, lastBlock.userData.color);
            particleSystem.emit(player.position, 0xffffff, 15);
        }
        
        updateScoreUI();
        
        // 生成下一个方块
        spawnNextBlock();
        
        // 内存管理：移除太远的方块
        if (blocks.length > 10) {
            const oldBlock = blocks.shift();
            scene.remove(oldBlock);
            if(oldBlock.geometry) oldBlock.geometry.dispose();
            if(oldBlock.material) oldBlock.material.dispose();
        }
        
        return true;
        
    } else if (distance < targetBlockSize + 1.5) {
        // 边缘掉落 (虽然碰到了但没站稳)
        Logger.warn("Game", "⚠️ 边缘滑落!");
        if (!player.userData.hasFailed) {
            audioManager.playFail(); 
            player.userData.hasFailed = true; // 标记失败，防止重复触发
        }
        return false;
    } else {
        // 完全没跳到
        Logger.error("Game", "❌ 跳跃失败!");
        if (!player.userData.hasFailed) {
            audioManager.playFail(); 
            player.userData.hasFailed = true; // 标记失败
        }
        return false;
    }
}

let reviveTimer = null;           // 复活倒计时定时器

/**
 * ☠️ 游戏结束处理
 */
function gameOver() {
    isGameRunning = false;
    
    // 如果已经在等待复活，不要重复触发
    if (isWaitingRevive) return;
    
    // 只有在分数大于0时才允许复活，避免开局就死无限循环
    // 并且如果是主播模式 (isStreamerMode 为 true)
    if (score > 0 && isStreamerMode && !isWaitingRevive) {
        startReviveCountdown();
    } else {
        finalizeGameOver();
    }
}

function startReviveCountdown() {
    isWaitingRevive = true;
    Logger.info("Game", "等待复活...");
    
    // 显示倒计时 UI
    const reviveUI = document.getElementById('revive-ui');
    if (reviveUI) {
        reviveUI.style.display = 'block';
        let timeLeft = 5;
        const countEl = reviveUI.querySelector('.count');
        if (countEl) countEl.innerText = timeLeft;
        
        // 倒计时逻辑
        reviveTimer = setInterval(() => {
            timeLeft--;
            if (countEl) countEl.innerText = timeLeft;
            
            if (timeLeft <= 0) {
                finalizeGameOver();
            }
        }, 1000);
    } else {
        // 如果没有 UI，直接结束
        finalizeGameOver();
    }
}

function finalizeGameOver() {
    if (reviveTimer) {
        clearInterval(reviveTimer);
        reviveTimer = null;
    }
    isWaitingRevive = false;
    const reviveUI = document.getElementById('revive-ui');
    if (reviveUI) reviveUI.style.display = 'none';
    
    Logger.info("Game", `🏁 游戏结束! 最终得分: ${score}`);
    document.getElementById('final-score').innerText = score;
    document.getElementById('game-over').style.display = 'flex';
    
    if (networkManager) {
        networkManager.emitScore(score); 
    }
}

// UI 更新函数
function updateScoreUI() {
    document.getElementById('score').innerText = score;
    const comboEl = document.getElementById('combo-text');
    if (combo > 0) {
        comboEl.style.display = 'block';
        comboEl.innerText = '连击 x' + combo;
        // 重置动画以触发重播
        comboEl.style.animation = 'none';
        comboEl.offsetHeight; /* trigger reflow */
        comboEl.style.animation = 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    } else {
        comboEl.style.display = 'none';
    }
}

function showFloatingScore(points, isPerfect = false) {
    const el = document.createElement('div');
    el.innerText = '+' + points;
    Object.assign(el.style, {
        position: 'absolute', top: '40%', left: '50%',
        transform: 'translate(-50%, -50%)',
        color: isPerfect ? '#ffeb3b' : '#fff',
        fontSize: isPerfect ? '40px' : '30px',
        fontWeight: 'bold', textShadow: '0 0 5px rgba(0,0,0,0.5)',
        pointerEvents: 'none', animation: 'floatUpFade 1s forwards'
    });
    document.body.appendChild(el);
    setTimeout(() => { if(el.parentNode) el.parentNode.removeChild(el); }, 1000);
}

// 音频开关
function toggleAudio() {
    const enabled = audioManager.toggleEnabled();
    audioEnabled = enabled;
    localStorage.setItem(config.audioStorageKey, enabled);
    updateAudioToggleUI();
}
function updateAudioToggleUI() {
    if (!audioToggleBtn) return;
    audioToggleBtn.innerText = audioEnabled ? '🔊 音效开' : '🔇 静音';
    audioToggleBtn.setAttribute('aria-pressed', audioEnabled ? 'false' : 'true');
}

// 观战目标设置
function setSpectatorTarget(id) {
    if (!networkManager.remotePlayers[id]) return;
    spectatorTargetId = id;
    Logger.info("Spectator", `切换观战目标: ${id}`);
    
    // 更新 UI 高亮
    document.querySelectorAll('#leaderboard-list li').forEach(el => {
        if (el.dataset.id === id) {
            el.style.background = 'rgba(255, 255, 255, 0.2)';
        } else {
            el.style.background = '';
        }
    });
}

function updateConnectionStatusUI(status) {
    if (!connectionStatusBar) return;
    let text = '';
    switch (status) {
        case 'connecting': text = '正在连接...'; break;
        case 'reconnecting': text = '正在重连...'; break;
        case 'disconnected': text = '连接已断开，重试中...'; break;
        case 'error': text = '连接失败，请检查网络'; break;
        case 'connected': default: text = '已连接'; break;
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

function revivePlayer() {
    isWaitingRevive = false;
    if (reviveTimer) {
        clearInterval(reviveTimer);
        reviveTimer = null;
    }
    const reviveUI = document.getElementById('revive-ui');
    if (reviveUI) reviveUI.style.display = 'none';
    
    // 重置位置到上一个安全方块
    const safeBlock = blocks[blocks.length - 2];
    player.position.set(safeBlock.position.x, 1, safeBlock.position.z);
    
    // 关键修复：重置物理和动画状态
    velocity = { x: 0, y: 0, z: 0 };
    rotateSpeed = 0;
    innerPlayer.rotation.x = 0; // 修复姿势
    player.userData.hasFailed = false; // 修复复活后无法跳跃成功的问题
    
    // 重置朝向
    const nextBlock = blocks[blocks.length - 1];
    if (nextBlock) {
        const dx = nextBlock.position.x - safeBlock.position.x;
        const dz = nextBlock.position.z - safeBlock.position.z;
        targetRotationY = Math.atan2(dx, dz);
        player.rotation.y = targetRotationY; // 立即转向，避免复活时还在转圈
    }

    isGameRunning = true;
    
    showFloatingText('复活成功!', 0x67C23A);
}

// 启动游戏
init();
