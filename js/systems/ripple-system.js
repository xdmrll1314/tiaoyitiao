// 波纹特效
class RippleSystem {
    constructor(scene) {
        Logger.info("Visual", "🌊 初始化波纹系统", "落地时的反馈动画");
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
