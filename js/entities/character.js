// 统一的角色创建函数
function createCharacterMesh(isLocal, type = 'nezha', options = {}) {
    Logger.info("Entity", `👤 创建${isLocal ? "本地" : "远程"}角色模型`, `类型: ${type}`);
    const group = new THREE.Group();
    const inner = new THREE.Group();
    group.add(inner);
    
    // 如果是本地创建，绑定全局变量以便控制
    if (isLocal) {
        innerPlayer = inner;
        player = group; // 确保 player 指向 group
    }

    // 根据类型创建不同的外观
    let meshGroup;
    switch (type) {
        case 'custom':
            meshGroup = createCustomCharacter(options.colors);
            break;
        case 'wukong':
            meshGroup = createWukong();
            break;
        case 'bajie':
            meshGroup = createBajie();
            break;
        case 'hulk':
            meshGroup = createHulk();
            break;
        case 'captain':
            meshGroup = createCaptain();
            break;
        case 'thor':
            meshGroup = createThor();
            break;
        case 'nezha':
        default:
            meshGroup = createNezha();
            break;
    }
    
    inner.add(meshGroup);

    // 开启阴影
    group.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    return group;
}

// --- 角色外观实现 ---

// 1. 哪吒 (默认)
function createNezha() {
    const group = new THREE.Group();

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

    group.add(headGroup);

    // 身体
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.8, 32);
    const body = new THREE.Mesh(bodyGeo, redMat); 
    body.position.y = 0.9;
    group.add(body);

    // 乾坤圈
    const ringGeo = new THREE.TorusGeometry(0.32, 0.04, 16, 32);
    const ring = new THREE.Mesh(ringGeo, goldMat);
    ring.position.y = 1.25;
    ring.rotation.x = Math.PI / 2; 
    ring.rotation.y = -0.2; 
    group.add(ring);

    // 混天绫
    const ribbonGeo = new THREE.BoxGeometry(1.2, 0.1, 0.05);
    const ribbon = new THREE.Mesh(ribbonGeo, redMat);
    ribbon.position.set(0, 1.1, -0.3);
    ribbon.rotation.z = 0.1;
    ribbon.rotation.y = 0.2;
    group.add(ribbon);

    // 风火轮 (特殊处理：绑定到 userData 以便旋转)
    // 注意：createCharacterMesh 返回的是最外层 group，
    // 这里我们将风火轮引用存到 group.userData 中，
    // 但此时 group 还没完全构建好，我们需要一种方式让外部访问。
    // 在 createCharacterMesh 中我们把 inner 加到了 group。
    // 我们可以把 wheels 挂在 group 上，但这只是局部变量。
    // 解决方案：返回 group，并在 createCharacterMesh 中处理 userData.wheels
    // 但为了保持接口一致，我们在这里把 wheels 数组挂在 group.userData 上
    group.userData.wheels = [];
    const wheelGeo = new THREE.TorusGeometry(0.25, 0.05, 8, 16);
    
    const wheelLeft = new THREE.Mesh(wheelGeo, fireMat);
    wheelLeft.position.set(-0.3, 0.25, 0);
    wheelLeft.rotation.y = Math.PI / 2; 
    group.add(wheelLeft);
    group.userData.wheels.push(wheelLeft);

    const wheelRight = new THREE.Mesh(wheelGeo, fireMat);
    wheelRight.position.set(0.3, 0.25, 0);
    wheelRight.rotation.y = Math.PI / 2;
    group.add(wheelRight);
    group.userData.wheels.push(wheelRight);

    return group;
}

