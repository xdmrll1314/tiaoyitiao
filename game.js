// 游戏配置
const config = {
    background: 0xffffff,
    groundSize: { width: 10, height: 5 },
    cubeSize: { width: 4, height: 2, depth: 4 },
    playerColor: 0x333333,
    gravity: 0.05,
    jumpFactor: 0.01,
    maxCompression: 0.5,
    colors: [0x67C23A, 0xE6A23C, 0xF56C6C, 0x409EFF, 0x909399, 0x8e44ad, 0x2c3e50, 0x16a085],
    particlesCount: 20
};

// 工具函数：简单的缓动
const Easing = {
    easeOutQuad: t => t * (2 - t),
    easeOutElastic: t => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
};

// 音频管理器
class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.oscillator = null;
        this.gainNode = null;
    }

    playTone(freq, type, duration, startTime = 0) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);
        
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + startTime + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);
    }

    startCharge() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.oscillator = this.ctx.createOscillator();
        this.gainNode = this.ctx.createGain();
        
        this.oscillator.type = 'sine';
        this.oscillator.frequency.setValueAtTime(150, this.ctx.currentTime);
        this.oscillator.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 2);
        
        this.gainNode.gain.setValueAtTime(0.05, this.ctx.currentTime);
        
        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);
        this.oscillator.start();
    }

    stopCharge() {
        if (this.oscillator) {
            this.oscillator.stop();
            this.oscillator.disconnect();
            this.oscillator = null;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
    }
    
    playJump() {
        this.playTone(150, 'square', 0.1);
    }
    
    playLand() {
        this.playTone(100, 'sine', 0.1);
    }
    
    playScore(combo) {
        const baseFreq = 440;
        const freq = baseFreq + (combo * 50);
        this.playTone(freq, 'sine', 0.3);
        if (combo > 1) {
            this.playTone(freq * 1.5, 'triangle', 0.3, 0.05);
        }
    }

    playFail() {
        this.playTone(100, 'sawtooth', 0.5);
        this.playTone(80, 'sawtooth', 0.5, 0.2);
    }
}

// 粒子系统
class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }
    
    emit(position, color, count = 20) {
        let material;
        if (color instanceof THREE.Color) {
             material = ResourceManager.getColoredMaterial(color.getHex()).clone();
        } else {
             material = ResourceManager.getColoredMaterial(color).clone();
        }
        material.transparent = true;
        
        const geometry = ResourceManager.geometries.particle;
        
        for (let i = 0; i < count; i++) {
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(position);
            
            particle.position.x += (Math.random() - 0.5) * 1.5;
            particle.position.z += (Math.random() - 0.5) * 1.5;
            particle.position.y += 0.5; 
            
            const velocity = {
                x: (Math.random() - 0.5) * 0.4,
                y: Math.random() * 0.5 + 0.2,
                z: (Math.random() - 0.5) * 0.4
            };
            
            this.scene.add(particle);
            this.particles.push({ mesh: particle, velocity, life: 1.0 });
        }
    }
    
    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= 0.02;
            
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                if (p.mesh.material) p.mesh.material.dispose();
                this.particles.splice(i, 1);
                continue;
            }
            
            p.velocity.y -= 0.02; 
            p.mesh.position.x += p.velocity.x;
            p.mesh.position.y += p.velocity.y;
            p.mesh.position.z += p.velocity.z;
            p.mesh.rotation.x += 0.1;
            p.mesh.rotation.y += 0.1;
            
            p.mesh.scale.setScalar(p.life);
            p.mesh.material.opacity = p.life;
        }
    }
}

// 资源管理器
const ResourceManager = {
    geometries: {},
    materials: {},
    init: function() {
        this.geometries.box = new THREE.BoxGeometry(config.cubeSize.width, config.cubeSize.height, config.cubeSize.depth);
        this.geometries.center = new THREE.CylinderGeometry(0.8, 0.8, 0.1, 32);
        this.geometries.particle = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        
        this.materials.center = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
        this.materials.particle = new THREE.MeshBasicMaterial({ color: 0xffffff }); 
    },
    getColoredMaterial: function(colorHex) {
        if (!this.materials[colorHex]) {
            this.materials[colorHex] = new THREE.MeshLambertMaterial({ color: colorHex });
        }
        return this.materials[colorHex];
    }
};

