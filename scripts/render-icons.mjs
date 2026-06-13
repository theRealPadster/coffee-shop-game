// One-off helper: regenerates the PNG home-screen icons from assets/icon.svg
// using @resvg/resvg-js (wasm, no native deps). Not part of the build —
// developers only need to run this when icon.svg changes.
//
//   npm install --no-save @resvg/resvg-js
//   node scripts/render-icons.mjs
//
// Writes public/icon-192.png, public/icon-512.png, public/apple-touch-icon.png
// (180×180). The 192 and 512 sizes are what the web manifest needs for
// Android/Chrome PWA install; 180 is the iOS apple-touch-icon size. The
// source SVG lives outside public/ so it doesn't get shipped to the
// deployed site — it's a source asset, not a runtime one.

import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync(new URL('../assets/icon.svg', import.meta.url));

const targets = [
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['public/apple-touch-icon.png', 180],
];

for (const [path, size] of targets) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  writeFileSync(new URL(`../${path}`, import.meta.url), resvg.render().asPng());
  console.log(`wrote ${path} (${size}×${size})`);
}
