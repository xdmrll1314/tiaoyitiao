// 资源管理器
const ResourceManager = {
    geometries: {},
    materials: {},
    textures: {},
    init: function() {
        Logger.info("Resource", "📦 初始化资源管理器", "预创建几何体和材质，减少运行时GC压力");
        this.geometries.box = new THREE.BoxGeometry(config.cubeSize.width, config.cubeSize.height, config.cubeSize.depth);
        this.geometries.center = new THREE.CylinderGeometry(0.8, 0.8, 0.1, 32);
        this.geometries.particle = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        
        this.materials.center = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
        this.materials.particle = new THREE.MeshBasicMaterial({ color: 0xffffff }); 
        
        // 生成程序化纹理
        this.textures.wood = this.createWoodTexture();
        this.textures.stone = this.createStoneTexture();
        this.textures.grid = this.createGridTexture();
    },
    getColoredMaterial: function(colorHex) {
        if (!this.materials[colorHex]) {
            this.materials[colorHex] = new THREE.MeshLambertMaterial({ color: colorHex });
        }
        return this.materials[colorHex];
    },
    getTexturedMaterial: function(type, colorHex) {
        const key = type + '_' + colorHex;
        if (!this.materials[key]) {
            const texture = this.textures[type];
            this.materials[key] = new THREE.MeshLambertMaterial({ 
                color: colorHex,
                map: texture
            });
        }
        return this.materials[key];
    },
    createWoodTexture: function() {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0,0,64,64);
        ctx.fillStyle = '#e0e0e0';
        for(let i=0; i<8; i++) {
            ctx.fillRect(0, i*8, 64, 4);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    },
    createStoneTexture: function() {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0,0,64,64);
        for(let i=0; i<50; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#eeeeee' : '#dddddd';
            const x = Math.random() * 64;
            const y = Math.random() * 64;
            const s = Math.random() * 10 + 2;
            ctx.fillRect(x, y, s, s);
        }
        return new THREE.CanvasTexture(canvas);
    },
    createGridTexture: function() {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0,0,64,64);
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 2;
        ctx.strokeRect(0,0,64,64);
        return new THREE.CanvasTexture(canvas);
    }
};
