const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// 托管静态文件
app.use(express.static(path.join(__dirname, '/')));

// 玩家数据存储
let players = {};

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
        // 随机分配一个颜色，用于区分不同玩家
        color: Math.random() * 0xffffff
    };

    // 发送当前所有在线玩家信息给新连接的客户端
    socket.emit('currentPlayers', players);

    // 通知其他客户端有新玩家加入
    socket.broadcast.emit('newPlayer', players[socket.id]);

    // 监听玩家移动/状态更新
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            players[socket.id].rotationY = movementData.rotationY;
            
            // 广播位置更新
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    // 监听分数更新
    socket.on('scoreUpdate', (score) => {
        if (players[socket.id]) {
            players[socket.id].score = score;
            // 广播最新的排行榜数据
            io.emit('leaderboardUpdate', getLeaderboard());
        }
    });

    // 监听断开连接
    socket.on('disconnect', () => {
        console.log('User disconnected: ' + socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
        io.emit('leaderboardUpdate', getLeaderboard());
    });
});

// 获取排行榜数据 (按分数降序)
function getLeaderboard() {
    return Object.values(players)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10); // 只取前10名
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
