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
    particlesCount: 20,
    // 网络同步配置
    movementEmitInterval: 50, // 位置更新发送间隔（毫秒）
    // 阴影配置
    shadowMapSize: 1024,
    shadowCameraSize: 15,
    guideStorageKey: 'jump-guide-seen',
    audioStorageKey: 'jump-audio-enabled'
};