// 波纹特效
class RippleSystem {
    constructor(scene) {
        this.scene = scene;
        this.ripples = [];
        this.geometry = new THREE.RingGeometry(0.5, 0.7, 32);
        this.geometry.rotateX(-Math.PI / 2); // 预先旋转
        this.material = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.5, 
            side: THREE.DoubleSide 
        });
    }

    spawn(position, color) {
        const mesh = new THREE.Mesh(this.geometry, this.material.clone());
        if (color) mesh.material.color.setHex(color);
        // 确保波纹在方块上方一点点
        mesh.position.copy(position);
        mesh.position.y = 1.05; 
        
        this.scene.add(mesh);
        this.ripples.push({ mesh, age: 0 });
    }

    update() {
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.age += 0.02;
            
            // 扩散和淡出
            const scale = 1 + r.age * 5;
            r.mesh.scale.setScalar(scale);
            r.mesh.material.opacity = 0.6 * (1 - r.age);
            
            if (r.age >= 1) {
                this.scene.remove(r.mesh);
                if (r.mesh.material) r.mesh.material.dispose();
                this.ripples.splice(i, 1);
            }
        }
    }
}

// 漂浮云朵
class CloudSystem {
    constructor(scene) {
        this.scene = scene;
        this.clouds = [];
        this.geometry = new THREE.BoxGeometry(1, 1, 1);
        this.material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 });
        
        for (let i = 0; i < 15; i++) {
            this.spawn();
        }
    }

    spawn() {
        const group = new THREE.Group();
        const segments = 3 + Math.floor(Math.random() * 3);
        for(let i=0; i<segments; i++) {
            const mesh = new THREE.Mesh(this.geometry, this.material);
            mesh.position.set(
                (Math.random() - 0.5) * 3,
                (Math.random() - 0.5) * 1,
                (Math.random() - 0.5) * 3
            );
            mesh.scale.set(
                1 + Math.random() * 2,
                0.5 + Math.random(),
                1 + Math.random() * 2
            );
            group.add(mesh);
        }
        
        // 随机分布在场景周围
        group.position.set(
            (Math.random() - 0.5) * 100,
            -10 + Math.random() * 10, 
            (Math.random() - 0.5) * 100
        );
        
        this.scene.add(group);
        this.clouds.push({ mesh: group, speed: 0.02 + Math.random() * 0.03 });
    }

    update() {
        this.clouds.forEach(c => {
            c.mesh.position.x += c.speed;
            if (c.mesh.position.x > 60) {
                c.mesh.position.x = -60;
                c.mesh.position.z = (Math.random() - 0.5) * 100;
            }
        });
    }
}

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
let nameTags = {}; // { socketId: htmlElement }
let powerBar, powerBarContainer; // 缓存 DOM 元素

let cameraShake = { x: 0, y: 0, z: 0 }; // 相机震动
let cameraZoom = 1; // 相机缩放

// 多人游戏变量
let socket;
let remotePlayers = {}; // { socketId: mesh }

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
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    dirLightObj.shadow.mapSize.width = 2048;
    dirLightObj.shadow.mapSize.height = 2048;
    dirLightObj.shadow.camera.left = -20;
    dirLightObj.shadow.camera.right = 20;
    dirLightObj.shadow.camera.top = 20;
    dirLightObj.shadow.camera.bottom = -20;
    scene.add(dirLightObj);
    dirLight = dirLightObj;

    // 辅助系统
    audioManager = new AudioManager();
    particleSystem = new ParticleSystem(scene);
    cloudSystem = new CloudSystem(scene);
    rippleSystem = new RippleSystem(scene);
    ResourceManager.init();
    
    // 缓存 DOM
    powerBar = document.getElementById('power-bar');
    powerBarContainer = document.getElementById('power-bar-container');

    // 等待用户输入昵称后再连接 Socket
    // socket = io();
    // setupSocketHandlers();

    // resetGame();

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

    // 登录逻辑
    document.getElementById('start-game-btn').addEventListener('click', () => {
        const input = document.getElementById('nickname-input');
        const val = input.value.trim();
        if (val) {
            nickname = val;
            document.getElementById('login-modal').style.display = 'none';
            startGame();
        } else {
            alert('请输入昵称');
        }
    });

    animate();
}

function startGame() {
    socket = io();
    setupSocketHandlers();
    
    // 连接成功后发送昵称
    socket.on('connect', () => {
        socket.emit('setNickname', nickname);
    });

    resetGame();
}

function createNameTag(id, name, isMe) {
    // 尝试通过 ID 查找现有的 DOM 元素，防止 nameTags 引用丢失导致的重复
    let tag = nameTags[id];
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
    nameTags[id] = tag;
    return tag;
}

