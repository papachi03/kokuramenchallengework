// 修正版 game.js

window.addEventListener("load", () => {
  window.focus();
});

const canvas = document.getElementById("gameCanvas"); // ← 先に定義！
const ctx = canvas.getContext("2d");

// ここでresizeCanvasを定義してもOK
function resizeCanvas() {
  const canvasRatio = canvas.width / canvas.height;
  const windowRatio = window.innerWidth / window.innerHeight;

  if (windowRatio < canvasRatio) {
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = (window.innerWidth / canvasRatio) + "px";
  } else {
    canvas.style.width = (window.innerHeight * canvasRatio) + "px";
    canvas.style.height = window.innerHeight + "px";
  }
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("orientationchange", resizeCanvas);
resizeCanvas(); // ✅ canvas定義の後に呼び出す！

const tileSize = 150;
const maxCols = 5;
const maxRows = 10;
// ▼ 音声の読み込み
const bgm = new Audio("sound/BGM.mp3");
const orderSound = new Audio("sound/order.mp3");
const loveSound = new Audio("sound/love.mp3");
const angrySound = new Audio("sound/oko.mp3");

const bgImage = new Image();
bgImage.src = "img/main/game_main.png";

// BGM設定
bgm.loop = true;
bgm.volume = 0.1;         // BGMは控えめに
orderSound.volume = 0.2;  // 注文の音ははっきり
loveSound.volume = 0.2;   // LOVEはしっかり強調
angrySound.volume = 0.2;  // 怒りは最大で警告的に

// ゲーム開始時にBGM再生
bgImage.onload = () => {
  bgm.play(); // ★ここで再生
  spawnCustomerLoop();
  gameLoop();
};

// スタートボタン
const startScreen = document.getElementById("startScreen");
const startButton = document.getElementById("startButton");

// スタートボタン処理にお客様来店処理をまとめる
function startGame() {
  startScreen.style.display = "none";
  bgm.play();                         // BGM再生
  spawnCustomer();                    // 最初のお客様だけ来店
  spawnCustomerLoop();               // 以降の定期来店ループ開始
}

// ボタンにクリックイベント登録
startButton.addEventListener("click", startGame);


document.addEventListener("keydown", () => {
  if (bgm.paused) {
    bgm.play();
  }
});

let playerImage = new Image();
playerImage.src = "img/player/order_misaki.png";

let player = {
  x: 0,
  y: 150,
  width: tileSize,
  height: tileSize,
  speed: 3,
  moving: false,
  moveTarget: { x: 0, y: 150 }
};

let score = 0;
let carryingRamen = null;
let customerList = [];
let customerSpawnTimer = 11000;
let customerCount = 0;
const maxCustomers = 11;

const blockedZones = [
  { x: 0, y: 0, width: 450, height: 150 },
  { x: 0, y: 450, width: 150, height: 300 },
  { x: 300, y: 450, width: 150, height: 300 },
  { x: 600, y: 450, width: 150, height: 300 },
  { x: 0, y: 1050, width: 150, height: 300 },
  { x: 300, y: 1050, width: 150, height: 300 },
  { x: 600, y: 1050, width: 150, height: 300 }
];

const chairs = [
  { id: 1, x: 0, y: 300 }, { id: 2, x: 300, y: 300 }, { id: 3, x: 600, y: 300 },
  { id: 4, x: 0, y: 750 }, { id: 5, x: 300, y: 750 }, { id: 6, x: 600, y: 750 },
  { id: 7, x: 0, y: 900 }, { id: 8, x: 300, y: 900 }, { id: 9, x: 600, y: 900 },
  { id: 10, x: 0, y: 1350 }, { id: 11, x: 600, y: 1350 }
];

const chairPaths = {
  1: [{x:350,y:1350},{x:150,y:1350},{x:150,y:300},{x:0,y:300}],
  2: [{x:350,y:1350},{x:150,y:1350},{x:150,y:300},{x:300,y:300}],
  3: [{x:350,y:1350},{x:450,y:1350},{x:450,y:300},{x:600,y:300}],
  4: [{x:350,y:1350},{x:150,y:1350},{x:150,y:750},{x:0,y:750}],
  5: [{x:350,y:1350},{x:450,y:1350},{x:450,y:750},{x:300,y:750}],
  6: [{x:350,y:1350},{x:450,y:1350},{x:450,y:750},{x:600,y:750}],
  7: [{x:350,y:1350},{x:150,y:1350},{x:150,y:900},{x:0,y:900}],
  8: [{x:350,y:1350},{x:150,y:1350},{x:150,y:900},{x:300,y:900}],
  9: [{x:350,y:1350},{x:450,y:1350},{x:450,y:900},{x:600,y:900}],
  10:[{x:350,y:1350},{x:0,y:1350}],
  11:[{x:350,y:1350},{x:600,y:1350}]
};

const orderPositions = {};
chairs.forEach(chair => {
  orderPositions[chair.id] = [1,2,3,7,8,9].includes(chair.id)
    ? { x: chair.x, y: chair.y + 150 }
    : { x: chair.x, y: chair.y - 150 };
});

// ← canvasやctxの初期化の後に、checkCollisionRect をここで定義
function checkCollisionRect(x, y, width, height) {
  return blockedZones.some(zone => (
    x < zone.x + zone.width &&
    x + width > zone.x &&
    y < zone.y + zone.height &&
    y + height > zone.y
  ));
}


const customerImages = [
  "img/customers/CNP_hebi.png", "img/customers/CNP_inu.png", "img/customers/CNP_neko_cha.png",
  "img/customers/CNP_neko_glay.png", "img/customers/CNP_oni.png", "img/customers/CNP_panda.png",
  "img/customers/CNP_tori.png", "img/customers/CNP_usagi.png", "img/customers/CNP_yuurei.png"
];

const orderIcons = [
  { order: new Image(), served: new Image() },
  { order: new Image(), served: new Image() },
  { order: new Image(), served: new Image() }
];
orderIcons[0].order.src = "img/order/order1.png";
orderIcons[1].order.src = "img/order/order2.png";
orderIcons[2].order.src = "img/order/order3.png";
orderIcons[0].served.src = "img/order/stayramen1.png";
orderIcons[1].served.src = "img/order/stayramen2.png";
orderIcons[2].served.src = "img/order/stayramen3.png";

const ramenImages = [new Image(), new Image(), new Image()];
ramenImages[0].src = "img/ramen/ramen1.png";
ramenImages[1].src = "img/ramen/ramen2.png";
ramenImages[2].src = "img/ramen/ramen3.png";

let activeOrders = [];
let ramenCounter = 0; // ← 追加: ramen配置カウンター

function updateCustomers() {
  customerList.forEach((c, index) => {
    if (c.reverse) {
      if (c.routeIndex < 0) {
        customerList.splice(index, 1);
        return;
      }
      const t = c.path[c.routeIndex];
      const dx = t.x - c.x, dy = t.y - c.y, speed = 2;
      if (Math.abs(dx) < speed && Math.abs(dy) < speed) {
        c.x = t.x; c.y = t.y; c.routeIndex--;
      } else {
        if (dx) c.x += speed * Math.sign(dx);
        if (dy) c.y += speed * Math.sign(dy);
      }
      return;
    }
    if (c.routeIndex >= c.path.length) return;
    const t = c.path[c.routeIndex];
    const dx = t.x - c.x, dy = t.y - c.y, speed = 2;
    if (Math.abs(dx) < speed && Math.abs(dy) < speed) {
      c.x = t.x; c.y = t.y; c.routeIndex++;
      if (c.routeIndex >= c.path.length && !c.seated) {
        c.seated = true;
  setTimeout(() => {
  c.orderIcon = Math.floor(Math.random() * 3);
  c.state = "ordered";
  c.angerTimer = setTimeout(() => {
    if (c.state === "waiting") {
      c.state = "angry";
      c.routeIndex = c.path.length - 1;
      c.reverse = true;
      angrySound.play();
      missCount++;
      if (missCount >= maxMisses) {
        triggerGameOver();
      }
    }
  }, 30000);
}, 1000);

      }
    } else {
      if (dx) c.x += speed * Math.sign(dx);
      if (dy) c.y += speed * Math.sign(dy);
    }
  });
}

function drawOrderIcons() {
  customerList.forEach(c => {
    if (c.orderIcon === null) return;
    const pos = orderPositions[c.chairId];
    let icon;
    if (c.state === "ordered") icon = orderIcons[c.orderIcon].order;
    else if (c.state === "waiting") icon = orderIcons[c.orderIcon].served;
    else if (c.state === "done") { icon = new Image(); icon.src = "img/order/love.png"; }
    else if (c.state === "angry") { icon = new Image(); icon.src = "img/order/angry.png"; }
    else return;
    ctx.drawImage(icon, pos.x, pos.y, 150, 150);
  });
}

function spawnCustomer() {
  if (customerList.length >= maxCustomers) return;
  const usedChairIds = customerList.map(c => c.chairId);
  const availableChairs = chairs.filter(chair => !usedChairIds.includes(chair.id));
  if (availableChairs.length === 0) return;
  const img = new Image();
  img.src = customerImages[Math.floor(Math.random() * customerImages.length)];
  const chair = availableChairs[Math.floor(Math.random() * availableChairs.length)];
  const route = chairPaths[chair.id];
  const newCustomer = {
    image: img, x: route[0].x, y: route[0].y,
    width: 150, height: 150, routeIndex: 1, path: route,
    seated: false, chairId: chair.id, orderIcon: null,
    state: "idle", angerTimer: null, reverse: false
  };
  customerList.push(newCustomer);
  customerCount++;
}


document.querySelectorAll(".arrow").forEach(btn => {
  btn.addEventListener("touchstart", e => {
    e.preventDefault();
    const dir = btn.dataset.dir;
    if (player.moving || isGameOver) return;

    let tx = player.x;
    let ty = player.y;

    if (dir === "up") ty -= tileSize;
    if (dir === "down") ty += tileSize;
    if (dir === "left") tx -= tileSize;
    if (dir === "right") tx += tileSize;

    const gx = tx / tileSize;
    const gy = ty / tileSize;
    if (gx < 0 || gx >= maxCols || gy < 0 || gy >= maxRows) return;
    if (!checkCollisionRect(tx, ty, tileSize, tileSize)) {
      player.moveTarget = { x: tx, y: ty };
      player.moving = true;
    }
  });
});

document.getElementById("zButton").addEventListener("touchstart", e => {
  e.preventDefault();
  handleZAction();
});


window.addEventListener("keydown", e => {
  if (player.moving) return;

  let tx = player.x, ty = player.y;
  if (e.key === "ArrowUp") ty -= tileSize;
  else if (e.key === "ArrowDown") ty += tileSize;
  else if (e.key === "ArrowLeft") tx -= tileSize;
  else if (e.key === "ArrowRight") tx += tileSize;

  const gx = tx / tileSize, gy = ty / tileSize;
  if (gx < 0 || gx >= maxCols || gy < 0 || gy >= maxRows) return;
  if (!checkCollisionRect(tx, ty, tileSize, tileSize)) {
    player.moveTarget = { x: tx, y: ty };
    player.moving = true;
  }

  if (e.key === "z") {
    handleZAction(); // ← 注文や配膳の共通関数に分離しておくと便利
  }
});

// =======================
// タップ操作対応
// =======================
canvas.addEventListener("touchstart", function (e) {
  if (isGameOver) return;

  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];

  const scaleX = canvas.width / canvas.clientWidth;
  const scaleY = canvas.height / canvas.clientHeight;

  const canvasX = (touch.clientX - rect.left) * scaleX;
  const canvasY = (touch.clientY - rect.top) * scaleY;

  const gx = Math.floor(canvasX / tileSize);
  const gy = Math.floor(canvasY / tileSize);
  const tx = gx * tileSize;
  const ty = gy * tileSize;

  // 範囲外チェック
  if (gx < 0 || gx >= maxCols || gy < 0 || gy >= maxRows) return;

  // 当たり判定チェック
  if (!checkCollisionRect(tx, ty, tileSize, tileSize)) {
    // プレイヤー移動可能な場合のみ移動
    if (!player.moving) {
      player.moveTarget = { x: tx, y: ty };
      player.moving = true;
    }
  }

  // プレイヤーが移動していないときのみZアクション実行
  if (!player.moving) {
    handleZAction(); // ← 注文/配膳
  }
});

  // 注文・配膳の処理（"z"キーと同等）
