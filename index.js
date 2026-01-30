const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

const mc = require('minecraft-protocol');
const serverHost = 'oliver-guerrero.aternos.me';
const serverPort = 51021;
const botUsername = '.Spectator';
const reconnectInterval = 1 * 40 * 1000;

let bot = null;

// Servir archivos estáticos (incluye main.html)
app.use(express.static(__dirname));

// Página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'main.html'));
});

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
          bot.end();
          bot = null;
          console.log('Bot stopped.');
          io.emit('bot_status', 'Bot stopped.');
        }
        break;

      case 'reconnect':
        if (bot) {
          bot.end();
        }
        console.log('Reconnecting bot...');
        io.emit('bot_status', 'Reconnecting bot...');
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

// Crear bot
function createBot() {
  const bot = mc.createClient({
    host: serverHost,
    port: serverPort,
    username: botUsername,
  });

  bot.on('login', () => {
    console.log(`Bot ${bot.username} logged in!`);
    io.emit('bot_status', `Bot ${bot.username} logged in!`);
  });

  bot.on('end', () => {
    console.log(`Bot ${bot.username} disconnected. Reconnecting in ${reconnectInterval / 1000} seconds.`);
    io.emit('bot_status', `Bot disconnected. Reconnecting soon...`);
    handleDisconnection();
  });

  bot.on('error', (err) => {
    console.error(`Bot ${bot.username} encountered an error:`, err);
    handleDisconnection();
  });

  // Keep alive
  setInterval(() => {
    if (bot) {
      bot.write('keep_alive', { keepAliveId: 4337 });
    }
  }, 10000);

  return bot;
}

// Reconexión automática
function handleDisconnection() {
  bot = null;
  setTimeout(() => {
    if (!bot) {
      bot = createBot();
    }
  }, reconnectInterval);
}