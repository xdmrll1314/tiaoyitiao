const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

// 托管静态文件
app.use(express.static(path.join(__dirname, '/')));

// 玩家数据存储
let players = {};
// 历史最高分榜单
let highScores = [];
const HIGH_SCORES_FILE = path.join(__dirname, 'highscores.json');

// 加载历史最高分
function loadHighScores() {
    try {
        if (fs.existsSync(HIGH_SCORES_FILE)) {
            const data = fs.readFileSync(HIGH_SCORES_FILE, 'utf8');
            highScores = JSON.parse(data);
        }
    } catch (err) {
        console.error('Failed to load high scores:', err);
        highScores = [];
    }
}

// 保存历史最高分
function saveHighScores() {
    try {
        fs.writeFileSync(HIGH_SCORES_FILE, JSON.stringify(highScores, null, 2));
    } catch (err) {
        console.error('Failed to save high scores:', err);
    }
}

// 初始化加载
loadHighScores();

// 更新最高分榜单
function updateHighScores(nickname, score) {
    // 检查是否能进入榜单 (前100名)
    // 或者该用户是否刷新了自己的记录？
    // 这里采用简单策略：记录单次最高分。如果同一个用户多次上榜，会占据多个位置吗？
    // 通常榜单应该每个用户只占一个位置（最高分）。
    
    // 查找该用户是否已在榜单中
    const existingEntryIndex = highScores.findIndex(entry => entry.nickname === nickname);
    
    if (existingEntryIndex !== -1) {
        // 如果新分数更高，则更新
        if (score > highScores[existingEntryIndex].score) {
            highScores[existingEntryIndex].score = score;
            highScores[existingEntryIndex].date = Date.now();
        } else {
            return false; // 没有刷新记录
        }
    } else {
        // 新用户
        highScores.push({ nickname, score, date: Date.now() });
    }
    
    // 排序并截取前 50 名
    highScores.sort((a, b) => b.score - a.score);
    if (highScores.length > 50) {
        highScores = highScores.slice(0, 50);
    }
    
    saveHighScores();
    return true;
}

