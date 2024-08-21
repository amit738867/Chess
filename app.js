// Server-side JavaScript

require('dotenv').config();

const express = require('express');
const socket = require('socket.io');
const http = require('http');
const { Chess } = require('chess.js');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socket(server);

const PORT = process.env.PORT || 8000;

const games = {};
let playerQueue = [];

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index');
});

function createGame(player1, player2) {
    const gameId = `${player1.id}-${player2.id}`;
    games[gameId] = new Chess();

    const colors = Math.random() < 0.5 ? ['w', 'b'] : ['b', 'w'];
    player1.emit('playerRole', { color: colors[0], gameId });
    player2.emit('playerRole', { color: colors[1], gameId });

    player1.join(gameId);
    player2.join(gameId);

    games[gameId].players = {
        white: colors[0] === 'w' ? player1.id : player2.id,
        black: colors[0] === 'w' ? player2.id : player1.id
    };

    console.log(`New game created: ${gameId}`);
}

function pairPlayers() {
    while (playerQueue.length >= 2) {
        const player1 = playerQueue.shift();
        const player2 = playerQueue.shift();
        createGame(player1, player2);
    }
}

io.on('connection', (uniquesocket) => {
    console.log('Connected:', uniquesocket.id);

    playerQueue.push(uniquesocket);
    uniquesocket.emit('waiting', 'Waiting for an opponent...');
    pairPlayers();

    uniquesocket.on('disconnect', () => {
        console.log('Disconnected:', uniquesocket.id);
        playerQueue = playerQueue.filter(player => player !== uniquesocket);

        for (const gameId in games) {
            const game = games[gameId];
            if (game.players.white === uniquesocket.id || game.players.black === uniquesocket.id) {
                const opponent = io.sockets.sockets.get(game.players.white === uniquesocket.id ? game.players.black : game.players.white);
                if (opponent) {
                    opponent.emit('opponentDisconnected');
                    playerQueue.push(opponent);
                }
                delete games[gameId];
                pairPlayers();
                break;
            }
        }
    });

    uniquesocket.on('move', ({ move, gameId }) => {
        const game = games[gameId];
        if (!game) return;

        console.log(`Received move: ${JSON.stringify(move)}`);

        try {
            if (game.turn() === 'w' && uniquesocket.id !== game.players.white) return;
            if (game.turn() === 'b' && uniquesocket.id !== game.players.black) return;

            const result = game.move(move);
            if (result) {
                io.to(gameId).emit('move', move);
                io.to(gameId).emit('boardState', game.fen());
            } else {
                console.log('Invalid move:', move);
                uniquesocket.emit('invalidMove', move);
            }
        } catch (error) {
            console.log('Error processing move:', error);
            uniquesocket.emit('invalidMove', move);
        }
    });
});

server.listen(PORT, () => console.log(`Server is started at http://localhost:${PORT}/`));
