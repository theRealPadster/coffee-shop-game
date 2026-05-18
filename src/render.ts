// Sprite abstraction. v1 implementation = emoji glyphs drawn on canvas.
// Swap implementations later for vector art without touching scene code.

export interface Sprite {
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void;
  width: number;
  height: number;
}

export function emojiSprite(emoji: string, size = 36): Sprite {
  return {
    width: size,
    height: size,
    draw(ctx, x, y) {
      ctx.save();
      ctx.font = `${size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, x, y);
      ctx.restore();
    },
  };
}

// A pool of "person" emoji to give variety.
const PEOPLE_EMOJI = ['🚶', '🚶‍♀️', '🧍', '🚶‍♂️', '🧑', '👩', '👨', '👵', '👴', '🧒'];

export function randomPedestrianSprite(): Sprite {
  const e = PEOPLE_EMOJI[Math.floor(Math.random() * PEOPLE_EMOJI.length)];
  return emojiSprite(e, 40);
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
  // Wooden stand
  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#5a3a1b';
  ctx.fillRect(x, y, w, 6);
  // Counter top
  ctx.fillStyle = '#deb887';
  ctx.fillRect(x - 4, y + h * 0.4, w + 8, 8);
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
  // Sign
  sprites.shopSign.draw(ctx, x + w / 2, y + h * 0.25, 0);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('COFFEE', x + w / 2, y + h * 0.6);
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
  snowy:  [[[0,'#cfd8dc'],[1,'#cfd8dc']], [[0,'#ffffff'],[1,'#ffffff']]],
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
  timeOfDay = 0.5 // 0 = 8:00, 1 = 20:00
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
  if (condition !== 'rainy') {
    const gameHour = 8 + timeOfDay * 12;
    const solarTime = Math.max(0, (gameHour - SUNRISE_HOUR) / (SUNSET_HOUR - SUNRISE_HOUR));
    const arcR = Math.min(w * 0.38, h * 0.48);
    const angle = Math.PI * (1 - solarTime);
    const sunX = w / 2 + arcR * Math.cos(angle);
    const sunY = h * 0.6 - arcR * Math.sin(angle);
    // Larger at dawn/dusk due to atmospheric effect
    const dawnDusk = 1 - Math.sin(solarTime * Math.PI);
    const radius = 22 + 10 * dawnDusk;
    const sunColor = condition === 'snowy' ? '#d0dce8' : colorAt(timeOfDay, SUN_COLOR);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h * 0.6);
    ctx.clip();

    // Soft glow near horizon
    if (dawnDusk > 0.3 && condition !== 'snowy') {
      ctx.globalAlpha = 0.22 * dawnDusk;
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath();
      ctx.arc(sunX, sunY, radius * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.globalAlpha = condition === 'cloudy' ? 0.45 : 1;
    ctx.fillStyle = sunColor;
    ctx.beginPath();
    ctx.arc(sunX, sunY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Sidewalk
  ctx.fillStyle = '#bdbdbd';
  ctx.fillRect(0, h * 0.6, w, h * 0.25);
  // Sidewalk cracks
  ctx.strokeStyle = '#9e9e9e';
  ctx.lineWidth = 1;
  for (let i = 0; i < w; i += 80) {
    ctx.beginPath();
    ctx.moveTo(i, h * 0.6);
    ctx.lineTo(i, h * 0.85);
    ctx.stroke();
  }

  // Road
  ctx.fillStyle = '#37474f';
  ctx.fillRect(0, h * 0.85, w, h * 0.15);
  // Road dashes
  ctx.fillStyle = '#fdd835';
  for (let i = 20; i < w; i += 60) {
    ctx.fillRect(i, h * 0.92, 28, 4);
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
    ctx.fillStyle = 'white';
    for (let i = 0; i < 40; i++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h * 0.6;
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