function handleZAction() {
  customerList.forEach(c => {
    const pos = orderPositions[c.chairId];
    const dx = Math.abs(player.x - pos.x);
    const dy = Math.abs(player.y - pos.y);

    if (dx + dy <= tileSize + 10) {
      if (c.state === "ordered") {
        c.state = "waiting";
        activeOrders.push({ customerId: c.chairId, iconIndex: c.orderIcon, state: "counter" });
        orderSound.play();
        c.angerTimer = setTimeout(() => {
  if (c.state === "waiting") {
    c.state = "angry";
    c.routeIndex = c.path.length - 1;
    c.reverse = true;
    angrySound.play();
    missCount++;
    if (missCount >= maxMisses) {
      triggerGameOver();
    }
  }
}, 30000);
      } else if (c.state === "waiting" && carryingRamen === c.orderIcon) {
        c.state = "done";
        carryingRamen = null;
        playerImage.src = "img/player/order_misaki.png";
        score += 100;
        setTimeout(() => {
          if (c.state === "done") {
            c.state = "leaving";
            c.routeIndex = c.path.length - 1;
            c.reverse = true;
            loveSound.play();
          }
        }, 3000);
      }
    }
  });

  // ラーメン取得処理
  if (carryingRamen === null) {
    const ramenSpots = [
      { x: 0, y: 50 }, { x: 150, y: 50 }, { x: 300, y: 50 }
    ];

    for (let i = 0; i < ramenSpots.length; i++) {
      const rx = ramenSpots[i].x;
      const ry = ramenSpots[i].y;

      const order = activeOrders.find(o =>
        o.state === "counter" &&
        Math.abs(player.x - rx) + Math.abs(player.y - ry) < tileSize
      );

      if (order) {
        carryingRamen = order.iconIndex;
        playerImage.src = `img/player/ramen_misaki${carryingRamen + 1}.png`;
        order.state = "carried";
        break;
      }
    }
  }
}

