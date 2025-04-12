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
  spawnCustomerLoop();
  gameLoop();
};

// スタートボタン
const startScreen = document.getElementById("startScreen");
const startButton = document.getElementById("startButton");

// スタートボタン処理にお客様来店処理をまとめる
function startGame() {
  startScreen.style.display = "none";
  bgm.play();  // ✅ ここだけで再生！
  spawnCustomer();
  spawnCustomerLoop();
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
let customerSpawnTimer = 30000;
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

  // 60秒間「注文を受け取られない」場合の怒り退店処理
  c.angerTimer = setTimeout(() => {
    if (c.state === "ordered") {
      c.state = "angry";
      c.routeIndex = c.path.length - 1;
      c.reverse = true;
      angrySound.play();
      missCount++;
      if (missCount >= maxMisses) {
        triggerGameOver();
      }
    }
  }, 60000); // ← ここで60秒に設定
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
  if (isGameOver || player.moving) return;

  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];

  const scaleX = canvas.width / canvas.clientWidth;
  const scaleY = canvas.height / canvas.clientHeight;

  const canvasX = (touch.clientX - rect.left) * scaleX;
  const canvasY = (touch.clientY - rect.top) * scaleY;

  // === ★ 注文アイコンがタップされたか確認 ===
  for (let c of customerList) {
    if (c.state === "ordered") {
      const pos = orderPositions[c.chairId];
      const iconX = pos.x;
      const iconY = pos.y;
      const iconSize = 150;

      if (
        canvasX >= iconX && canvasX <= iconX + iconSize &&
        canvasY >= iconY && canvasY <= iconY + iconSize
      ) {
        receiveOrder(c); // ← 注文受け取り処理
        return; // ここで終わり（アクション不要）
      }
    }
  }

  // === 通常の移動処理 ===
  const gx = Math.floor(canvasX / tileSize);
  const gy = Math.floor(canvasY / tileSize);

  const px = player.x / tileSize;
  const py = player.y / tileSize;

  let tx = player.x;
  let ty = player.y;

  const dx = gx - px;
  const dy = gy - py;

  if (Math.abs(dx) > Math.abs(dy)) {
    tx += tileSize * Math.sign(dx);
  } else if (dy !== 0) {
    ty += tileSize * Math.sign(dy);
  }

  const txGrid = tx / tileSize;
  const tyGrid = ty / tileSize;

  if (
    txGrid >= 0 && txGrid < maxCols &&
    tyGrid >= 0 && tyGrid < maxRows &&
    !checkCollisionRect(tx, ty, tileSize, tileSize)
  ) {
    player.moveTarget = { x: tx, y: ty };
    player.moving = true;
  }
  // === ラーメンカウンターの近くをタップしたら受け取る ===
  const ramenSpots = [
    { x: 0, y: 50 }, { x: 150, y: 50 }, { x: 300, y: 50 }
  ];

  for (let spot of ramenSpots) {
    const dx = Math.abs(canvasX - spot.x);
    const dy = Math.abs(canvasY - spot.y);
    if (dx < tileSize && dy < tileSize) {
      tryPickupRamen(); // ← これでラーメン取得OK！
      break;
    }
  }
  // ✅ 注文じゃなければラーメン受け取り処理
  handleZAction();
});


function receiveOrder(customer) {
  clearTimeout(customer.angerTimer);
  customer.state = "waiting";
  activeOrders.push({
    customerId: customer.chairId,
    iconIndex: customer.orderIcon,
    state: "counter"
  });
  orderSound.play();

  customer.angerTimer = setTimeout(() => {
    if (customer.state === "waiting") {
      customer.state = "angry";
      customer.routeIndex = customer.path.length - 1;
      customer.reverse = true;
      angrySound.play();
      missCount++;
      if (missCount >= maxMisses) {
        triggerGameOver();
      }
    }
  }, 30000);
}

