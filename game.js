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

// ←この下に追加！
function isPlayerNearCustomerIcon(player, customer, range = tileSize) {
  const pos = orderPositions[customer.chairId];
  const dx = Math.abs(player.x - pos.x);
  const dy = Math.abs(player.y - pos.y);
  return dx + dy <= range;
}


// ▼ 音声の読み込み
const bgm = new Audio("sound/BGM.mp3");
const orderSound = new Audio("sound/order.mp3");
const loveSound = new Audio("sound/love.mp3");
const angrySound = new Audio("sound/oko.mp3");
const throwAwaySound = new Audio("sound/trash.mp3");
throwAwaySound.volume = 0.2;

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
let trashEffects = [];
let carryingRamen = null;
let customerList = [];
let customerSpawnTimer = 30000;
let customerCount = 0;
const maxCustomers = 11;
let customerLoopTimer = null; // ← ★ ここに追加するのがベスト！

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
  const now = Date.now();

  customerList.forEach((c, index) => {
    // ✅ love状態から3秒経過後にleavingへ移行
    if (c.state === "done" && !c.loveStartTime) {
      c.loveStartTime = now;
    } else if (c.state === "done" && now - c.loveStartTime > 3000) {
      c.state = "leaving";
      c.routeIndex = c.path.length - 1;
      c.reverse = true;
      loveSound.play();
    }

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
    }, 60000);

  }, 1000); // ✅ カッコ位置正しい！
}

    } else {
      if (dx) c.x += speed * Math.sign(dx);
      if (dy) c.y += speed * Math.sign(dy);
    }
// 👇怒り処理のフォロー（状態がwaitingのまま時間切れになっていたら）
if (c.state === "waiting" && c.angerTimer === null) {
  const order = activeOrders.find(o => o.customerId === c.chairId);
  if (!order) {
    c.state = "angry";
    c.routeIndex = c.path.length - 1;
    c.reverse = true;
    angrySound.play();
    missCount++;
    if (missCount >= maxMisses) {
      triggerGameOver();
    }
  }
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
    // 🔦 プレイヤーが近ければ光る演出！
    if (isPlayerNearCustomerIcon(player, c)) {
      ctx.save();
      ctx.shadowColor = "yellow";
      ctx.shadowBlur = 20;
      ctx.drawImage(icon, pos.x, pos.y, 150, 150);
      ctx.restore();
    } else {
      ctx.drawImage(icon, pos.x, pos.y, 150, 150);
    }
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
}); // ← ここでイベントリスナーの処理終了！

