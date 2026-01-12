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
        // 如果连击高，再加一个泛音
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
        // 使用共享 Geometry 和 Material
        // 注意：material 颜色需要变。这里为了性能，可以用 MeshBasicMaterial 并 clone 改变 color
        // 或者使用 VertexColors。简单起见，这里我们允许 particle material new，但必须清理。
        // 或者复用 ResourceManager 里的 material?
        // 实际上 ResourceManager.getColoredMaterial 已经缓存了颜色 material，这里可以直接用
        
        // 简单做法：每个粒子用 ResourceManager.geometries.particle 和 对应颜色的 material
        // 但是 color 是 hex，我们得转换一下
        
        // 稍微改一下，让粒子使用缓存的材质
        let material;
        if (color instanceof THREE.Color) {
             material = ResourceManager.getColoredMaterial(color.getHex()).clone();
        } else {
             material = ResourceManager.getColoredMaterial(color).clone();
        }
        material.transparent = true;
        
        // geometry 复用
        const geometry = ResourceManager.geometries.particle;
        
        for (let i = 0; i < count; i++) {
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(position);
            
            // 随机散开
            particle.position.x += (Math.random() - 0.5) * 1.5;
            particle.position.z += (Math.random() - 0.5) * 1.5;
            particle.position.y += 0.5; // 从方块表面上方一点生成
            
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
                if (p.mesh.material) p.mesh.material.dispose(); // 清理克隆的材质
                this.particles.splice(i, 1);
                continue;
            }
            
            p.velocity.y -= 0.02; // 重力
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
        // 几何体
        this.geometries.box = new THREE.BoxGeometry(config.cubeSize.width, config.cubeSize.height, config.cubeSize.depth);
        this.geometries.center = new THREE.CylinderGeometry(0.8, 0.8, 0.1, 32);
        this.geometries.particle = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        
        // 材质 (部分可复用)
        this.materials.center = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
        this.materials.particle = new THREE.MeshBasicMaterial({ color: 0xffffff }); // 颜色会变，但可以使用顶点颜色或克隆材质
    },
    getColoredMaterial: function(colorHex) {
        if (!this.materials[colorHex]) {
            this.materials[colorHex] = new THREE.MeshLambertMaterial({ color: colorHex });
        }
        return this.materials[colorHex];
    }
};

// 全局变量
let scene, camera, renderer, dirLight;
let player, innerPlayer, audioManager, particleSystem;
let blocks = [];
let score = 0;
let combo = 0;
let isGameRunning = false;
let isCharging = false;
let chargeStartTime = 0;
let velocity = { x: 0, y: 0, z: 0 };
let rotateSpeed = 0; // 统一的翻滚速度
let targetRotationY = 0; // 目标朝向
let animations = []; // 存储简单的动画对象 { update: function() -> boolean }

function init() {
    // 场景
    scene = new THREE.Scene();
    // 移除纯色背景，使用CSS渐变，ThreeJS背景设为透明
    // scene.background = new THREE.Color(0xd7d2cc); 

    // 相机
    const aspect = window.innerWidth / window.innerHeight;
    const d = 18; // 缩小视野范围，使物体看起来更大
    camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    camera.position.set(20, 20, 20);
    camera.lookAt(scene.position);

    // 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // alpha: true 允许透明背景
    renderer.setSize(window.innerWidth, window.innerHeight);
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
    ResourceManager.init(); // 初始化资源

    resetGame();

    // 事件
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.repeat) onMouseDown(e);
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') onMouseUp(e);
    });
    
    const inputStart = (e) => {
        if(e.type === 'touchstart') e.preventDefault();
        onMouseDown(e);
    };
    const inputEnd = (e) => {
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

    animate();
}

