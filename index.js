// ---------------------------
// SERVIDOR WEB PARA RENDER
// ---------------------------
const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const path = require("path");

const mineflayer = require('mineflayer');
const pvp = require('mineflayer-pvp').plugin;
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const armorManager = require('mineflayer-armor-manager');
const AutoAuth = require('mineflayer-auto-auth');

// ---------------------------
// CONFIGURACIÓN DEL BOT
// ---------------------------
const serverHost = "oliver-guerrero.aternos.me";
const serverPort = 56096;
const botUsername = ".Spectator";
const autoAuthPassword = "bot112022";
const reconnectDelay = 10000; // 10 segundos

let bot = null;

// ---------------------------
// SERVIR ARCHIVOS ESTÁTICOS
// ---------------------------
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "main.html"));
});

// ---------------------------
// ENVIAR LOGS AL HTML
// ---------------------------
function sendLog(msg) {
  console.log(msg);
  io.emit("bot_status", msg); // Esto actualiza el <h2 id="botStatus">
}

// ---------------------------
// SOCKET.IO (control desde botones)
io.on("connection", (socket) => {
  sendLog("Usuario conectado al panel web");

  socket.on("control_bot", (command) => {
    switch(command) {
      case "start":
        if (!bot) createBot();
        break;
      case "stop":
        if (bot) {
          bot.end();
          bot = null;
          sendLog("Bot detenido manualmente");
        }
        break;
      case "reconnect":
        if (bot) bot.end();
        setTimeout(createBot, 1000);
        sendLog("Reconectando bot...");
        break;
      default:
        sendLog("Comando desconocido: " + command);
        break;
    }
  });
});

// ---------------------------
// LEVANTAR EL SERVIDOR
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  sendLog(`Servidor web corriendo en puerto ${PORT}`);
});

// ---------------------------
// CREAR EL BOT
function createBot() {
  bot = mineflayer.createBot({
    host: serverHost,
    port: serverPort,
    username: botUsername,
    version: false,
    plugins: [AutoAuth],
    AutoAuth: autoAuthPassword
  });

  bot.loadPlugin(pvp);
  bot.loadPlugin(armorManager);
  bot.loadPlugin(pathfinder);

  function randomSpectatorMovement() {
    const actions = [
      () => bot.setControlState('forward', true),
      () => bot.setControlState('back', true),
      () => bot.setControlState('left', true),
      () => bot.setControlState('right', true),
      () => {
        const yaw = Math.random() * Math.PI * 2;
        const pitch = (Math.random() - 0.5) * Math.PI / 4;
        bot.look(yaw, pitch, true);
      }
    ];
    const action = actions[Math.floor(Math.random() * actions.length)];
    action();
    setTimeout(() => bot.clearControlStates(), 500);
  }

  bot.on("spawn", () => {
    sendLog("Bot conectado y listo (anti-AFK activado)");
    setInterval(randomSpectatorMovement, 8000);
  });

  // ---------------------------
  // GUARDIA Y COMBATE
  let guardPos = null;
  function guardArea(pos) { guardPos = pos.clone(); if (!bot.pvp.target) moveToGuardPos(); }
  function stopGuarding() { guardPos = null; bot.pvp.stop(); bot.pathfinder.setGoal(null); }
  function moveToGuardPos() {
    const mcData = require('minecraft-data')(bot.version);
    bot.pathfinder.setMovements(new Movements(bot, mcData));
    bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z));
  }

  bot.on('playerCollect', (collector) => {
    if (collector !== bot.entity) return;
    setTimeout(() => {
      const sword = bot.inventory.items().find(i => i.name.includes('sword'));
      if (sword) bot.equip(sword, 'hand');
    }, 150);
    setTimeout(() => {
      const shield = bot.inventory.items().find(i => i.name.includes('shield'));
      if (shield) bot.equip(shield, 'off-hand');
    }, 250);
  });

  bot.on('stoppedAttacking', () => { if (guardPos) moveToGuardPos(); });

  bot.on('physicTick', () => {
    if (bot.pvp.target || bot.pathfinder.isMoving()) return;
    const entity = bot.nearestEntity();
    if (entity) bot.lookAt(entity.position.offset(0, entity.height, 0));
  });

  bot.on('physicTick', () => {
    if (!guardPos) return;
    const filter = e => e.type === 'mob' && e.position.distanceTo(bot.entity.position) < 16 && e.mobType !== 'Armor Stand';
    const entity = bot.nearestEntity(filter);
    if (entity) bot.pvp.attack(entity);
  });

  bot.on('chat', (username, message) => {
    const player = bot.players[username];
    if (!player || !player.entity) return;
    if (message === 'guard') { bot.chat('Guarding this area'); guardArea(player.entity.position); }
    if (message === 'stop') { bot.chat('Stopping guard mode'); stopGuarding(); }
  });

  // ---------------------------
  // ERRORES Y RECONEXIÓN
  bot.on('kicked', (reason) => sendLog("Kicked: " + reason));
  bot.on('error', (err) => sendLog("Error: " + err));
  bot.on('end', () => {
    sendLog("Bot desconectado. Reconectando en 10 segundos...");
    setTimeout(createBot, reconnectDelay);
  });
}

// ---------------------------
// INICIAR EL BOT
createBot();