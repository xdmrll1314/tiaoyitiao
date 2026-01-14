/**
 * UI 管理器
 * 负责处理非核心游戏逻辑的界面显示，如弹幕、提示、直播模拟器等
 */
class UIManager {
    constructor() {
        this.likeCount = 0;
    }

    /**
     * 初始化直播模拟器 UI
     * @param {Function} onCommentCallback - 发送弹幕时的回调
     * @param {Function} onGiftCallback - 送礼物时的回调
     * @param {Function} onLikeCallback - 点赞时的回调
     */
    initLiveSimulator(onCommentCallback, onGiftCallback, onLikeCallback) {
        Logger.info("UI", "初始化直播模拟器界面", "创建 DOM 元素来模拟直播平台的互动层。");

        const simDiv = document.createElement('div');
        Object.assign(simDiv.style, {
            position: 'absolute', bottom: '10px', right: '10px',
            background: 'rgba(0,0,0,0.7)', padding: '10px',
            borderRadius: '8px', color: '#fff', zIndex: '100',
            display: 'flex', flexDirection: 'column', gap: '5px'
        });
        
        simDiv.innerHTML = `
            <div style="font-weight:bold;margin-bottom:5px;">直播互动模拟器</div>
            <div style="display:flex;gap:5px;">
                <input type="text" id="sim-user" placeholder="用户名" style="width:60px;padding:3px;">
                <input type="text" id="sim-content" placeholder="弹幕内容" style="width:100px;padding:3px;">
                <button id="sim-send-chat" style="padding:3px 8px;">发送弹幕</button>
            </div>
            <div style="display:flex;gap:5px;">
                 <button id="sim-gift-1" style="flex:1;padding:3px;">送爱心</button>
                 <button id="sim-gift-2" style="flex:1;padding:3px;">送火箭</button>
            </div>
        `;
        
        document.body.appendChild(simDiv);
        
        // 绑定事件
        document.getElementById('sim-send-chat').addEventListener('click', () => {
            const user = document.getElementById('sim-user').value || '观众' + Math.floor(Math.random()*100);
            const content = document.getElementById('sim-content').value || '加入';
            if(onCommentCallback) onCommentCallback(user, content);
        });
        
        document.getElementById('sim-gift-1').addEventListener('click', () => {
            const user = document.getElementById('sim-user').value || '老板';
            if(onGiftCallback) onGiftCallback(user, 'heart');
        });

        document.getElementById('sim-gift-2').addEventListener('click', () => {
            const user = document.getElementById('sim-user').value || '土豪';
            if(onGiftCallback) onGiftCallback(user, 'rocket');
        });

        const likeBtn = document.createElement('button');
        likeBtn.innerText = '模拟点赞';
        likeBtn.onclick = () => {
            const user = '观众' + Math.floor(Math.random()*100);
            if(onLikeCallback) onLikeCallback(user);
        };
        simDiv.appendChild(likeBtn);

        const bombBtn = document.createElement('button');
        bombBtn.innerText = '模拟炸弹';
        bombBtn.onclick = () => {
             if(onGiftCallback) onGiftCallback('捣蛋鬼', 'bomb');
        };
        simDiv.appendChild(bombBtn);

        const bananaBtn = document.createElement('button');
        bananaBtn.innerText = '模拟香蕉';
        bananaBtn.onclick = () => {
             if(onGiftCallback) onGiftCallback('捣蛋鬼', 'banana');
        };
        simDiv.appendChild(bananaBtn);
    }

    /**
     * 显示浮动提示文本
     */
    showFloatingText(text, colorHex) {
        Logger.info("UI", `显示浮动文本: ${text}`, "创建一个绝对定位的 DOM 元素并应用 CSS 动画使其上浮消失。");
        
        const div = document.createElement('div');
        div.innerText = text;
        Object.assign(div.style, {
            position: 'absolute', top: '30%', left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#' + colorHex.toString(16),
            fontSize: '24px', fontWeight: 'bold',
            textShadow: '0 0 5px black', pointerEvents: 'none',
            animation: 'floatUpFade 1.5s forwards'
        });
        document.body.appendChild(div);
        
        // 动态添加 CSS 动画
        if (!document.getElementById('float-anim-style')) {
            const style = document.createElement('style');
            style.id = 'float-anim-style';
            style.innerHTML = `
                @keyframes floatUpFade {
                    0% { opacity: 0; transform: translate(-50%, 0) scale(0.5); }
                    20% { opacity: 1; transform: translate(-50%, -20px) scale(1.2); }
                    100% { opacity: 0; transform: translate(-50%, -80px) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => {
            if (div.parentNode) div.parentNode.removeChild(div);
        }, 1500);
    }

    /**
     * 显示 Toast 消息
     */
    showToast(msg) {
        const toast = document.createElement('div');
        toast.innerText = msg;
        Object.assign(toast.style, {
            position: 'absolute', top: '20%', left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)', color: '#fff',
            padding: '10px 20px', borderRadius: '20px',
            animation: 'floatUp 2s forwards', pointerEvents: 'none'
        });
        
        if (!document.getElementById('toast-style')) {
            const style = document.createElement('style');
            style.id = 'toast-style';
            style.innerHTML = `
                @keyframes floatUp {
                    0% { opacity: 0; transform: translate(-50%, 20px); }
                    10% { opacity: 1; transform: translate(-50%, 0); }
                    80% { opacity: 1; transform: translate(-50%, 0); }
                    100% { opacity: 0; transform: translate(-50%, -20px); }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 2000);
    }
}

window.UIManager = UIManager;
