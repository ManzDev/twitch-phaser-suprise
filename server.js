import tmi from "tmi.js";
import { server as WebSocketServer } from "websocket";
import http from "http";

// WEBSOCKET SERVER
const PORT = 8080;
let ws;

const server = http.createServer();
server.listen(PORT, () => console.log(`Servidor del juego iniciado en el puerto ${PORT}`));
const wsServer = new WebSocketServer({ httpServer: server });

wsServer.on("request", (request) => {
  ws = request.accept(null, request.origin);
  console.log("WebSocket Server | New connection: ", request.key);
});

wsServer.on("close", (request) => console.log("WebSocket Server | Connection closed: "));

// TMI (TWITCH)
const CHANNEL = "ManzDev";
const client = new tmi.Client({ channels: [CHANNEL] });

client.connect();

client.on("message", (channel, tags, message, self) => {
  const nick = tags.username;
  const color = tags.color ?? "#ffffff";
  // const isMod = tags.mod ?? false;
  // const isSub = tags.subscriber ?? false;

  console.log(`${nick}: ${message}`);
  const data = JSON.stringify({ nick, color, message });
  const isCommand = message.startsWith("!");

  if (ws && isCommand) {
    ws.send(data);
  }
});
