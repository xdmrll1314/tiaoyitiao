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