function updateNameTags() {
    const activeIds = new Set();

    // 更新我的名牌
    if (player && socket) {
        activeIds.add(socket.id);
        if (nameTags[socket.id]) {
            updateTagPosition(player.position, nameTags[socket.id]);
        }
    }

    // 更新远程玩家名牌
    Object.keys(remotePlayers).forEach(id => {
        activeIds.add(id);
        if (remotePlayers[id] && nameTags[id]) {
            updateTagPosition(remotePlayers[id].position, nameTags[id]);
        }
    });

    // 清理僵尸标签
    // 1. 清理 nameTags 对象中过期的
    Object.keys(nameTags).forEach(id => {
        if (!activeIds.has(id)) {
            if (nameTags[id].parentNode) nameTags[id].parentNode.removeChild(nameTags[id]);
            delete nameTags[id];
        }
    });

    // 2. 扫描 DOM 清理漏网之鱼 (防止页面上残留无法交互的标签)
    document.querySelectorAll('.player-name-tag').forEach(tag => {
        const id = tag.dataset.id;
        if (!id || !activeIds.has(id)) {
            if (tag.parentNode) tag.parentNode.removeChild(tag);
        }
    });
}

function updateTagPosition(pos, tag) {
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

function setupSocketHandlers() {
    socket.on('currentPlayers', (players) => {
        Object.keys(players).forEach((id) => {
            if (id === socket.id) return;
            createRemotePlayer(id, players[id]);
        });
    });

    socket.on('newPlayer', (playerInfo) => {
        if (playerInfo.id === socket.id) return;
        createRemotePlayer(playerInfo.id, playerInfo);
    });
    
    socket.on('playerInfoUpdate', (playerInfo) => {
        // 更新昵称显示
        createNameTag(playerInfo.id, playerInfo.nickname, playerInfo.id === socket.id);
    });

    socket.on('playerMoved', (playerInfo) => {
        if (remotePlayers[playerInfo.id]) {
            const rp = remotePlayers[playerInfo.id];
            // 平滑移动目标
            rp.userData.targetPos = { x: playerInfo.x, y: playerInfo.y, z: playerInfo.z };
            rp.userData.targetRot = playerInfo.rotationY;
        }
    });

    socket.on('playerDisconnected', (id) => {
        if (remotePlayers[id]) {
            scene.remove(remotePlayers[id]);
            // 清理
            remotePlayers[id].traverse(child => {
                 if (child.isMesh) {
                     if (child.geometry) child.geometry.dispose();
                     if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material.dispose();
                     }
                 }
            });
            delete remotePlayers[id];
        }
        // 清理名牌
        if (nameTags[id]) {
            if (nameTags[id].parentNode) nameTags[id].parentNode.removeChild(nameTags[id]);
            delete nameTags[id];
        }
    });

    socket.on('leaderboardUpdate', (leaderboard) => {
        updateLeaderboardUI(leaderboard);
    });
}

function updateLeaderboardUI(leaderboard) {
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';
    leaderboard.forEach((p, index) => {
        const li = document.createElement('li');
        // 简单显示：排名. 昵称: 分数
        const displayName = p.nickname || p.id.substring(0, 4);
        const isMe = p.id === socket.id ? ' (我)' : '';
        li.innerHTML = `<span>#${index + 1} ${displayName}${isMe}</span> <span>${p.score}</span>`;
        list.appendChild(li);
    });
}

function createRemotePlayer(id, data) {
    // 远程玩家也是哪吒，但可能半透明或者颜色不同
    const mesh = createCharacterMesh(false); 
    mesh.position.set(data.x, data.y, data.z);
    mesh.rotation.y = data.rotationY;
    
    mesh.userData.targetPos = { x: data.x, y: data.y, z: data.z };
    mesh.userData.targetRot = data.rotationY;

    // 让远程玩家稍微半透明一点，区分“我”
    mesh.traverse(child => {
        if (child.isMesh && child.material) {
            if (!Array.isArray(child.material)) {
                child.material = child.material.clone();
                child.material.transparent = true;
                child.material.opacity = 0.7;
            }
        }
    });

    scene.add(mesh);
    remotePlayers[id] = mesh;
    
    // 创建名牌
    if (data.nickname) {
        createNameTag(id, data.nickname, false);
    }
}

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
    if (socket) {
        socket.emit('updateScore', 0);
        // 重置时也更新一下我的名牌 (防止断线重连等情况)
        createNameTag(socket.id, nickname, true);
    }

    // 初始方块
    createBlock(0, 0, 0, false);
    createPlayer();
    spawnNextBlock(false);
    
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

