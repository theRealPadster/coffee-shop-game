// Sprite abstraction. v1 implementation = emoji glyphs drawn on canvas.
// Swap implementations later for vector art without touching scene code.

export interface Sprite {
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void;
  width: number;
  height: number;
}

export function emojiSprite(emoji: string, size = 36, mirror = false): Sprite {
  return {
    width: size,
    height: size,
    draw(ctx, x, y) {
      ctx.save();
      ctx.font = `${size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Color emoji ignore the fill color but honor its alpha, so an inherited
      // semi-transparent fillStyle would dim the glyph. Force full opacity.
      ctx.fillStyle = '#000';
      if (mirror) {
        ctx.translate(x, y);
        ctx.scale(-1, 1);
        ctx.fillText(emoji, 0, 0);
      } else {
        ctx.fillText(emoji, x, y);
      }
      ctx.restore();
    },
  };
}

// Pedestrian pool. `mirror: true` flips the glyph so default-left-facing
// walking emoji face right, matching customer velocity (always rightward).
const PEDESTRIANS: Array<{ emoji: string; mirror: boolean }> = [
  { emoji: '🚶',     mirror: true  },
  { emoji: '🚶‍♀️', mirror: true  },
  { emoji: '🚶‍♂️', mirror: true  },
  { emoji: '🧍',     mirror: false },
  { emoji: '🧑',     mirror: false },
  { emoji: '👩',     mirror: false },
  { emoji: '👨',     mirror: false },
  { emoji: '👵',     mirror: false },
  { emoji: '👴',     mirror: false },
  { emoji: '🧒',     mirror: false },
];

export function randomPedestrianSprite(): Sprite {
  const p = PEDESTRIANS[Math.floor(Math.random() * PEDESTRIANS.length)];
  return emojiSprite(p.emoji, 40, p.mirror);
}

export const sprites = {
  shop: emojiSprite('☕', 56),
  shopSign: emojiSprite('☕', 28),
  awning: emojiSprite('⛱️', 48),
  buying: emojiSprite('💰', 24),
};

export function drawMenuSign(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  drinkName: string,
  priceText: string,
  isIced: boolean,
): void {
  const w = 96;
  const h = 84;
  const x = cx - w / 2;
  const y = baseY - h;

  // Drop shadow on the sidewalk
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, baseY + 3, w * 0.55, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // A-frame leg behind the board
  ctx.fillStyle = '#7a4a1a';
  ctx.fillRect(cx - 2, y + h - 4, 4, 8);

  // Wooden frame
  ctx.fillStyle = '#5a3a1b';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  // Chalkboard surface
  ctx.fillStyle = '#1d2a22';
  ctx.fillRect(x, y, w, h);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // "— TODAY —" header
  ctx.fillStyle = '#cdb98a';
  ctx.font = 'bold 9px sans-serif';
  ctx.fillText('— TODAY —', cx, y + 6);

  // Drink icon
  ctx.font = '18px serif';
  ctx.fillText(isIced ? '🧊' : '☕', cx, y + 18);

  // Name (truncated to fit)
  let name = drinkName.trim() || 'Untitled';
  if (name.length > 14) name = name.slice(0, 13) + '…';
  ctx.fillStyle = '#fffefa';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText(name, cx, y + 42);

  // Price
  ctx.fillStyle = '#ffe082';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(priceText, cx, y + 58);

  ctx.restore();
}

// A small glass tip jar on the counter, shown when the Tip jar upgrade is
// owned. Placed on the left end of the counter so it's clear of the queue
// slots (which start at counter-center and run rightward) and the menu sign
// to the right of the shop.
export function drawTipJar(ctx: CanvasRenderingContext2D, shopX: number, shopY: number, shopH: number): void {
  const counterTopY = shopY + shopH * 0.4;
  const jarW = 14;
  const jarH = 20;
  const x = shopX + 16;
  const y = counterTopY - jarH;

  ctx.save();
  // Glass body (slightly translucent so wood tone reads through the rim)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.fillRect(x, y + 3, jarW, jarH - 3);
  // Coins piled inside
  ctx.fillStyle = '#f4c542';
  ctx.beginPath();
  ctx.arc(x + 4, y + jarH - 4, 2.2, 0, Math.PI * 2);
  ctx.arc(x + jarW - 4, y + jarH - 5, 2.2, 0, Math.PI * 2);
  ctx.arc(x + jarW / 2, y + jarH - 3, 2.2, 0, Math.PI * 2);
  ctx.fill();
  // Rim — a darker band that reads as the jar's lip
  ctx.fillStyle = '#bcae8f';
  ctx.fillRect(x - 1, y, jarW + 2, 3);
  // "TIPS" label slip
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 1, y + 6, jarW - 2, 7);
  ctx.fillStyle = '#2e7d32';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', x + jarW / 2, y + 9.5);
  // Outline so it pops against the wooden front
  ctx.strokeStyle = 'rgba(60,40,20,0.55)';
  ctx.lineWidth = 0.6;
  ctx.strokeRect(x, y + 3, jarW, jarH - 3);
  ctx.restore();
}

// Cooler sitting on the sidewalk to the left of the stand. Drawn when the
// Cooler is owned and the Refrigerator (which supersedes it) is not.
export function drawCooler(ctx: CanvasRenderingContext2D, shopX: number, shopY: number, shopH: number): void {
  const w = 66;
  const h = 46;
  const x = shopX - w - 4;
  const groundY = shopY + shopH;
  const y = groundY - h;

  ctx.save();
  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, groundY + 2, w * 0.55, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body — light blue
  ctx.fillStyle = '#7ecbe6';
  ctx.fillRect(x, y, w, h);
  // Lid — darker band across the top
  ctx.fillStyle = '#4a9ec0';
  ctx.fillRect(x, y, w, 13);
  // Low-profile rectangular grip on the lid — two short posts and a flat
  // bar across the top. Reads as a chest-cooler handle rather than the
  // arched lunchbox/picnic-basket shape the curve was suggesting.
  ctx.fillStyle = '#37798f';
  const postLeft = x + 18;
  const postRight = x + w - 18;
  const handleTopY = y - 7;
  ctx.fillRect(postLeft - 1.5, handleTopY, 3, 8);                 // left post
  ctx.fillRect(postRight - 1.5, handleTopY, 3, 8);                // right post
  ctx.fillRect(postLeft, handleTopY, postRight - postLeft, 3);    // top bar
  // Snowflake decal
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('❄', x + w / 2, y + h * 0.65);
  // Outline
  ctx.strokeStyle = 'rgba(20,40,60,0.5)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

// Refrigerator sitting on the sidewalk to the left of the stand. Supersedes
// the Cooler visually — only one of the two is drawn at a time.
export function drawRefrigerator(ctx: CanvasRenderingContext2D, shopX: number, shopY: number, shopH: number): void {
  const w = 56;
  const h = 92;
  const x = shopX - w - 4;
  const groundY = shopY + shopH;
  const y = groundY - h;

  ctx.save();
  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, groundY + 2, w * 0.55, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body — off-white
  ctx.fillStyle = '#f0f2f5';
  ctx.fillRect(x, y, w, h);
  // Right-side shading band for depth
  ctx.fillStyle = '#d4d8de';
  ctx.fillRect(x + w - 6, y, 6, h);
  // Freezer / fridge divider
  const freezerY = y + 24;
  ctx.strokeStyle = '#bfc4cc';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, freezerY);
  ctx.lineTo(x + w, freezerY);
  ctx.stroke();
  // Door handles on the right
  ctx.fillStyle = '#a8aeb6';
  ctx.fillRect(x + w - 14, y + 6, 4, 12);           // freezer handle
  ctx.fillRect(x + w - 14, freezerY + 8, 4, 28);    // fridge handle
  // Snowflake on freezer door
  ctx.fillStyle = '#5fb2d4';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('❄', x + w / 2 - 4, y + 13);
  // Outline
  ctx.strokeStyle = 'rgba(40,50,60,0.45)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

export function drawShop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  // Ground shadow under the stand
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h + 3, w * 0.55, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wooden stand front
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(x, y, w, h);
  // Darker right edge for depth
  ctx.fillStyle = '#6b4520';
  ctx.fillRect(x + w - 6, y, 6, h);
  // Top trim
  ctx.fillStyle = '#5a3a1b';
  ctx.fillRect(x, y, w, 6);

  // Front-panel inset (subtle paneling)
  ctx.strokeStyle = '#6b4520';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 8, y + h * 0.55, w - 22, h * 0.35);

  // Counter top with slight bevel
  ctx.fillStyle = '#deb887';
  ctx.fillRect(x - 4, y + h * 0.4, w + 8, 8);
  ctx.fillStyle = '#c19c6b';
  ctx.fillRect(x - 4, y + h * 0.4 + 6, w + 8, 2);

  // Awning
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(x - 6, y);
  ctx.lineTo(x + w + 6, y);
  ctx.lineTo(x + w - 4, y - 18);
  ctx.lineTo(x + 4, y - 18);
  ctx.closePath();
  ctx.fill();
  // Awning stripes
  ctx.fillStyle = 'white';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(x + 6 + i * 24, y - 18, 8, 18);
  }
  // Awning shadow under the lip
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(x - 6, y, w + 12, 3);

  // Sign
  sprites.shopSign.draw(ctx, x + w / 2, y + h * 0.25, 0);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('COFFEE', x + w / 2, y + h * 0.6);
}

// Cloud shape library — each entry is a list of [dx, dy, rRatio] bumps.
// Bumps are tuned so each shape has a flat-ish bottom (dy + rRatio ≈ 0.3,
// the cumulus condensation line) with the puffy variation on top.
const CLOUD_SHAPES: Array<Array<[number, number, number]>> = [
  // 0: classic 4-bump cumulus
  [[-0.90, -0.40, 0.70], [-0.20, -0.65, 0.95], [0.45, -0.50, 0.80], [1.00, -0.35, 0.65]],
  // 1: long & low stratus
  [[-1.40, -0.25, 0.55], [-0.70, -0.40, 0.70], [0.00, -0.40, 0.70], [0.70, -0.35, 0.65], [1.40, -0.20, 0.50]],
  // 2: tall lumpy cumulus
  [[-0.50, -0.40, 0.70], [-0.15, -0.65, 0.95], [0.30, -0.45, 0.75], [0.60, -0.55, 0.85]],
  // 3: small wispy 3-bump
  [[-0.55, -0.25, 0.55], [0.00, -0.45, 0.75], [0.55, -0.30, 0.60]],
  // 4: asymmetric — heavy on left, trailing wisp on right
  [[-0.85, -0.40, 0.70], [-0.40, -0.65, 0.95], [0.10, -0.55, 0.85], [0.55, -0.30, 0.60]],
];

// Raindrops grouped into depth bands for parallax: far drops are slow, short,
// thin, and faint; near drops are fast, long, thicker, and more visible.
interface Raindrop {
  x: number; yOffset: number; speed: number;
  length: number; width: number; alpha: number;
}
const RAINDROPS: Raindrop[] = (() => {
  const out: Raindrop[] = [];
  const bands = [
    { count: 28, speed: 260, speedJitter: 60,  length: 8,  width: 0.6, alpha: 0.22 }, // far
    { count: 36, speed: 430, speedJitter: 90,  length: 14, width: 1.0, alpha: 0.40 }, // mid
    { count: 22, speed: 620, speedJitter: 120, length: 22, width: 1.3, alpha: 0.55 }, // near
  ];
  let i = 0;
  for (const b of bands) {
    for (let k = 0; k < b.count; k++, i++) {
      const r1 = Math.abs((Math.sin(i * 17.31) * 28371.13) % 1);
      const r2 = Math.abs((Math.sin(i * 51.77) * 91234.56) % 1);
      const r3 = Math.abs((Math.sin(i * 33.21) * 47811.02) % 1);
      out.push({
        x: r1,
        yOffset: r2,
        speed: b.speed + r3 * b.speedJitter,
        length: b.length,
        width: b.width,
        alpha: b.alpha,
      });
    }
  }
  return out;
})();

// Snowflakes: deterministic lanes so they fall steadily and freeze on pause.
// Each flake has a fixed x lane, an initial y offset, a per-flake fall speed,
// a radius, and a sway phase for gentle horizontal drift.
const SNOWFLAKES: Array<{
  x: number; yOffset: number; speed: number; size: number; swayPhase: number;
}> = (() => {
  const out = [];
  for (let i = 0; i < 35; i++) {
    // Cheap deterministic pseudo-random based on i.
    const r1 = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const r2 = (Math.sin(i * 78.233)  * 12345.6789) % 1;
    const r3 = (Math.sin(i * 9.45)    * 5432.21)    % 1;
    out.push({
      x: Math.abs(r1),
      yOffset: Math.abs(r2),
      speed: 18 + Math.abs(r3) * 22, // 18–40 px/sec
      size: 1.6 + Math.abs(r3) * 1.4,
      swayPhase: Math.abs(r1) * Math.PI * 2,
    });
  }
  return out;
})();

function drawCloud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  shapeIdx: number,
  stretch = 1,
): void {
  const shape = CLOUD_SHAPES[shapeIdx % CLOUD_SHAPES.length];
  ctx.beginPath();
  for (const [dx, dy, rr] of shape) {
    ctx.arc(cx + dx * r * stretch, cy + dy * r, rr * r, 0, Math.PI * 2);
  }
  ctx.fill();
}

// Distant city silhouette drawn at the horizon line behind the shop.
// Deterministic per pixel column so it doesn't flicker.
function drawCitySilhouette(
  ctx: CanvasRenderingContext2D,
  w: number,
  horizonY: number,
  baseColor: string,
): void {
  ctx.save();
  ctx.fillStyle = baseColor;
  const widths = [54, 38, 70, 46, 60, 32, 78, 50, 42, 66];
  const heights = [48, 64, 36, 72, 52, 80, 44, 58, 40, 68];
  let bx = -12;
  let i = 0;
  while (bx < w + 20) {
    const bw = widths[i % widths.length];
    const bh = heights[(i * 3 + 1) % heights.length];
    ctx.fillRect(bx, horizonY - bh, bw, bh);
    bx += bw - 4; // slight overlap so they read as a continuous skyline
    i++;
  }
  ctx.restore();
}

// Interpolate between two hex colours by fraction t (0–1).
function lerpHex(c1: string, c2: string, t: number): string {
  const f = (s: string, o: number) => parseInt(s.slice(o, o + 2), 16);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
  return `#${mix(f(c1,1),f(c2,1))}${mix(f(c1,3),f(c2,3))}${mix(f(c1,5),f(c2,5))}`;
}

// Pick a colour from a multi-stop gradient at position t (0–1).
function colorAt(t: number, stops: [number, string][]): string {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t <= stops[i + 1][0]) {
      const f = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
      return lerpHex(stops[i][1], stops[i + 1][1], f);
    }
  }
  return stops[stops.length - 1][1];
}

