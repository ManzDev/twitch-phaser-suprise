import Phaser from "phaser";
import { client as ws } from "../modules/SocketClient.js";
import { fontStyles, fontSize } from "../modules/config.js";

const ITEMS = {
  0: "empty",
  1: "bomb",
  2: "chest",
  3: "coin"
};

const MAX_USERS = 6;
const GRID_SIZE = 6;
const CELL_SIZE = 50;
const GRID_COORDS = {
  x: 350,
  y: 125
};

const USER_IMAGES = [
  "astronaut", "batmanz", "ciclope", "glados-potato", "goku-yellow", "gopher",
  "gordon-freeman", "ironmanz", "jack", "joker", "king", "luigi", "manzdev",
  "manzdevocado", "mario", "operator", "pirate", "queen", "streamer", "tanooki",
  "teacher", "terminator"
];

const getCoords = (num) => {
  const x = num % GRID_SIZE;
  const y = Math.floor(num / GRID_SIZE);
  return { x, y };
};

export class MainScene extends Phaser.Scene {
  // INIT
  // 0 => 10 Empty (0)
  // 1 => 5 Bomb (x)
  // 2 => 1 Chest (20)
  // 3 => 10 Coins (1)
  init() {
    const prepareGame = () => {
      const items = [2, 1, 1, 1, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3];
      this.grid = [];
      for (let y = 0; y < GRID_SIZE; y++) {
        const row = [];
        for (let x = 0; x < GRID_SIZE; x++) {
          row.push({ item: 0, isOpen: false, container: null });
        }
        this.grid.push(row);
      }

      while (items.length > 0) {
        const item = items.pop();
        let x, y, isEmpty;
        do {
          x = Phaser.Math.Between(0, GRID_SIZE - 1);
          y = Phaser.Math.Between(0, GRID_SIZE - 1);
          isEmpty = this.grid[y][x].item === 0;
        } while (!isEmpty);
        this.grid[y][x].item = item;
      }
    };

    prepareGame();
  }

  preload() {
    USER_IMAGES.forEach(name => this.load.image(name, `assets/sprites/${name}.png`));
    this.load.image("bomb", "assets/items/bomb.png");
    this.load.image("chest", "assets/items/chest.png");
    this.load.image("coin", "assets/items/coin.png");
    this.load.image("empty", "assets/items/empty.png");
    this.load.audio("bomb", "assets/sounds/bomb.mp3");
    this.load.audio("coin", "assets/sounds/coin.mp3");
    this.load.audio("winner", "assets/sounds/winner.mp3");
  }

  create() {
    this.players = [];
    this.isPlaying = false;
    this.turn = new Set();

    const grid = this.add.grid(GRID_COORDS.x, GRID_COORDS.y, GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE, CELL_SIZE, CELL_SIZE, 0x000044).setOrigin(0, 0);
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const pixelX = GRID_COORDS.x + (x * CELL_SIZE);
        const pixelY = GRID_COORDS.y + (y * CELL_SIZE);
        const cell = this.grid[y][x];

        cell.container = this.add.container(pixelX, pixelY);
        const isEmpty = cell.item === 0;
        const text = this.add.text(0, 0, x + (y * GRID_SIZE), fontStyles);
        const image = this.add.image(0, 0, ITEMS[cell.item]).setOrigin(0, 0).setScale(2);
        image.setVisible(false);
        cell.container.add([image, text]);
      }
    }

    this.readyMessage = this.add.text(565, 15, ["Waiting for players...", "!play"], { ...fontStyles, fontSize: 32 });

    const addPlayer = (name, color, character = "manzdev") => {
      const index = Phaser.Math.Between(0, USER_IMAGES.length - 1);
      const randomCharacter = USER_IMAGES[index];
      const image = this.add.image(0, 0, randomCharacter).setScale(3);
      const text = this.add.text(0, image.height + 10, name, { ...fontStyles, color }).setOrigin(0.5, 0);
      const points = this.add.text(60, 0, "0", fontStyles);
      const container = this.add.container(0, 0);
      container.add([image, text, points]);

      const user = { name, player: container, points: 0, dead: false, pending: false };
      this.players.push(user);
      return user;
    };

    const reorderPlayers = () => {
      const usersToOrder = this.players.map(user => user.player);
      Phaser.Actions.GridAlign(usersToOrder, {
        width: 1,
        height: 10,
        cellWidth: 60,
        cellHeight: 90,
        x: 100,
        y: 100
      });
    };

    ws.addEventListener("message", (ev) => {
      const { nick, color, message } = JSON.parse(ev.data);
      const command = message.split(" ")[0].substring(1);
      const hasNick = this.players.find(player => player.name === nick);

      if (command === "play" && !this.isPlaying && !hasNick) {
        addPlayer(nick, color);
        reorderPlayers();
        this.players.length === MAX_USERS && this.startGame();
      };

      if (command === "open" && this.isPlaying && hasNick && !this.turn.has(nick)) {
        const param = Number.parseInt(message.split(" ")[1]);

        if (isNaN(param) || param < 0 || param > 35) { return; }

        const { x, y } = getCoords(param);
        const cell = this.grid[y][x];
        if (cell.isOpen) return;
        cell.isOpen = true;
        cell.container.getAt(1).setColor("#00ffff");
        cell.container.getAt(0).setVisible(true);

        const player = this.players.find(player => player.name === nick);

        this.turn.add(nick);
        player.player.getAt(0).setTint(0x0000aa);

        // Bomb
        if (cell.item === 1) {
          player.points = 0;
          player.dead = true;
          this.players = this.players.filter(player => !player.dead);
          player.player.getAt(0).setAlpha(0.2);
          this.sound.play("bomb");
        }

        // Chest
        if (cell.item === 2) {
          player.points += 20;
          player.player.getAt(2).setText(player.points);
          this.isPlaying = false;
          this.sound.play("winner");
        }

        // Coin
        if (cell.item === 3) {
          this.sound.play("coin");
          player.points += 1;
          player.player.getAt(2).setText(player.points);
        }

        console.log("=>", this.turn.size, this.players.length);
        if (this.turn.size >= this.players.length) {
          this.turn.clear();
          this.players.forEach(user => user.player.getAt(0).clearTint());
        }
      }
    });
  }

  startGame() {
    this.isPlaying = true;
    this.readyMessage.setText("Ready to play!").setColor("lime");
  };

  update() {
  }
};
