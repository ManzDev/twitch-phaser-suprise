export const client = new WebSocket("ws://localhost:8080");

client.onerror = () => console.log("ERROR CONNECTING TO SERVER");
client.onopen = () => console.log("CONNECTED TO SERVER");
client.onclose = () => console.log("DISCONNECTED FROM SERVER");