// 2. 孙悟空
function createWukong() {
    const group = new THREE.Group();

    const furMat = new THREE.MeshLambertMaterial({ color: 0x8D6E63 }); // 棕毛
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffccaa });
    const goldMat = new THREE.MeshPhongMaterial({ color: 0xffd700, shininess: 100 });
    const clothesMat = new THREE.MeshLambertMaterial({ color: 0xFFEB3B }); // 黄衣
    const redMat = new THREE.MeshLambertMaterial({ color: 0xd32f2f });

    // 头部
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.6;
    
    const headGeo = new THREE.SphereGeometry(0.4, 32, 32);
    const head = new THREE.Mesh(headGeo, furMat);
    headGroup.add(head);

    // 面部 (心形脸)
    const faceGeo = new THREE.SphereGeometry(0.3, 32, 32);
    const face = new THREE.Mesh(faceGeo, skinMat);
    face.position.set(0, 0, 0.15);
    face.scale.set(0.8, 0.8, 0.5);
    headGroup.add(face);

    // 金箍
    const hoopGeo = new THREE.TorusGeometry(0.38, 0.03, 8, 32);
    const hoop = new THREE.Mesh(hoopGeo, goldMat);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = 0.15;
    headGroup.add(hoop);

    group.add(headGroup);

    // 身体
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.8, 32);
    const body = new THREE.Mesh(bodyGeo, clothesMat);
    body.position.y = 0.9;
    group.add(body);

    // 虎皮裙 (简单用橙色带条纹代替)
    const skirtGeo = new THREE.CylinderGeometry(0.31, 0.35, 0.3, 32);
    const skirtMat = new THREE.MeshLambertMaterial({ color: 0xFF9800 });
    const skirt = new THREE.Mesh(skirtGeo, skirtMat);
    skirt.position.y = 0.6;
    group.add(skirt);

    // 金箍棒
    const stickGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8);
    const stick = new THREE.Mesh(stickGeo, redMat);
    stick.rotation.z = 0.5;
    stick.position.set(0.4, 1.2, 0);
    
    // 金箍棒两头金
    const capGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8);
    const capTop = new THREE.Mesh(capGeo, goldMat);
    capTop.position.y = 0.9;
    stick.add(capTop);
    const capBottom = new THREE.Mesh(capGeo, goldMat);
    capBottom.position.y = -0.9;
    stick.add(capBottom);

    group.add(stick);

    return group;
}

// 3. 猪八戒
function createBajie() {
    const group = new THREE.Group();

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xFFCDD2 }); // 粉色皮肤
    const blackMat = new THREE.MeshLambertMaterial({ color: 0x212121 }); // 黑衣
    const hatMat = new THREE.MeshLambertMaterial({ color: 0x424242 }); // 帽子
    const silverMat = new THREE.MeshPhongMaterial({ color: 0xCFD8DC, shininess: 80 });

    // 头部
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.6;

    const headGeo = new THREE.SphereGeometry(0.42, 32, 32);
    const head = new THREE.Mesh(headGeo, skinMat);
    headGroup.add(head);

    // 猪鼻子
    const noseGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.15, 16);
    const nose = new THREE.Mesh(noseGeo, skinMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0, 0.4);
    headGroup.add(nose);

    // 大耳朵
    const earGeo = new THREE.SphereGeometry(0.2, 32, 16);
    const earLeft = new THREE.Mesh(earGeo, skinMat);
    earLeft.position.set(-0.4, 0.1, 0);
    earLeft.scale.set(1, 1, 0.2);
    earLeft.rotation.y = -0.5;
    headGroup.add(earLeft);

    const earRight = new THREE.Mesh(earGeo, skinMat);
    earRight.position.set(0.4, 0.1, 0);
    earRight.scale.set(1, 1, 0.2);
    earRight.rotation.y = 0.5;
    headGroup.add(earRight);

    // 帽子
    const hatGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.2, 32);
    const hat = new THREE.Mesh(hatGeo, hatMat);
    hat.position.y = 0.35;
    headGroup.add(hat);

    group.add(headGroup);

    // 身体 (大肚腩)
    const bodyGeo = new THREE.SphereGeometry(0.45, 32, 32);
    const body = new THREE.Mesh(bodyGeo, blackMat);
    body.scale.y = 1.2;
    body.position.y = 0.8;
    group.add(body);

    // 九齿钉耙
    const rakeHandleGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.5, 8);
    const rakeHandle = new THREE.Mesh(rakeHandleGeo, blackMat);
    rakeHandle.position.set(0.5, 1.0, 0.2);
    rakeHandle.rotation.x = -0.3;

    const rakeHeadGeo = new THREE.BoxGeometry(0.6, 0.1, 0.1);
    const rakeHead = new THREE.Mesh(rakeHeadGeo, silverMat);
    rakeHead.position.y = 0.7;
    rakeHandle.add(rakeHead);

    // 钉齿
    for(let i=0; i<9; i++) {
        const toothGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.15, 4);
        const tooth = new THREE.Mesh(toothGeo, silverMat);
        tooth.position.set(-0.25 + i * 0.06, -0.1, 0);
        rakeHead.add(tooth);
    }

    group.add(rakeHandle);

    return group;
}