// =======================
// タップ操作対応
// =======================
canvas.addEventListener("touchstart", function (e) {
  e.preventDefault(); // ← 重要：スマホでスクロールされないように
  if (isGameOver || player.moving) return;

  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  const scaleX = canvas.width / canvas.clientWidth;
  const scaleY = canvas.height / canvas.clientHeight;
  const canvasX = (touch.clientX - rect.left) * scaleX;
  const canvasY = (touch.clientY - rect.top) * scaleY;

  // 1. 注文 or 配膳 処理
  for (let c of customerList) {
    const pos = orderPositions[c.chairId];
    const iconSize = 150;
    const inIconArea =
      canvasX >= pos.x &&
      canvasX <= pos.x + iconSize &&
      canvasY >= pos.y &&
      canvasY <= pos.y + iconSize;

    if (inIconArea && isPlayerNearCustomerIcon(player, c)) {
      if (c.state === "ordered") {
        receiveOrder(c);
        return;
      }
      if (c.state === "waiting" && carryingRamen?.iconIndex === c.orderIcon) {
        const orderIndex = activeOrders.findIndex(
          (o) => o.customerId === c.chairId && o.spotIndex === carryingRamen.spotIndex
        );
        if (orderIndex !== -1) {
          activeOrders.splice(orderIndex, 1);
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
        return;
      }
    }
  }

  // 2. ラーメン受け取り
if (tryPickupRamen()) return;


// 2.5 カウンターでラーメンを破棄（プレイヤーが近くて、かつタップ位置もカウンター上）
if (carryingRamen) {
  const dropZone = [
    { x: 0, y: 50 }, { x: 150, y: 50 }, { x: 300, y: 50 }
  ];

  const tappedCounterSpot = dropZone.find(spot =>
    canvasX >= spot.x && canvasX <= spot.x + tileSize &&
    canvasY >= spot.y && canvasY <= spot.y + tileSize
  );

  const nearCounter = dropZone.some(spot => {
    const dx = Math.abs(player.x - spot.x);
    const dy = Math.abs(player.y - spot.y);
    return dx + dy <= tileSize;
  });

  if (tappedCounterSpot && nearCounter) {
    trashEffects.push({
      x: player.x,
      y: player.y,
      radius: 0,
      alpha: 1
    });
    carryingRamen = null;
    playerImage.src = "img/player/order_misaki.png";
    throwAwaySound.play();
score -= 100; // ← 💥ここを追加（マイナススコア）
if (score < 0) score = 0; // 👈 スコアがマイナスにならないように制限
    console.log("ラーメン破棄されました（スマホタップ・正しい位置）");
    return;
  }
}

  // 3. タップ移動（上下左右1マス）
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

  if (
    tx / tileSize >= 0 &&
    tx / tileSize < maxCols &&
    ty / tileSize >= 0 &&
    ty / tileSize < maxRows &&
    !checkCollisionRect(tx, ty, tileSize, tileSize)
  ) {
    player.moveTarget = { x: tx, y: ty };
    player.moving = true;
  }
}, { passive: false }); // ← passive: false を追加（preventDefault有効にする）



function getAvailableSpotIndex() {
  const usedSpots = activeOrders
    .filter(o => o.state === "counter")
    .map(o => o.spotIndex);

  for (let i = 0; i < 3; i++) {
    if (!usedSpots.includes(i)) return i;
  }

  return null; // すべて使われていた場合は null を返す
}

function receiveOrder(customer) {
  const assignedSpotIndex = getAvailableSpotIndex();
  if (assignedSpotIndex === null) {
    console.log("カウンター満席で注文不可");
    return;
  }

  // すでにこの顧客の注文が activeOrders にあるなら追加しない
  const alreadyExists = activeOrders.some(o =>
    o.customerId === customer.chairId
  );
  if (alreadyExists) {
    console.log("既に注文処理済み");
    return;
  }

  // ✅【ここ】で orderId を発行して保存！
  const orderId = Date.now() + "_" + customer.chairId;
  customer.activeOrderId = orderId;

  clearTimeout(customer.angerTimer);
  customer.state = "waiting";

  // ✅ orderId を注文にもセット
  activeOrders.push({
    orderId: orderId,
    customerId: customer.chairId,
    iconIndex: customer.orderIcon,
    state: "counter",
    spotIndex: assignedSpotIndex
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
  // ================================
  // 🔁 ラーメン破棄：カウンターで不要なラーメンを捨てる処理
  // ================================
  if (carryingRamen) {
  const dropZone = [
    { x: 0, y: 50 }, { x: 150, y: 50 }, { x: 300, y: 50 }
  ];

  const nearCounter = dropZone.some(spot => {
    const dx = Math.abs(player.x - spot.x);
    const dy = Math.abs(player.y - spot.y);
    return dx + dy <= tileSize;
  });

  if (nearCounter) {
    trashEffects.push({
      x: player.x,
      y: player.y,
      radius: 0,
      alpha: 1
    });
    carryingRamen = null;
    playerImage.src = "img/player/order_misaki.png";
    score -= 100;
    if (score < 0) score = 0;

    throwAwaySound.play().catch(e => {
      console.warn("破棄音の再生に失敗:", e);
    });

    console.log("ラーメン破棄されました（Zキー）");
    return;
  }
}


  // ================================
  // 💡 お客様の対応処理（注文・配膳）
  // ================================
  customerList.forEach(c => {
    if (!isPlayerNearCustomerIcon(player, c)) return;

    if (c.state === "ordered") {
      receiveOrder(c);
    }

    if (c.state === "waiting" && carryingRamen?.iconIndex === c.orderIcon) {
  const order = activeOrders.find(o =>
    o.customerId === c.chairId && o.iconIndex === carryingRamen.iconIndex
  );
  if (!order) return;

  activeOrders = activeOrders.filter(o => o.orderId !== order.orderId);
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
 });

  // ================================
  // 🍜 最後にカウンターからラーメンを受け取る処理
  // ================================
  tryPickupRamen();
} // ← ✅ この位置で正しく関数を閉じる


function tryPickupRamen() {
  if (carryingRamen !== null) return false;

  const ramenSpots = [
    { x: 0, y: 50 }, { x: 150, y: 50 }, { x: 300, y: 50 }
  ];

  const counterOrders = activeOrders.filter(o => o.state === "counter");

  for (let i = 0; i < ramenSpots.length; i++) {
    const spot = ramenSpots[i];
    const dx = player.x - spot.x;
    const dy = player.y - spot.y;
    const dist = Math.abs(dx) + Math.abs(dy);

    if (dist < tileSize) {
      const targetOrder = counterOrders.find(o => o.spotIndex === i);
      if (targetOrder) {

        carryingRamen = {
  iconIndex: targetOrder.iconIndex,
  spotIndex: i,
  orderId: targetOrder.orderId // ← ★ カンマを追加した！
};

        playerImage.src = `img/player/ramen_misaki${carryingRamen.iconIndex + 1}.png`;
        targetOrder.state = "carried"; // ✅ このラーメンだけ状態変更
        return true;
      }
    }
  }

  return false;
}

function drawRamenOnCounter() {
  const ramenSpots = [
    { x: 0, y: 50 }, { x: 150, y: 50 }, { x: 300, y: 50 }
  ];

  const counterOrders = activeOrders.filter(o => o.state === "counter");

  counterOrders.forEach(order => {
    const spot = ramenSpots[order.spotIndex]; // spotIndex で正確に指定
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
drawTrashEffects(); // ← 最後に呼び出してアニメ演出

  // ✅ 操作説明を追加
ctx.font = "20px 'Press Start 2P'";
ctx.strokeText("action key", x, 110);
ctx.fillText("action key", x, 110);
ctx.strokeText(" z  or tap", x, 140);
ctx.fillText(" z  or tap", x, 140);
}

function drawTrashEffects() {
  trashEffects.forEach(effect => {
    ctx.save();
    ctx.globalAlpha = effect.alpha;
    ctx.beginPath();
    ctx.fillStyle = "white";
    ctx.arc(
      effect.x + tileSize / 2,
      effect.y + tileSize / 2,
      effect.radius,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    // アニメーション更新
    effect.radius += 2;
    effect.alpha -= 0.05;
  });

  // 消えたものを削除
  trashEffects = trashEffects.filter(effect => effect.alpha > 0);
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
  if (isGameOver) return;

  const usedChairIds = customerList.map(c => c.chairId);
  const availableChairs = chairs.filter(chair => !usedChairIds.includes(chair.id));

  if (availableChairs.length > 0) {
    spawnCustomer();
  }

  const nextInterval = getDynamicSpawnTime();
  customerLoopTimer = setTimeout(spawnCustomerLoop, nextInterval); // ← タイマーIDを保存
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

  // 🔁 多重タイマー防止（一番最初に）
  if (customerLoopTimer !== null) {
    clearTimeout(customerLoopTimer); 
    customerLoopTimer = null;
  }

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