function resetGame() {
    blocks.forEach(block => {
        scene.remove(block);
        // 彻底清理：只需清理非共享的资源，或者如果用了共享资源就不 dispose geometry
        // 这里我们的 geometry 是共享的，所以不要 dispose geometry
        // material 如果是共享的（ResourceManager.materials）也不要 dispose
        // 但我们在 createBlock 里用了 ResourceManager.getColoredMaterial，这些是缓存的，也不应该 dispose
        // 除非我们想清空缓存。但在 resetGame 时保留缓存是可以的。
        
        // 注意：block 的 children (center)
        // center 的 geometry/material 也是共享的，不用 dispose
    });
    blocks = [];
    
    // 玩家
    if (player) {
        scene.remove(player);
        // 玩家的 geometry/material 是每次 createPlayer new 的，需要 dispose
        // 为了优化，我们也可以把 player 的资源放入 ResourceManager，或者在这里彻底清理
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
    // 随机颜色
    const color = config.colors[Math.floor(Math.random() * config.colors.length)];
    
    // 主体 - 使用共享 Geometry
    const geometry = ResourceManager.geometries.box;
    const material = ResourceManager.getColoredMaterial(color);
    const block = new THREE.Mesh(geometry, material);
    
    block.position.set(x, 0, z);
    block.castShadow = true;
    block.receiveShadow = true;
    
    // 靶心 - 使用共享 Geometry/Material
    const center = new THREE.Mesh(ResourceManager.geometries.center, ResourceManager.materials.center);
    center.position.set(0, config.cubeSize.height / 2 + 0.05, 0); 
    block.add(center);

    if (delay > 0) {
        // 下落动画
        const targetY = 0;
        block.position.y = 10;
        animations.push({
            time: 0,
            duration: 40, // 帧数
            update: function() {
                this.time++;
                const progress = this.time / this.duration;
                if (progress >= 1) {
                    block.position.y = targetY;
                    return true; // 结束
                }
                const val = Easing.easeOutElastic(progress);
                block.position.y = 10 - val * 10;
                return false;
            }
        });
    }

    scene.add(block);
    blocks.push(block);
    
    // 挂载颜色信息给粒子使用
    block.userData.color = color;
    
    return block;
}

function createPlayer() {
    player = new THREE.Group();
    
    // 材质
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffccaa }); // 肤色
    const redMat = new THREE.MeshLambertMaterial({ color: 0xd32f2f }); // 红色
    const goldMat = new THREE.MeshPhongMaterial({ color: 0xffd700, shininess: 100 }); // 金色
    const blackMat = new THREE.MeshLambertMaterial({ color: 0x111111 }); // 黑色
    const fireMat = new THREE.MeshBasicMaterial({ color: 0xff5722 }); // 火焰色

    // 1. 头部 Group
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.6;
    
    // 脸部
    const faceGeo = new THREE.SphereGeometry(0.4, 32, 32);
    const face = new THREE.Mesh(faceGeo, skinMat);
    headGroup.add(face);

    // 双丸子头 (左)
    const bunGeo = new THREE.SphereGeometry(0.2, 32, 32);
    const bunLeft = new THREE.Mesh(bunGeo, blackMat);
    bunLeft.position.set(-0.35, 0.3, 0);
    headGroup.add(bunLeft);
    
    // 双丸子头 (右)
    const bunRight = new THREE.Mesh(bunGeo, blackMat);
    bunRight.position.set(0.35, 0.3, 0);
    headGroup.add(bunRight);
    
    // 发带 (简单的红色圆环或球体装饰)
    const tieGeo = new THREE.TorusGeometry(0.08, 0.02, 8, 16);
    const tieLeft = new THREE.Mesh(tieGeo, redMat);
    tieLeft.position.set(-0.35, 0.25, 0);
    tieLeft.rotation.x = Math.PI / 2;
    headGroup.add(tieLeft);

    const tieRight = new THREE.Mesh(tieGeo, redMat);
    tieRight.position.set(0.35, 0.25, 0);
    tieRight.rotation.x = Math.PI / 2;
    headGroup.add(tieRight);

    player.add(headGroup);

    // 2. 身体
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.8, 32);
    const body = new THREE.Mesh(bodyGeo, redMat); // 红肚兜/衣服
    body.position.y = 0.9;
    player.add(body);

    // 3. 乾坤圈 (脖子上的金环)
    const ringGeo = new THREE.TorusGeometry(0.32, 0.04, 16, 32);
    const ring = new THREE.Mesh(ringGeo, goldMat);
    ring.position.y = 1.25;
    ring.rotation.x = Math.PI / 2; // 水平放置
    ring.rotation.y = -0.2; // 稍微歪一点
    player.add(ring);

    // 4. 混天绫 (飘带 - 简化为两条弯曲的带子)
    // 这里用细长的 Box 模拟飘在身后的样子
    const ribbonGeo = new THREE.BoxGeometry(1.2, 0.1, 0.05);
    const ribbon = new THREE.Mesh(ribbonGeo, redMat);
    ribbon.position.set(0, 1.1, -0.3);
    // 弯曲一点造型
    ribbon.rotation.z = 0.1;
    ribbon.rotation.y = 0.2;
    player.add(ribbon);

    // 5. 风火轮 (脚下的火轮)
    player.userData.wheels = [];
    const wheelGeo = new THREE.TorusGeometry(0.25, 0.05, 8, 16);
    
    // 左轮
    const wheelLeft = new THREE.Mesh(wheelGeo, fireMat);
    wheelLeft.position.set(-0.3, 0.25, 0);
    wheelLeft.rotation.y = Math.PI / 2; // 竖着
    player.add(wheelLeft);
    player.userData.wheels.push(wheelLeft);

    // 右轮
    const wheelRight = new THREE.Mesh(wheelGeo, fireMat);
    wheelRight.position.set(0.3, 0.25, 0);
    wheelRight.rotation.y = Math.PI / 2;
    player.add(wheelRight);
    player.userData.wheels.push(wheelRight);

    // 设置整体位置
    player.position.set(0, 1, 0);
    
    // 开启阴影
    player.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    scene.add(player);
}

