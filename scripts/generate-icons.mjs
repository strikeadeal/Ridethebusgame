import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

// scale < 1 shrinks the artwork toward the center (maskable safe zone).
function busSvg(scale = 1) {
  const g = (1 - scale) * 256;
  return `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0a14"/>
  <g transform="translate(${g} ${g}) scale(${scale})">
    <rect x="56" y="128" width="400" height="224" rx="44" fill="none" stroke="#22e6ff" stroke-width="18"/>
    <line x1="72" y1="248" x2="440" y2="248" stroke="#22e6ff" stroke-width="10"/>
    <rect x="104" y="168" width="72" height="52" rx="12" fill="#ff2d78"/>
    <rect x="220" y="168" width="72" height="52" rx="12" fill="#ff2d78"/>
    <rect x="336" y="168" width="72" height="52" rx="12" fill="#ff2d78"/>
    <circle cx="150" cy="376" r="40" fill="#0a0a14" stroke="#a26bff" stroke-width="16"/>
    <circle cx="362" cy="376" r="40" fill="#0a0a14" stroke="#a26bff" stroke-width="16"/>
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