function handleZAction() {
  customerList.forEach(c => {
    const pos = orderPositions[c.chairId];
    const dx = Math.abs(player.x - pos.x);
    const dy = Math.abs(player.y - pos.y);

    if (dx + dy <= tileSize + 10) {
      if (c.state === "ordered") {
        clearTimeout(c.angerTimer);
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

  // ✅ ラーメン取得関数の呼び出し（ここ重要）
  tryPickupRamen();
}


function tryPickupRamen() {
  if (carryingRamen !== null) return false;

  const ramenSpots = [
    { x: 0, y: 50 }, { x: 150, y: 50 }, { x: 300, y: 50 }
  ];

  const counterOrders = activeOrders.filter(o => o.state === "counter");

  let nearest = null;
  let minDistance = Infinity;

  counterOrders.forEach((order, index) => {
    const spot = ramenSpots[index];
    if (!spot) return;

    const dx = player.x - spot.x;
    const dy = player.y - spot.y;
    const dist = Math.abs(dx) + Math.abs(dy);

    if (dist < tileSize && dist < minDistance) {
      nearest = order;
      minDistance = dist;
    }
  });

  if (nearest) {
    carryingRamen = nearest.iconIndex;
    playerImage.src = `img/player/ramen_misaki${carryingRamen + 1}.png`;
    nearest.state = "carried"; // ← これで drawRamenOnCounter に表示されなくなる
    return true;
  }
}

function drawRamenOnCounter() {
  const ramenSpots = [
    { x: 0, y: 50 }, { x: 150, y: 50 }, { x: 300, y: 50 }
  ];

  const counterOrders = activeOrders.filter(o => o.state === "counter");

  counterOrders.forEach((order, i) => {
    const spot = ramenSpots[i];
    if (spot) {
      ctx.drawImage(ramenImages[order.iconIndex], spot.x, spot.y, 150, 150);
    }
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

  // ✅ 操作説明を追加
ctx.font = "20px 'Press Start 2P'";
ctx.strokeText("action key", x, 110);
ctx.fillText("action key", x, 110);
ctx.strokeText(" z  or tap", x, 140);
ctx.fillText(" z  or tap", x, 140);
}

// スコアに応じて来店間隔を調整
function getDynamicSpawnTime() {
  const levels = [
    { score: 0, interval: 25000 },
    { score: 500, interval: 20000 },
    { score: 1000, interval: 15000 },
    { score: 1500, interval: 12000 },
    { score: 2000, interval: 10000 },
    { score: 2500, interval: 5000 },
    { score: 3000, interval: 3000 } // 最速レベル
  ];

  for (let i = levels.length - 1; i >= 0; i--) {
    if (score >= levels[i].score) {
      return levels[i].interval;
    }
  }

  return 30000; // デフォルト（念のため）
}

// 来店ループ関数（定期的に呼び出される）
function spawnCustomerLoop() {
if (isGameOver) return; // ← ここを追加してゲームオーバー時は停止
  const usedChairIds = customerList.map(c => c.chairId);
  const availableChairs = chairs.filter(chair => !usedChairIds.includes(chair.id));

  if (availableChairs.length > 0) {
    spawnCustomer();
  }

  const nextInterval = getDynamicSpawnTime();
  setTimeout(spawnCustomerLoop, nextInterval);
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

let isGameOver = false; // ← ここに移動！
let missCount = 0;
const maxMisses = 3;


const gameOverScreen = document.getElementById("gameOverScreen");
const restartButton = document.getElementById("restartButton");

function triggerGameOver() {
  isGameOver = true;
  bgm.pause();

  // 全 angerTimer を停止（お客様が怒らないように）
  customerList.forEach(c => {
    if (c.angerTimer) {
      clearTimeout(c.angerTimer);
      c.angerTimer = null;
    }
  });

  // ランダム背景設定
  const bgImages = [
    "img/background/gameover1.jpg",
    "img/background/gameover2.jpg",
    "img/background/gameover3.jpg"
  ];
  const selected = bgImages[Math.floor(Math.random() * bgImages.length)];
  gameOverScreen.style.backgroundImage = `url('${selected}')`;
  gameOverScreen.style.backgroundSize = "cover";
  gameOverScreen.style.backgroundPosition = "center";

  // スコア表示
  const finalScore = document.getElementById("finalScore");
  finalScore.textContent = `SCORE: ${score}`;

  gameOverScreen.style.display = "flex";
}

// リスタート処理
restartButton.addEventListener("click", () => {
  resetGame(); // ← 初期化関数を作って再開
});


// リスタートゲーム
function resetGame() {
  isGameOver = false;
  score = 0;
  missCount = 0;
  customerList = [];
  activeOrders = [];
  carryingRamen = null;
  player.x = 0;
  player.y = 150;
  player.moveTarget = { x: 0, y: 150 };
  playerImage.src = "img/player/order_misaki.png";

  gameOverScreen.style.display = "none";
  bgm.currentTime = 0;
  bgm.play();

  spawnCustomer();
  spawnCustomerLoop();
  gameLoop();
}

function gameLoop() {
  if (isGameOver) return; // ★ ゲームオーバー中は止める
  update();
  updateCustomers();
  draw();
  requestAnimationFrame(gameLoop);
}

bgImage.onload = () => {
  gameLoop();
};
