// 漂浮云朵
class CloudSystem {
    constructor(scene) {
        Logger.info("Environment", "☁️ 初始化云层系统", "动态背景元素增加场景深度感");
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