// 4. 绿巨人
function createHulk() {
    const group = new THREE.Group();

    const skinMat = new THREE.MeshLambertMaterial({ color: 0x43A047 }); // 绿色
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x673AB7 }); // 紫裤子
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x212121 });

    // 头部 (方形)
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.7;

    const headGeo = new THREE.BoxGeometry(0.6, 0.7, 0.6);
    const head = new THREE.Mesh(headGeo, skinMat);
    headGroup.add(head);

    // 头发
    const hairGeo = new THREE.BoxGeometry(0.62, 0.2, 0.62);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 0.36;
    headGroup.add(hair);

    group.add(headGroup);

    // 身体 (巨大)
    const bodyGeo = new THREE.BoxGeometry(1.0, 0.9, 0.6);
    const body = new THREE.Mesh(bodyGeo, skinMat);
    body.position.y = 1.0;
    group.add(body);

    // 裤子
    const pantsGeo = new THREE.BoxGeometry(1.02, 0.4, 0.62);
    const pants = new THREE.Mesh(pantsGeo, pantsMat);
    pants.position.y = 0.7; // 覆盖下半身
    group.add(pants);

    return group;
}

// 5. 美队
function createCaptain() {
    const group = new THREE.Group();

    const blueMat = new THREE.MeshLambertMaterial({ color: 0x1976D2 }); // 蓝
    const redMat = new THREE.MeshLambertMaterial({ color: 0xD32F2F }); // 红
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF }); // 白
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffccaa });

    // 头部
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.6;

    // 头盔
    const helmetGeo = new THREE.SphereGeometry(0.4, 32, 32);
    const helmet = new THREE.Mesh(helmetGeo, blueMat);
    headGroup.add(helmet);

    // 脸部露出来
    const faceGeo = new THREE.SphereGeometry(0.38, 32, 32);
    const face = new THREE.Mesh(faceGeo, skinMat);
    face.position.set(0, -0.1, 0.1);
    headGroup.add(face);

    // A字 (简单用白色小方块模拟)
    const aGeo = new THREE.BoxGeometry(0.1, 0.1, 0.02);
    const aMesh = new THREE.Mesh(aGeo, whiteMat);
    aMesh.position.set(0, 0.3, 0.38);
    headGroup.add(aMesh);

    group.add(headGroup);

    // 身体
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.8, 32);
    const body = new THREE.Mesh(bodyGeo, blueMat);
    body.position.y = 0.9;
    group.add(body);

    // 腹部红白条纹
    const stripesGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.3, 32);
    const stripes = new THREE.Mesh(stripesGeo, whiteMat); // 简略
    stripes.position.y = 0.8;
    // group.add(stripes); // 暂时简化

    // 盾牌
    const shieldGroup = new THREE.Group();
    shieldGroup.position.set(0, 1.0, -0.35); // 背在背上
    shieldGroup.rotation.y = Math.PI;

    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 16, 32), redMat);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 16, 32), whiteMat);
    const ring3 = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.05, 16, 32), blueMat);
    const star = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 5), whiteMat);
    star.rotation.x = Math.PI / 2;

    shieldGroup.add(ring1);
    shieldGroup.add(ring2);
    shieldGroup.add(ring3);
    shieldGroup.add(star);

    group.add(shieldGroup);

    return group;
}

