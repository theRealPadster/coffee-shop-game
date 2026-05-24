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
    ctx.strokeStyle = 'rgba(200,220,255,0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 50; i++) {
      const rx = Math.random() * w;
      const ry = Math.random() * h * 0.6;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 4, ry + 10);
      ctx.stroke();
    }
  } else if (condition === 'snowy') {
    ctx.strokeStyle = 'rgba(60, 80, 95, 0.55)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'white';
    for (let i = 0; i < 40; i++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h * 0.6;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}
