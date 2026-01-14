/**
 * 观众系统
 * 负责在场景中生成代表观众的小人，并管理它们的动画
 */
class AudienceSystem {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.activeAnimations = [];
    }

    /**
     * 在主角附近生成观众
     * @param {string} name - 观众名字
     * @param {THREE.Vector3} playerPos - 主角当前位置
     */
    spawn(name, playerPos) {
        if (!playerPos) return;

        Logger.info("Entities", `生成观众角色: ${name}`, "在主角周围随机位置生成一个简单的 3D 模型代表观众。");
        
        const color = Math.random() * 0xffffff;
        // 简单几何体代替复杂模型以节省性能
        const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const material = new THREE.MeshLambertMaterial({ color: color });
        const mesh = new THREE.Mesh(geometry, material);
        
        // 随机位置（在主角周围）
        const offsetAngle = Math.random() * Math.PI * 2;
        const distance = 3 + Math.random() * 3;
        mesh.position.x = playerPos.x + Math.cos(offsetAngle) * distance;
        mesh.position.z = playerPos.z + Math.sin(offsetAngle) * distance;
        mesh.position.y = 10; // 从天而降
        
        this.scene.add(mesh);
        
        // 创建动画状态对象
        const anim = {
            mesh: mesh,
            velocity: 0,
            y: 10,
            targetY: 0.4, // 地面高度
            time: 0,
            duration: 200, // 存活时间
            isDead: false
        };

        // 创建名字标签
        const label = this.createLabel(name);
        
        // 将动画逻辑封装进闭包或对象
        this.activeAnimations.push({
            data: anim,
            label: label,
            update: () => {
                // 物理模拟：重力与弹跳
                if (mesh.position.y > anim.targetY) {
                    anim.velocity -= 0.05; // 重力
                    mesh.position.y += anim.velocity;
                } else {
                    // 落地反弹
                    if (anim.velocity < -0.1) {
                        anim.velocity = -anim.velocity * 0.5; // 能量损耗
                        mesh.position.y = anim.targetY + 0.1;
                    } else {
                        mesh.position.y = anim.targetY;
                        // 随机小跳跃
                        if (Math.random() < 0.02) {
                            anim.velocity = 0.5;
                        }
                    }
                }
                
                // 自身旋转
                mesh.rotation.y += 0.05;
                
                // 生命周期管理
                anim.time++;
                if (anim.time > anim.duration) {
                    mesh.scale.multiplyScalar(0.9); // 缩小消失
                    if (mesh.scale.x < 0.1) {
                        this.scene.remove(mesh);
                        if(label && label.parentNode) label.parentNode.removeChild(label);
                        anim.isDead = true;
                        return true; // 动画结束
                    }
                }

                // 更新标签位置
                this.updateLabel(label, mesh);
                return false;
            }
        });
    }

    createLabel(name) {
        const label = document.createElement('div');
        label.className = 'player-name-tag';
        label.innerText = name;
        Object.assign(label.style, {
            fontSize: '12px', padding: '2px 6px',
            position: 'absolute', display: 'none' // 初始隐藏，update里显示
        });
        document.body.appendChild(label);
        return label;
    }

    updateLabel(label, mesh) {
        if (!label || !mesh) return;
        
        const tempV = mesh.position.clone();
        tempV.y += 1.5;
        // 将 3D 坐标投影到 2D 屏幕坐标
        tempV.project(this.camera);
        
        const x = (tempV.x * .5 + .5) * window.innerWidth;
        const y = (-(tempV.y * .5) + .5) * window.innerHeight;
        
        label.style.left = `${x}px`;
        label.style.top = `${y}px`;
        // 如果在相机背后则隐藏
        label.style.display = (Math.abs(tempV.z) > 1) ? 'none' : 'block';
    }

    update() {
        // 过滤掉已结束的动画
        this.activeAnimations = this.activeAnimations.filter(animObj => {
            const finished = animObj.update();
            return !finished;
        });
    }
}

window.AudienceSystem = AudienceSystem;
