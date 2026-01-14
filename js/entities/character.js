// 统一的角色创建函数
function createCharacterMesh(isLocal) {
    Logger.info("Entity", `👤 创建${isLocal ? "本地" : "远程"}角色模型`, "组合式建模：头部+身体+装饰物");
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