// Sky colour stops per weather condition: [time, topColour, botColour]
const SKY: Record<string, [[number, string][], [number, string][]]> = {
  sunny: [
    [[0,'#e87c3e'],[0.15,'#5ab4e0'],[0.45,'#87ceeb'],[0.55,'#87ceeb'],[0.85,'#5ab4e0'],[1,'#e87c3e']],
    [[0,'#ffd17a'],[0.15,'#c0e8f8'],[0.45,'#e0f6ff'],[0.55,'#e0f6ff'],[0.85,'#c0e8f8'],[1,'#ffd17a']],
  ],
  cloudy: [
    [[0,'#8d6e63'],[0.15,'#9ba8af'],[0.45,'#b0bec5'],[0.55,'#b0bec5'],[0.85,'#9ba8af'],[1,'#8d6e63']],
    [[0,'#d4a070'],[0.15,'#d0d8dc'],[0.45,'#eceff1'],[0.55,'#eceff1'],[0.85,'#d0d8dc'],[1,'#d4a070']],
  ],
  rainy:  [[[0,'#546e7a'],[1,'#546e7a']], [[0,'#90a4ae'],[1,'#90a4ae']]],
  snowy:  [[[0,'#6b7a85'],[1,'#6b7a85']], [[0,'#a4b3bd'],[1,'#a4b3bd']]],
};