// 统一的角色创建函数
function createCharacterMesh(isLocal) {
    const group = new THREE.Group();
    const inner = new THREE.Group();
    group.add(inner);
    
    // 如果是本地创建，绑定全局变量以便控制
    if (isLocal) {
        innerPlayer = inner;
    }

    // 材质
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffccaa }); 
    const redMat = new THREE.MeshLambertMaterial({ color: 0xd32f2f }); 
    const goldMat = new THREE.MeshPhongMaterial({ color: 0xffd700, shininess: 100 }); 
    const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 }); 
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xff5722 }); 

    // 头部
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.6;
    
    const faceGeo = new THREE.SphereGeometry(0.4, 32, 32);
    const face = new THREE.Mesh(faceGeo, skinMat);
    headGroup.add(face);

    const bunGeo = new THREE.SphereGeometry(0.2, 32, 32);
    const bunLeft = new THREE.Mesh(bunGeo, blackMat);
    bunLeft.position.set(-0.35, 0.3, 0);
    headGroup.add(bunLeft);
    
    const bunRight = new THREE.Mesh(bunGeo, blackMat);
    bunRight.position.set(0.35, 0.3, 0);
    headGroup.add(bunRight);
    
    const tieGeo = new THREE.TorusGeometry(0.08, 0.02, 8, 16);
    const tieLeft = new THREE.Mesh(tieGeo, redMat);
    tieLeft.position.set(-0.35, 0.25, 0);
    tieLeft.rotation.x = Math.PI / 2;
    headGroup.add(tieLeft);

    const tieRight = new THREE.Mesh(tieGeo, redMat);
    tieRight.position.set(0.35, 0.25, 0);
    tieRight.rotation.x = Math.PI / 2;
    headGroup.add(tieRight);

    inner.add(headGroup);

    // 身体
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.8, 32);
    const body = new THREE.Mesh(bodyGeo, redMat); 
    body.position.y = 0.9;
    inner.add(body);

    // 乾坤圈
    const ringGeo = new THREE.TorusGeometry(0.32, 0.04, 16, 32);
    const ring = new THREE.Mesh(ringGeo, goldMat);
    ring.position.y = 1.25;
    ring.rotation.x = Math.PI / 2; 
    ring.rotation.y = -0.2; 
    inner.add(ring);

    // 混天绫
    const ribbonGeo = new THREE.BoxGeometry(1.2, 0.1, 0.05);
    const ribbon = new THREE.Mesh(ribbonGeo, redMat);
    ribbon.position.set(0, 1.1, -0.3);
    ribbon.rotation.z = 0.1;
    ribbon.rotation.y = 0.2;
    inner.add(ribbon);

    // 风火轮
    group.userData.wheels = [];
    const wheelGeo = new THREE.TorusGeometry(0.25, 0.05, 8, 16);
    
    const wheelLeft = new THREE.Mesh(wheelGeo, fireMat);
    wheelLeft.position.set(-0.3, 0.25, 0);
    wheelLeft.rotation.y = Math.PI / 2; 
    inner.add(wheelLeft);
    group.userData.wheels.push(wheelLeft);

    const wheelRight = new THREE.Mesh(wheelGeo, fireMat);
    wheelRight.position.set(0.3, 0.25, 0);
    wheelRight.rotation.y = Math.PI / 2;
    inner.add(wheelRight);
    group.userData.wheels.push(wheelRight);

    // 开启阴影
    group.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    return group;
}

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
        
        // 发送玩家状态
        if (socket) {
            socket.emit('playerMovement', {
                x: player.position.x,
                y: player.position.y,
                z: player.position.z,
                rotationY: player.rotation.y
            });
        }
        
        updateNameTags(); // 更新名牌位置
    }
    
    // 更新远程玩家
    Object.keys(remotePlayers).forEach(id => {
        const rp = remotePlayers[id];
        if (rp.userData.targetPos) {
            // 插值平滑移动
            rp.position.x += (rp.userData.targetPos.x - rp.position.x) * 0.1;
            rp.position.y += (rp.userData.targetPos.y - rp.position.y) * 0.1;
            rp.position.z += (rp.userData.targetPos.z - rp.position.z) * 0.1;
            
            // 角度插值
            let delta = rp.userData.targetRot - rp.rotation.y;
            if (Math.abs(delta) > 0.01) rp.rotation.y += delta * 0.1;
            else rp.rotation.y = rp.userData.targetRot;
        }
        // 也可以加一点风火轮动画
        if (rp.userData.wheels) {
             rp.userData.wheels.forEach(wheel => {
                 wheel.rotation.z -= 0.2; 
             });
        }
    });
    
    particleSystem.update();
    if (cloudSystem) cloudSystem.update();
    if (rippleSystem) rippleSystem.update();
    renderer.render(scene, camera);
}

function updateCamera() {
    if (!player) return;
    const targetX = player.position.x + 20;
    const targetZ = player.position.z + 20;
    
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
    camera.lookAt(player.position.x, 0, player.position.z);

    // 恢复原来的 position 供下一次计算 (去除震动偏移，否则震动会累积漂移)
    camera.position.x -= cameraShake.x;
    camera.position.y = 20;
    camera.position.z -= cameraShake.z;

    if (dirLight) {
        dirLight.position.set(
            player.position.x + 10,
            player.position.y + 30,
            player.position.z + 20
        );
        dirLight.target = player; 
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
            socket.emit('scoreUpdate', score);

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
