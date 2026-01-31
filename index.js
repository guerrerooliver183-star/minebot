const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

const mineflayer = require('mineflayer');

const serverHost = 'oliver-guerrero.aternos.me';
const serverPort = 51021;
const botUsername = '.Spectator';
const reconnectInterval = 1 * 60 * 1000; // 🔹 60 segundos, reconexión más segura

let bot = null;
let moveInterval = null;

// Servir archivos estáticos (incluye main.html)
app.use(express.static(__dirname));

// Página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'main.html'));
});

// Endpoint para UptimeRobot
app.get('/ping', (req, res) => res.send('pong'));

// WebSockets
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('control_bot', (command) => {
    switch (command) {
      case 'start':
        if (!bot) {
          bot = createBot();
        }
        break;

      case 'stop':
        if (bot) {
          clearMovement();
          bot.end();
          bot = null;
          console.log('Bot stopped.');
          io.emit('bot_status', 'Bot stopped.');
        }
        break;

      case 'reconnect':
        console.log('Reconnecting bot...');
        io.emit('bot_status', 'Reconnecting bot...');
        clearMovement();
        if (bot) bot.end();
        setTimeout(() => {
          bot = createBot();
        }, 1000);
        break;

      default:
        console.log('Unknown command.');
        break;
    }
  });
});

// Render necesita un puerto dinámico
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Servidor funcionando en el puerto ${PORT}`);
});

// Crear bot con Mineflayer (configuración crítica corregida)
function createBot() {
  bot = mineflayer.createBot({
    host: serverHost,
    port: serverPort,
    username: botUsername,
    version: "1.21.1",  // 🔹 versión real del protocolo PaperMC 1.21.11
    onlineMode: false,   // 🔹 cracked
    family: 4            // 🔹 fuerza IPv4 para Aternos
  });

  bot.on('login', () => {
    console.log(`Bot ${bot.username} logged in!`);
    io.emit('bot_status', `Bot ${bot.username} logged in!`);
  });

  bot.on('spawn', () => {
    console.log(`Bot ${bot.username} spawned!`);
    io.emit('bot_status', `Bot ${bot.username} spawned!`);

    // Movimiento aleatorio cada 8 segundos
    clearMovement();
    moveInterval = setInterval(() => {
      if (!bot) return;

      const yaw = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * Math.PI / 2;
      bot.look(yaw, pitch, true);

      const moves = ['forward', 'back', 'left', 'right', 'jump'];
      const move = moves[Math.floor(Math.random() * moves.length)];

      bot.setControlState(move, true);
      setTimeout(() => {
        if (bot) bot.setControlState(move, false);
      }, 500);
    }, 8000);
  });

  bot.on('end', () => {
    console.log(`Bot ${bot.username} disconnected. Reconnecting in ${reconnectInterval / 1000} seconds.`);
    io.emit('bot_status', `Bot disconnected. Reconnecting soon...`);
    handleDisconnection();
  });

  bot.on('error', (err) => {
    console.error(`Bot ${bot.username} encountered an error:`, err);
    io.emit('bot_status', `Bot error: ${err.message}`);
    handleDisconnection();
  });

  return bot;
}

// Limpiar intervalo de movimiento
function clearMovement() {
  if (moveInterval) {
    clearInterval(moveInterval);
    moveInterval = null;
  }
}

// Reconexión automática
function handleDisconnection() {
  clearMovement();
  bot = null;
  setTimeout(() => {
    if (!bot) {
      bot = createBot();
    }
  }, reconnectInterval);
}