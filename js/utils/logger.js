/**
 * 游戏日志系统
 * 用于展示详细的游戏开发理论和运行状态
 * 帮助用户理解每一步代码背后的原理
 */
class Logger {
    /**
     * 输出普通信息和理论说明
     * @param {string} module - 模块名称 (如 'Physics', 'Renderer')
     * @param {string} message - 当前操作的描述
     * @param {string} [theory] - (可选) 相关的游戏开发理论知识
     */
    static info(module, message, theory = "") {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`%c[${timestamp}] [${module}] ℹ️ ${message}`, 'color: #3498db; font-weight: bold;');
        if (theory) {
            console.log(`%c   ↳ 💡 理论: ${theory}`, 'color: #9b59b6; font-style: italic;');
        }
    }

    /**
     * 输出成功信息
     */
    static success(module, message) {
        console.log(`%c[${module}] ✅ ${message}`, 'color: #2ecc71; font-weight: bold;');
    }

    /**
     * 输出警告信息
     */
    static warn(module, message) {
        console.warn(`[${module}] ⚠️ ${message}`);
    }

    /**
     * 输出错误信息
     */
    static error(module, message) {
        console.error(`[${module}] ❌ ${message}`);
    }
}

// 暴露给全局，方便在任何地方调用
window.Logger = Logger;
