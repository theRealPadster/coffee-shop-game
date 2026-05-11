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
  for (let i = 0; i < 4; i++) {
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

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  condition: string,
  timeOfDay = 0.5 // 0 = 8:00, 1 = 20:00
): void {
  const isDawnDusk = timeOfDay < 0.13 || timeOfDay > 0.87;

  // Sky gradient — warm at dawn/dusk, blue at midday
  let skyTop: string, skyBot: string;
  if (condition === 'rainy') { skyTop = '#546e7a'; skyBot = '#90a4ae'; }
  else if (condition === 'snowy') { skyTop = '#cfd8dc'; skyBot = '#ffffff'; }
  else if (condition === 'cloudy') {
    skyTop = isDawnDusk ? '#8d6e63' : '#b0bec5';
    skyBot = isDawnDusk ? '#d4a070' : '#eceff1';
  } else {
    skyTop = isDawnDusk ? '#e87c3e' : '#87ceeb';
    skyBot = isDawnDusk ? '#ffd17a' : '#e0f6ff';
  }
  const grad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  grad.addColorStop(0, skyTop);
  grad.addColorStop(1, skyBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h * 0.6);

  // Sun arc: rises left at 8:00, peaks centre at noon, sets right at 20:00
  if (condition !== 'rainy') {
    const arcR = Math.min(w * 0.38, h * 0.48);
    const angle = Math.PI * (1 - timeOfDay); // π → 0 as day progresses
    const sunX = w / 2 + arcR * Math.cos(angle);
    const sunY = h * 0.6 - arcR * Math.sin(angle);
    ctx.globalAlpha = condition === 'cloudy' ? 0.45 : 1;
    ctx.fillStyle = isDawnDusk ? '#ff9a3c' : (condition === 'snowy' ? '#d0dce8' : '#fff176');
    ctx.beginPath();
    ctx.arc(sunX, sunY, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
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
