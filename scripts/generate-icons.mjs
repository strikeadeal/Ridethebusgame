import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

// scale < 1 shrinks the artwork toward the center (maskable safe zone).
function busSvg(scale = 1) {
  const g = (1 - scale) * 256;
  return `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="felt" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="#2a5a42"/>
      <stop offset="55%" stop-color="#1e4433"/>
      <stop offset="100%" stop-color="#0e2018"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#felt)"/>
  <g transform="translate(${g} ${g}) scale(${scale})">
    <circle cx="256" cy="256" r="226" fill="none" stroke="#b08d4f" stroke-width="10"/>
    <circle cx="256" cy="256" r="210" fill="none" stroke="#e2c37f" stroke-width="3"/>
    <rect x="96" y="152" width="320" height="180" rx="34" fill="none" stroke="#d4af5f" stroke-width="16"/>
    <line x1="110" y1="248" x2="402" y2="248" stroke="#d4af5f" stroke-width="9"/>
    <rect x="134" y="184" width="58" height="42" rx="9" fill="#f4ecd9"/>
    <rect x="227" y="184" width="58" height="42" rx="9" fill="#f4ecd9"/>
    <rect x="320" y="184" width="58" height="42" rx="9" fill="#f4ecd9"/>
    <circle cx="172" cy="352" r="32" fill="#1e4433" stroke="#b08d4f" stroke-width="13"/>
    <circle cx="340" cy="352" r="32" fill="#1e4433" stroke="#b08d4f" stroke-width="13"/>
  </g>
</svg>`;
}

await mkdir('public', { recursive: true });
const normal = Buffer.from(busSvg());
const maskable = Buffer.from(busSvg(0.72));

await sharp(normal).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(normal).resize(512, 512).png().toFile('public/icon-512.png');
await sharp(maskable).resize(512, 512).png().toFile('public/icon-512-maskable.png');
await sharp(normal).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('icons written to public/');