function spawnNextBlock(animate = true) {
    const lastBlock = blocks[blocks.length - 1];
    const distance = 4 + Math.random() * 5; // 距离
    const direction = Math.random() > 0.5 ? 'x' : 'z';
    
    let x = lastBlock.position.x;
    let z = lastBlock.position.z;
    
    if (direction === 'x') x -= distance;
    else z -= distance;
    
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
    
    // 玩家压缩动画（重置缩放）
    player.scale.set(1, 1, 1);
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
    
    // 确定方向
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
    
    // 旋转逻辑
    if (dir.x !== 0) {
        rotationVelocity.z = -0.15; 
        rotationVelocity.x = 0;
    } else {
        rotationVelocity.x = -0.15;
        rotationVelocity.z = 0;
    }
    
    // 恢复形状动画
    animations.push({
        time: 0,
        duration: 10,
        update: function() {
            this.time++;
            const p = this.time / this.duration;
            player.scale.y = config.maxCompression + (1 - config.maxCompression) * Easing.easeOutQuad(p);
            // x, z 也要恢复
            const scaleXZ = 1 + (config.maxCompression - player.scale.y) / 2;
            player.scale.x = scaleXZ;
            player.scale.z = scaleXZ;
            return p >= 1;
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    
    // 处理所有自定义动画
    for (let i = animations.length - 1; i >= 0; i--) {
        const finished = animations[i].update();
        if (finished) animations.splice(i, 1);
    }
    
    // 蓄力表现
    if (isCharging && isGameRunning) {
        if (player.scale.y > config.maxCompression) {
            player.scale.y -= 0.015;
            player.scale.x += 0.01;
            player.scale.z += 0.01;
        }
    }
    
    // 物理更新
    if (isGameRunning) {
        if (velocity.y !== 0 || player.position.y > 1) {
            player.position.x += velocity.x;
            player.position.z += velocity.z;
            player.position.y += velocity.y;
            velocity.y -= config.gravity; 
            
            // 简单的跳跃旋转
            if (velocity.y > 0 || player.position.y > 1.5) {
                player.rotation.x += rotationVelocity.x;
                player.rotation.z += rotationVelocity.z;
            }

            // 风火轮旋转动画
            if (player.userData.wheels) {
                player.userData.wheels.forEach(wheel => {
                    wheel.rotation.z -= 0.2; // 让轮子一直转
                });
            }
            
            // 落地判断
            if (player.position.y <= 1 && velocity.y < 0) {
                if (checkLanding()) {
                    // 成功着陆
                    player.position.y = 1;
                    velocity = { x: 0, y: 0, z: 0 };
                    rotationVelocity = { x: 0, z: 0 };
                    player.rotation.set(0, 0, 0);
                    
                    // 着陆后的挤压动画
                    animations.push({
                        time: 0,
                        duration: 10,
                        update: function() {
                            this.time++;
                            // 简单的弹一下：压扁 -> 恢复
                            const p = this.time / this.duration;
                            const y = 1 - Math.sin(p * Math.PI) * 0.2;
                            player.scale.y = y;
                            player.scale.x = 1 + (1-y)/2;
                            player.scale.z = 1 + (1-y)/2;
                            return p >= 1;
                        }
                    });

                } else {
                    // 没落在方块上，继续掉落
                    // 只有当 y 非常低时才触发游戏结束，让玩家看到掉下去的过程
                }
            }
        } else {
             // 逻辑修正：如果不在跳跃中，强制修正位置防止浮点漂移
             if (player.position.y !== 1) player.position.y = 1;
             if (velocity.y !== 0) velocity.y = 0;
        } 
        
        // 掉落判定
        if (player.position.y < -5) {
            gameOver();
        }
        
        updateCamera();
    }
    
    particleSystem.update();
    renderer.render(scene, camera);
}

function updateCamera() {
    if (!player) return;
    const targetX = player.position.x + 20;
    const targetZ = player.position.z + 20;
    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.z += (targetZ - camera.position.z) * 0.05;
    camera.lookAt(player.position.x, 0, player.position.z);

    // 灯光跟随
    if (dirLight) {
        // 保持相对位置 (10, 30, 20)
        // 假设初始玩家在 (0,0,0)，灯光在 (10, 30, 20)
        // 现在的玩家位置 player.position
        dirLight.position.set(
            player.position.x + 10,
            player.position.y + 30,
            player.position.z + 20
        );
        dirLight.target = player; // 让灯光始终照向玩家
    }
}

function checkLanding() {
    let landedBlock = null;
    let landedIndex = -1;
    
    for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const dx = Math.abs(player.position.x - b.position.x);
        const dz = Math.abs(player.position.z - b.position.z);
        // 判定区域稍微放宽一点
    if (dx < 2.3 && dz < 2.3) {
        landedBlock = b;
        landedIndex = i;
        break;
    }
}

if (landedBlock) {
        audioManager.playLand();
        particleSystem.emit(player.position, landedBlock.userData.color);
        
        // 逻辑判断：是否是新的方块
        // 我们假设 blocks 列表最后一个是新的目标，倒数第二个是出发点
        // 如果跳到了 blocks.length - 1，则是前进
        // 如果跳到了 blocks.length - 2，则是原地跳（不加分，连击清零）
        
        if (landedIndex === blocks.length - 1) {
            // 命中靶心检测
            const dist = Math.sqrt(
                Math.pow(player.position.x - landedBlock.position.x, 2) + 
                Math.pow(player.position.z - landedBlock.position.z, 2)
            );
            
            let addScore = 1;
            let isPerfect = false;
            
            if (dist < 0.5) { // 靶心范围
                combo++;
                addScore = 1 + combo; // 1 -> 2 -> 4 -> 6 ... 或者简单累加 2, 3, 4
                addScore = Math.pow(2, combo); // 指数增长：2, 4, 8...
                isPerfect = true;
            } else {
                combo = 0;
                addScore = 1;
            }
            
            score += addScore;
            audioManager.playScore(combo);
            updateScoreUI();
            showFloatingScore(addScore, isPerfect);
            
            spawnNextBlock();
            
            // 移除旧方块
    if (blocks.length > 6) {
        const old = blocks.shift();
        scene.remove(old);
        // 这里不用 dispose，因为使用了共享资源
    }
        } else if (landedIndex < blocks.length - 1) {
            // 跳回去了或者原地跳，连击清零
            combo = 0;
            updateScoreUI();
        }
        
        return true;
    }
    
    // 如果没落在方块上，但 y > 0 还没完全掉下去，返回 false 让物理引擎继续处理下落
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
    
    // 计算屏幕位置
    // 简单的映射：大概在屏幕中央偏上
    // 更精确的做法是投影 player 坐标到屏幕坐标，这里偷懒直接居中
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