function drawRamenOnCounter() {
  const ramenSpots = [
    { x: 0, y: 50 }, { x: 150, y: 50 }, { x: 300, y: 50 }
  ];

  const ramenOnCounter = activeOrders.filter(o => o.state === "counter").slice(0, 3);

  ramenOnCounter.forEach((order, i) => {
    const pos = ramenSpots[i];
    ctx.drawImage(ramenImages[order.iconIndex], pos.x, pos.y, 150, 150);
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
  drawRamenOnCounter();
  ctx.drawImage(playerImage, player.x, player.y, tileSize, tileSize);
  customerList.forEach(c => {
    ctx.drawImage(c.image, c.x, c.y, tileSize, tileSize);
  });
  drawOrderIcons();
  ctx.fillStyle = "white";
  ctx.font = "28px 'Press Start 2P'";
  ctx.textAlign = "center";
  ctx.strokeStyle = "black";
  const x = canvas.width - 100;
  ctx.strokeText("SCORE", x, 30);
  ctx.fillText("SCORE", x, 30);
  ctx.strokeText(score.toString(), x, 70);
  ctx.fillText(score.toString(), x, 70);
}

function spawnCustomerLoop() {
  const usedChairIds = customerList.map(c => c.chairId);
  const availableChairs = chairs.filter(chair => !usedChairIds.includes(chair.id));

  if (availableChairs.length > 0) {
    spawnCustomer(); // ← 空席があれば来店させる
  }

  customerSpawnTimer = Math.max(5000, customerSpawnTimer - 1000);
  setTimeout(spawnCustomerLoop, customerSpawnTimer); // ← 常にループは継続
}

function update() {
  if (player.moving) {
    let dx = player.moveTarget.x - player.x;
    let dy = player.moveTarget.y - player.y;
    if (Math.abs(dx) <= player.speed && Math.abs(dy) <= player.speed) {
      player.x = player.moveTarget.x;
      player.y = player.moveTarget.y;
      player.moving = false;
    } else {
      if (dx) player.x += player.speed * Math.sign(dx);
      if (dy) player.y += player.speed * Math.sign(dy);
    }
  }
}

let missCount = 0;
const maxMisses = 3;
let isGameOver = false;

const gameOverScreen = document.getElementById("gameOverScreen");
const restartButton = document.getElementById("restartButton");

function triggerGameOver() {
  isGameOver = true;
  bgm.pause();
  gameOverScreen.style.display = "flex";
}

// リスタート処理
restartButton.addEventListener("click", () => {
  location.reload(); // ページをリロードして最初から
});



function gameLoop() {
if (isGameOver) return; // ★ゲームオーバー時は停止
  update();
  updateCustomers();
  draw();
  requestAnimationFrame(gameLoop);
}

bgImage.onload = () => {
  gameLoop();
};
