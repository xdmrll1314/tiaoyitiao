// 粒子系统
class ParticleSystem {
    constructor(scene) {
        Logger.info("Visual", "✨ 初始化粒子系统", "粒子系统用于实现跳跃尾迹和落地特效");
        this.scene = scene;
        this.particles = [];
    }
    
    emit(position, color, count = 20) {
        // Logger.info("Visual", "发射粒子", "使用对象池技术复用粒子网格(TODO)");
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