// 6. 雷神
function createThor() {
    const group = new THREE.Group();

    const armorMat = new THREE.MeshPhongMaterial({ color: 0x263238, shininess: 50 }); // 黑甲
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffccaa });
    const hairMat = new THREE.MeshLambertMaterial({ color: 0xFFC107 }); // 金发
    const capeMat = new THREE.MeshLambertMaterial({ color: 0xB71C1C, side: THREE.DoubleSide }); // 红披风
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x90A4AE, roughness: 0.4, metalness: 0.8 });

    // 头部
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.6;

    const faceGeo = new THREE.SphereGeometry(0.4, 32, 32);
    const face = new THREE.Mesh(faceGeo, skinMat);
    headGroup.add(face);

    // 头发
    const hairGeo = new THREE.CylinderGeometry(0.42, 0.5, 0.5, 32, 1, false, 0, Math.PI * 2);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 0.1, 0.05);
    hair.scale.set(1, 1, 0.8);
    headGroup.add(hair);

    // 简易头盔翅膀
    const wingGeo = new THREE.BoxGeometry(0.1, 0.3, 0.05);
    const wingLeft = new THREE.Mesh(wingGeo, metalMat);
    wingLeft.position.set(-0.42, 0.2, 0);
    wingLeft.rotation.z = 0.5;
    headGroup.add(wingLeft);
    const wingRight = new THREE.Mesh(wingGeo, metalMat);
    wingRight.position.set(0.42, 0.2, 0);
    wingRight.rotation.z = -0.5;
    headGroup.add(wingRight);

    group.add(headGroup);

    // 身体
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.8, 32);
    const body = new THREE.Mesh(bodyGeo, armorMat);
    body.position.y = 0.9;
    group.add(body);

    // 披风
    const capeGeo = new THREE.PlaneGeometry(0.8, 1.2);
    const cape = new THREE.Mesh(capeGeo, capeMat);
    cape.position.set(0, 1.0, -0.3);
    cape.rotation.x = 0.2;
    group.add(cape);

    // 雷神之锤
    const hammerGroup = new THREE.Group();
    hammerGroup.position.set(0.5, 1.0, 0);
    
    const hammerHeadGeo = new THREE.BoxGeometry(0.25, 0.4, 0.25);
    const hammerHead = new THREE.Mesh(hammerHeadGeo, metalMat);
    hammerGroup.add(hammerHead);

    const handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5);
    const handle = new THREE.Mesh(handleGeo, new THREE.MeshLambertMaterial({color: 0x5D4037}));
    handle.position.y = -0.3;
    hammerGroup.add(handle);

    hammerGroup.rotation.z = -0.5;
    group.add(hammerGroup);

    return group;
}

// 7. DIY 自定义角色
function createCustomCharacter(colors = {}) {
    const group = new THREE.Group();
    
    // 默认颜色
    const headColor = colors.head || '#ffccaa';
    const bodyColor = colors.body || '#333333';
    const legsColor = colors.legs || '#1976D2';
    
    const headMat = new THREE.MeshLambertMaterial({ color: headColor });
    const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
    const legsMat = new THREE.MeshLambertMaterial({ color: legsColor });

    // 头部 (简单的圆头)
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.6;
    
    const headGeo = new THREE.SphereGeometry(0.4, 32, 32);
    const head = new THREE.Mesh(headGeo, headMat);
    headGroup.add(head);
    
    group.add(headGroup);

    // 身体
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.5, 32);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.05;
    group.add(body);
    
    // 腿部/下半身
    const legsGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.6, 32);
    const legs = new THREE.Mesh(legsGeo, legsMat);
    legs.position.y = 0.6;
    group.add(legs);

    return group;
}