// 工具函数：清理和验证昵称
function sanitizeNickname(nickname) {
    if (!nickname || typeof nickname !== 'string') {
        return null;
    }
    // 移除 HTML 标签和特殊字符，只保留中文、英文、数字和常见符号
    let cleaned = nickname.trim()
        .replace(/<[^>]*>/g, '') // 移除 HTML 标签
        .replace(/[<>\"'&]/g, '') // 移除危险字符
        .substring(0, 12); // 限制长度
    
    // 如果清理后为空，返回 null
    return cleaned.length > 0 ? cleaned : null;
}

// 频率限制：每个玩家的最后更新时间
const playerLastUpdate = {};
const MOVEMENT_THROTTLE_MS = 50; // 位置更新最小间隔 50ms (20fps)
const SCORE_THROTTLE_MS = 100; // 分数更新最小间隔 100ms

// 防刷分：记录玩家分数变化历史
const scoreHistory = {};
const MAX_SCORE_INCREASE = 1000; // 单次最大分数增长
const SCORE_HISTORY_WINDOW = 5000; // 5秒窗口

io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id);

    // 创建新玩家数据
    players[socket.id] = {
        id: socket.id,
        x: 0,
        y: 1,
        z: 0,
        rotationY: 0,
        score: 0,
        nickname: 'Unknown', // 默认昵称
        color: Math.random() * 0xffffff
    };

    // 监听设置昵称
    socket.on('setNickname', (nickname) => {
        if (players[socket.id]) {
            const sanitized = sanitizeNickname(nickname);
            if (sanitized) {
                players[socket.id].nickname = sanitized;
            } else {
                // 如果昵称无效，使用默认昵称
                players[socket.id].nickname = `Player ${socket.id.substr(0, 4)}`;
            }
            
            // 广播玩家信息更新 (包含昵称)
            io.emit('playerInfoUpdate', players[socket.id]);
            io.emit('leaderboardUpdate', getLeaderboard());
        }
    });

    // 发送当前所有在线玩家信息给新连接的客户端
    socket.emit('currentPlayers', players);
    // 发送历史最高分榜单
    socket.emit('highScoresUpdate', highScores);

    // 通知其他客户端有新玩家加入
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // 监听进入观战模式
    socket.on('joinSpectator', () => {
        if (players[socket.id]) {
            players[socket.id].isSpectator = true;
            players[socket.id].nickname = 'Spectator'; // 默认观战昵称
            // 广播玩家信息更新 (客户端收到后应移除该玩家实体)
            io.emit('playerInfoUpdate', players[socket.id]);
            io.emit('leaderboardUpdate', getLeaderboard());
        }
    });

    // 监听玩家移动/状态更新
    socket.on('playerMovement', (movementData) => {
        if (!players[socket.id] || players[socket.id].isSpectator) return;
        
        // 频率限制检查
        const now = Date.now();
        const lastUpdate = playerLastUpdate[socket.id]?.movement || 0;
        if (now - lastUpdate < MOVEMENT_THROTTLE_MS) {
            return; // 忽略过于频繁的更新
        }
        playerLastUpdate[socket.id] = playerLastUpdate[socket.id] || {};
        playerLastUpdate[socket.id].movement = now;
        
        // 基本数据验证
        if (typeof movementData.x !== 'number' || typeof movementData.y !== 'number' || 
            typeof movementData.z !== 'number' || typeof movementData.rotationY !== 'number') {
            return; // 忽略无效数据
        }
        
        // 位置合理性检查（防止异常跳跃）
        const oldPos = players[socket.id];
        const dx = Math.abs(movementData.x - oldPos.x);
        const dy = Math.abs(movementData.y - oldPos.y);
        const dz = Math.abs(movementData.z - oldPos.z);
        const maxDistance = 10; // 单次最大移动距离
        
        if (dx > maxDistance || dz > maxDistance || dy > maxDistance) {
            console.warn(`Player ${socket.id} moved too far: dx=${dx}, dy=${dy}, dz=${dz}`);
            return; // 忽略异常移动
        }
        
        players[socket.id].x = movementData.x;
        players[socket.id].y = movementData.y;
        players[socket.id].z = movementData.z;
        players[socket.id].rotationY = movementData.rotationY;
        
        // 广播位置更新
        socket.broadcast.emit('playerMoved', players[socket.id]);
    });

    // 监听分数更新
    socket.on('scoreUpdate', (score) => {
        if (!players[socket.id] || players[socket.id].isSpectator) return;
        
        // 频率限制检查
        const now = Date.now();
        const lastUpdate = playerLastUpdate[socket.id]?.score || 0;
        if (now - lastUpdate < SCORE_THROTTLE_MS) {
            return; // 忽略过于频繁的更新
        }
        playerLastUpdate[socket.id] = playerLastUpdate[socket.id] || {};
        playerLastUpdate[socket.id].score = now;
        
        // 数据验证
        if (typeof score !== 'number' || score < 0 || !isFinite(score)) {
            return; // 忽略无效分数
        }
        
        const oldScore = players[socket.id].score;
        const scoreIncrease = score - oldScore;
        
        // 防刷分检查
        if (scoreIncrease > MAX_SCORE_INCREASE) {
            console.warn(`Player ${socket.id} score increase too large: ${scoreIncrease}`);
            return; // 忽略异常分数增长
        }
        
        // 记录分数历史用于进一步分析
        if (!scoreHistory[socket.id]) {
            scoreHistory[socket.id] = [];
        }
        scoreHistory[socket.id].push({ score, timestamp: now });
        
        // 清理过期历史（5秒前的记录）
        scoreHistory[socket.id] = scoreHistory[socket.id].filter(
            entry => now - entry.timestamp < SCORE_HISTORY_WINDOW
        );
        
        // 检查短时间内分数增长是否异常
        const recentScores = scoreHistory[socket.id];
        if (recentScores.length > 1) {
            const totalIncrease = recentScores[recentScores.length - 1].score - recentScores[0].score;
            const timeSpan = now - recentScores[0].timestamp;
            const maxIncreasePerSecond = 500; // 每秒最大分数增长
            
            if (timeSpan > 0 && (totalIncrease / (timeSpan / 1000)) > maxIncreasePerSecond) {
                console.warn(`Player ${socket.id} score growth rate too high`);
                return; // 忽略异常增长速率
            }
        }
        
        players[socket.id].score = score;
        // 广播最新的排行榜数据
        io.emit('leaderboardUpdate', getLeaderboard());
    });

    // 监听游戏结束提交分数
    socket.on('submitResult', (score) => {
        if (!players[socket.id] || players[socket.id].isSpectator) return;
        
        // 简单验证
        if (typeof score !== 'number' || score < 0) return;
        
        // 允许一定的误差，但主要以客户端提交为准（为了简单）。
        // 严格来说应该以服务端记录的 players[socket.id].score 为准。
        // 我们这里取两者较大值，或者直接信任服务端记录的当前分数？
        // 有时候客户端结算可能比服务端更新快（或者慢），为了防止作弊，
        // 我们应该检查 score 是否与 players[socket.id].score 接近。
        // 但考虑到网络延迟，直接使用 players[socket.id].score 可能更安全。
        // 不过，客户端可能在最后一步跳跃后立即 GameOver，而 movement/scoreUpdate 还没到。
        // 这里为了简化，我们信任 socket.id 对应的当前服务端记录的分数作为基准，
        // 如果客户端提交的 score 和服务端记录的差异不大，就记录。
        // 或者更简单的：直接使用服务端记录的当前分数作为最终成绩。
        
        const finalScore = players[socket.id].score;
        const nickname = players[socket.id].nickname;
        
        if (updateHighScores(nickname, finalScore)) {
            // 如果榜单更新了，广播给所有人
            io.emit('highScoresUpdate', highScores);
        }
    });

    // 监听断开连接
    socket.on('disconnect', () => {
        console.log('User disconnected: ' + socket.id);
        delete players[socket.id];
        delete playerLastUpdate[socket.id];
        delete scoreHistory[socket.id];
        io.emit('playerDisconnected', socket.id);
        io.emit('leaderboardUpdate', getLeaderboard());
    });
});

// 获取排行榜数据 (按分数降序)
function getLeaderboard() {
    return Object.values(players)
        .filter(p => !p.isSpectator)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10); // 只取前10名
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