const SUNRISE_HOUR = 7;
const SUNSET_HOUR  = 19;

const SUN_COLOR: [number, string][] = [
  [0,'#ff7a1a'],[0.12,'#ffb347'],[0.3,'#fff176'],[0.7,'#fff176'],[0.88,'#ffb347'],[1,'#ff7a1a'],
];

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  condition: string,
  timeOfDay = 0.5, // 0 = 8:00, 1 = 20:00
  elapsedMs = 0    // pause-aware game time, used for cloud drift
): void {
  const sky = SKY[condition] ?? SKY.sunny;
  const skyTop = colorAt(timeOfDay, sky[0]);
  const skyBot = colorAt(timeOfDay, sky[1]);

  const grad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  grad.addColorStop(0, skyTop);
  grad.addColorStop(1, skyBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h * 0.6);

  // Sun arc: solar day runs 6am→6pm independent of shop hours (8am–8pm).
  // gameHour = 8 + timeOfDay*12, so solarTime = (gameHour - 6) / 12.
  // At noon (gameHour=12), solarTime=0.5 → sun is dead center.
  // Sun is already risen when shop opens; sets ~6pm while shop still runs.
  {
    const gameHour = 8 + timeOfDay * 12;
    const solarTime = Math.max(0, (gameHour - SUNRISE_HOUR) / (SUNSET_HOUR - SUNRISE_HOUR));
    const arcR = Math.min(w * 0.38, h * 0.48);
    const angle = Math.PI * (1 - solarTime);
    const sunX = w / 2 + arcR * Math.cos(angle);
    const sunY = h * 0.6 - arcR * Math.sin(angle);
    // Larger at dawn/dusk due to atmospheric effect
    const dawnDusk = 1 - Math.sin(solarTime * Math.PI);
    const radius = 22 + 10 * dawnDusk;
    const sunColor =
      condition === 'snowy' || condition === 'rainy'
        ? '#d0dce8'
        : colorAt(timeOfDay, SUN_COLOR);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h * 0.6);
    ctx.clip();

    // Soft glow near horizon
    if (dawnDusk > 0.3 && condition !== 'snowy' && condition !== 'rainy') {
      ctx.globalAlpha = 0.22 * dawnDusk;
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath();
      ctx.arc(sunX, sunY, radius * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = condition === 'rainy' ? 0.3 : condition === 'cloudy' ? 0.45 : 1;
    ctx.fillStyle = sunColor;
    ctx.beginPath();
    ctx.arc(sunX, sunY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Clouds (skip for rainy — the flat overcast sky reads better on its own)
  if (condition !== 'rainy') {
    // Each cloud: [xFrac, yFrac, sizeMul, shapeIdx, stretch, alpha, speedPxPerSec]
    // Larger clouds drift faster (parallax: they "feel" closer).
    const sunnyClouds: Array<[number, number, number, number, number, number, number]> = [
      [0.08, 0.13, 0.85, 3, 1.0, 0.85,  7],
      [0.27, 0.07, 1.30, 1, 1.1, 0.75, 12],
      [0.55, 0.18, 1.00, 0, 1.0, 0.90,  9],
      [0.78, 0.09, 0.75, 2, 1.0, 0.80,  6],
      [0.93, 0.20, 0.95, 4, 0.9, 0.70,  8],
    ];
    const cloudyClouds: Array<[number, number, number, number, number, number, number]> = [
      [0.05, 0.10, 1.20, 1, 1.2, 0.85, 10],
      [0.24, 0.20, 0.95, 4, 1.0, 0.78,  8],
      [0.46, 0.07, 1.50, 0, 1.1, 0.90, 13],
      [0.66, 0.22, 1.05, 2, 0.95, 0.80, 9],
      [0.84, 0.12, 1.10, 1, 1.0, 0.88, 11],
      [0.96, 0.25, 0.70, 3, 1.0, 0.75,  6],
    ];
    const snowyClouds: Array<[number, number, number, number, number, number, number]> = [
      [0.15, 0.10, 1.10, 1, 1.15, 0.55,  9],
      [0.50, 0.18, 1.30, 0, 1.0, 0.60, 11],
      [0.82, 0.08, 0.85, 2, 1.0, 0.55,  7],
    ];
    const clouds =
      condition === 'cloudy' ? cloudyClouds :
      condition === 'snowy'  ? snowyClouds  : sunnyClouds;
    // Wrap with margin so clouds glide off-screen on the right before
    // reappearing on the left, instead of popping at the edge.
    const margin = 120;
    const wrapW = w + margin * 2;
    const tSec = elapsedMs / 1000;
    for (const [fx, fy, fs, idx, stretch, alpha, speed] of clouds) {
      const drift = tSec * speed;
      const x = ((fx * w + drift + margin) % wrapW + wrapW) % wrapW - margin;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      drawCloud(ctx, x, fy * h, 22 * fs, idx, stretch);
    }
    ctx.globalAlpha = 1;
  }

  // Distant city silhouette at the horizon, tinted toward the sky for haze.
  // Opaque so it occludes the sun; the heavy sky-blend gives the distant feel.
  drawCitySilhouette(ctx, w, h * 0.6, lerpHex(skyBot, '#39455a', 0.22));

  // Sidewalk — flat concrete with a vertical gradient (lighter at back, darker toward curb)
  const sidewalkTop = h * 0.6;
  const sidewalkBot = h * 0.74;
  const sidewalkH = sidewalkBot - sidewalkTop;
  const sidewalkGrad = ctx.createLinearGradient(0, sidewalkTop, 0, sidewalkBot);
  sidewalkGrad.addColorStop(0, '#d4d0c8');
  sidewalkGrad.addColorStop(1, '#b8b3a9');
  ctx.fillStyle = sidewalkGrad;
  ctx.fillRect(0, sidewalkTop, w, sidewalkH);

  // Subtle warm trim line at the building edge
  ctx.fillStyle = 'rgba(120, 100, 80, 0.18)';
  ctx.fillRect(0, sidewalkTop, w, 2);

  // Curb: a small raised lip with highlight on top and dark face below
  const curbY = sidewalkBot - 6;
  ctx.fillStyle = '#9a948a';
  ctx.fillRect(0, curbY, w, 6);
  ctx.fillStyle = '#cfc9bf';
  ctx.fillRect(0, curbY, w, 1); // top highlight
  ctx.fillStyle = '#5e5950';
  ctx.fillRect(0, sidewalkBot, w, 2); // shadow into the road

  // Road — asphalt with a centered dashed yellow line
  ctx.fillStyle = '#3b424a';
  ctx.fillRect(0, sidewalkBot + 2, w, h - (sidewalkBot + 2));
  // Subtle lighter asphalt top edge
  ctx.fillStyle = '#4a525c';
  ctx.fillRect(0, sidewalkBot + 2, w, 3);
  // Centered dashed yellow line
  const roadMid = sidewalkBot + 2 + (h - (sidewalkBot + 2)) * 0.5;
  ctx.fillStyle = '#f5c842';
  for (let i = 20; i < w; i += 60) {
    ctx.fillRect(i, roadMid - 2, 28, 4);
  }

  // Weather overlays
  if (condition === 'rainy') {
    const tSec = elapsedMs / 1000;
    const fallH = h * 0.6 + 24;
    ctx.lineCap = 'round';
    // Wind lean: same direction & ratio for every drop so the rain reads as one weather pattern.
    // Drops travel along the same vector as their streak (vx = -leanRatio * vy)
    // so the visible trail matches the actual motion path.
    const leanRatio = 0.22;
    for (const d of RAINDROPS) {
      const vy = d.speed;
      const vx = -leanRatio * vy;
      const baseX = d.x * w;
      const y = (d.yOffset * fallH + vy * tSec) % fallH;
      const x = ((baseX + vx * tSec) % w + w) % w;
      const dx = -d.length * leanRatio;
      const dy = d.length;
      ctx.strokeStyle = `rgba(180, 210, 240, ${d.alpha})`;
      ctx.lineWidth = d.width;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + dy);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  } else if (condition === 'snowy') {
    ctx.strokeStyle = 'rgba(60, 80, 95, 0.55)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'white';
    const tSec = elapsedMs / 1000;
    const fallH = h * 0.6 + 12; // sky band plus a small overlap for wrap
    for (const f of SNOWFLAKES) {
      const y = (f.yOffset * fallH + f.speed * tSec) % fallH;
      const sway = Math.sin(tSec * 0.6 + f.swayPhase) * 6;
      const x = (f.x * w + sway + w) % w;
      ctx.beginPath();
      ctx.arc(x, y, f.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}
