/**
 * 场景初始化模块
 * 负责创建 Three.js 的核心组件：场景、相机、渲染器、灯光
 */
class SceneSetup {
    static init(config) {
        Logger.info("Engine", "开始初始化 3D 渲染引擎...");

        // 1. 创建场景
        Logger.info("Scene", "创建 Scene 对象", "Scene 是所有 3D 物体的容器，相当于一个空的宇宙。我们所有的游戏对象（方块、玩家、特效）都必须添加到 Scene 中才能被渲染。");
        const scene = new THREE.Scene();

        // 2. 创建相机
        Logger.info("Camera", "创建 OrthographicCamera (正交相机)", 
            "正交相机没有透视效果（即远处的物体不会变小）。在跳一跳这种需要精确判断距离的游戏中，使用正交相机可以避免透视畸变带来的误判，让玩家更容易对齐方块。");
        
        const aspect = window.innerWidth / window.innerHeight;
        const d = 18; 
        const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
        
        // 设置相机位置 (等轴测视角通常是 x,y,z 都在正方向)
        camera.position.set(20, 20, 20); 
        camera.lookAt(scene.position);
        Logger.success("Camera", `相机位置设定于 (${camera.position.x}, ${camera.position.y}, ${camera.position.z})，注视原点。`);

        // 3. 创建渲染器
        Logger.info("Renderer", "创建 WebGLRenderer", "WebGLRenderer 负责将 3D 场景计算并绘制到 HTML5 Canvas 上。我们开启了 antialias (抗锯齿) 让边缘更平滑，开启了 shadowMap 以支持阴影。");
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); 
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 性能优化
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap; 
        
        // 将 Canvas 添加到 DOM
        document.body.appendChild(renderer.domElement);

        // 4. 创建灯光
        Logger.info("Light", "设置光照系统", "没有光照，物体将是全黑的。我们需要环境光照亮暗部，平行光产生阴影。");
        
        // 环境光
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);
        
        // 半球光 (模拟天空和地面反射)
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
        hemiLight.position.set(0, 20, 0);
        scene.add(hemiLight);

        // 平行光 (模拟太阳，产生阴影)
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
        dirLight.position.set(10, 30, 20);
        dirLight.castShadow = true;
        
        // 阴影优化
        dirLight.shadow.mapSize.width = config.shadowMapSize || 1024;
        dirLight.shadow.mapSize.height = config.shadowMapSize || 1024;
        dirLight.shadow.camera.left = -config.shadowCameraSize || -10;
        dirLight.shadow.camera.right = config.shadowCameraSize || 10;
        dirLight.shadow.camera.top = config.shadowCameraSize || 10;
        dirLight.shadow.camera.bottom = -config.shadowCameraSize || -10;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 50;
        dirLight.shadow.bias = -0.0001;
        
        scene.add(dirLight);
        Logger.success("Light", "环境光、半球光、平行光已添加。");

        return { scene, camera, renderer, dirLight };
    }
}
window.SceneSetup = SceneSetup;
