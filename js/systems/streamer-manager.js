/**
 * 主播模式管理器
 * 处理直播互动逻辑，连接 UI 和 游戏行为
 */
class StreamerManager {
    /**
     * @param {Object} gameContext - 游戏上下文，包含 player, score 等引用或修改方法
     * @param {UIManager} uiManager
     * @param {AudienceSystem} audienceSystem
     */
    constructor(gameContext, uiManager, audienceSystem) {
        this.game = gameContext; // 这里的 gameContext 需要包含 revivePlayer, addScore, setBuff 等方法
        this.ui = uiManager;
        this.audience = audienceSystem;
    }

    init() {
        Logger.info("System", "初始化主播模式", "开启自动演示和直播互动监听。");
        
        // 隐藏不必要的 UI
        document.getElementById('login-modal').style.display = 'none';
        document.body.classList.add('streamer-mode');
        
        // 启动模拟器
        this.ui.initLiveSimulator(
            this.onComment.bind(this),
            this.onGift.bind(this),
            this.onLike.bind(this)
        );
    }

    onComment(user, content) {
        console.log(`[直播弹幕] ${user}: ${content}`);
        this.ui.showToast(`${user}: ${content}`);
        
        // 关键词触发生成观众
        if (content.includes('加入') || content.includes('1')) {
            // 需要获取当前 player 位置，这里假设 gameContext 提供
            const playerPos = this.game.getPlayerPosition();
            if (playerPos) {
                this.audience.spawn(user, playerPos);
            }
        }
    }

    onLike(user) {
        this.ui.likeCount++;
        // 触发点赞特效（这里可能需要调用全局或 Game 的特效方法，暂略，或通过 gameContext 调用）
        if (this.game.spawnHeartEffect) {
            this.game.spawnHeartEffect(true);
        }
        
        if (this.ui.likeCount % 10 === 0) {
            this.game.setNextBlockBuff('large');
            this.ui.showFloatingText('点赞助力! 下个方块变大', 0x67C23A);
        }
    }

    onGift(user, type) {
        Logger.info("Interaction", `收到礼物: ${type}`, "根据礼物类型触发不同的游戏内增益或减益效果。");
        
        let icon = '🎁';
        if (type === 'heart') icon = '❤️';
        else if (type === 'rocket') icon = '🚀';
        else if (type === 'bomb') icon = '💣';
        
        this.ui.showToast(`${user} 送出了 ${icon}!`);
        
        if (type === 'rocket') {
            if (this.game.triggerFireworks) this.game.triggerFireworks();
            
            if (this.game.isWaitingRevive()) {
                this.game.revivePlayer();
            } else {
                 this.game.addScore(50);
                 this.game.showFloatingScore(50);
            }
        } else if (type === 'bomb') {
            this.game.setNextBlockBuff('small');
            this.ui.showFloatingText('小心! 捣蛋鬼出没', 0xF56C6C);
        } else {
            if (this.game.spawnHeartEffect) this.game.spawnHeartEffect();
            this.game.addScore(5);
        }
    }
}
window.StreamerManager = StreamerManager;
