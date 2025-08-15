// compose.js — bg + circular photo + curved text
// Requires: npm i canvas
const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// ====== REGISTER CUSTOM FONT ======
// Make sure the .ttf file is in the same folder or adjust the path
registerFont(path.join(__dirname, 'YourFont.ttf'), { family: 'YourFontName' });

const SIZE = 2048;

// ====== LENS GEOMETRY ======
const INNER_RADIUS     = 417;   // circle size
const CENTER_X_OFFSET  = 0;
const CENTER_Y_OFFSET  = -5;    // moved down by 5px from last version
const PHOTO_NUDGE_X    = 0;
const PHOTO_NUDGE_Y    = 0;
const CLIP_MARGIN      = 2;

const DRAW_RING        = false;
const RING_WIDTH       = 24;
const RING_COLOR       = '#ffffff';

// ====== TEXT ======
const FONT_FAMILY       = 'YourFontName'; // use your registered font here
const FONT_WEIGHT       = 'bold';
const FONT_SIZE         = 136;
const TEXT_COLOR        = '#e6c76f';
const LETTER_SPACING_PX = 8;
const BOTTOM_RADIUS     = 784;
const BOTTOM_CENTER_DEG = 90;

const DEBUG_GUIDE = false;

// ====== ASSETS ======
const BG_PATH = path.join(__dirname, 'bg.png');
const FX_PATH = path.join(__dirname, 'fx.png');

const rad = d => (d * Math.PI) / 180;

function drawArcText(ctx, text, cx, cy, radius, centerAngleRad, color, font, position = 'bottom') {
  if (position === 'bottom') text = [...text].reverse().join('');

  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const widths = [...text].map(ch => ctx.measureText(ch).width);
  const totalWidth = widths.reduce((sum, w, i) => sum + w + (i < widths.length - 1 ? LETTER_SPACING_PX : 0), 0);
  const totalAngle = totalWidth / radius;

  let angle = centerAngleRad - totalAngle / 2;
  const rotOffset = position === 'bottom' ? -Math.PI / 2 : Math.PI / 2;

  for (let i = 0; i < text.length; i++) {
    const w = widths[i];
    angle += (w / 2) / radius;

    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + rotOffset);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();

    angle += (w / 2) / radius;
    if (i < text.length - 1) angle += (LETTER_SPACING_PX / radius);
  }

  ctx.restore();
}

async function compose({ baseBuffer, name, background = 'solid', style = 'default' }) {
  if (!baseBuffer?.length) throw new Error('No logo data received from upload');

  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  // 1) Background
  if (background !== 'transparent') {
    if (!fs.existsSync(BG_PATH)) throw new Error('bg.png not found');
    const bg = await loadImage(BG_PATH);
    ctx.drawImage(bg, 0, 0, SIZE, SIZE);
  } else {
    ctx.clearRect(0, 0, SIZE, SIZE);
  }

  // 2) Photo
  const img = await loadImage(baseBuffer);
  const baseCX = SIZE / 2 + CENTER_X_OFFSET;
  const baseCY = SIZE / 2 + CENTER_Y_OFFSET;
  const imgCX  = baseCX + PHOTO_NUDGE_X;
  const imgCY  = baseCY + PHOTO_NUDGE_Y;

  const rRing = INNER_RADIUS;
  const rClip = Math.max(1, rRing - CLIP_MARGIN);
  const dClip = rClip * 2;
  const scale = Math.max(dClip / img.width, dClip / img.height);
  const drawW = img.width  * scale;
  const drawH = img.height * scale;

  ctx.save();
  ctx.beginPath();
  ctx.arc(imgCX, imgCY, rClip, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, imgCX - drawW / 2, imgCY - drawH / 2, drawW, drawH);
  ctx.restore();

  // 3) Optional ring
  if (DRAW_RING && RING_WIDTH > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(imgCX, imgCY, rRing - RING_WIDTH / 2, 0, Math.PI * 2);
    ctx.strokeStyle = RING_COLOR;
    ctx.lineWidth = RING_WIDTH;
    ctx.stroke();
    ctx.restore();
  }

  // 4) FX overlay
  if (fs.existsSync(FX_PATH)) {
    const fx = await loadImage(FX_PATH);
    ctx.drawImage(fx, 0, 0, SIZE, SIZE);
  }

  // 5) Bottom text
  if (name && name.trim()) {
    const fontSpec = `${FONT_WEIGHT} ${FONT_SIZE}px ${FONT_FAMILY}`;
    drawArcText(
      ctx,
      name.trim().toUpperCase(),
      SIZE / 2, SIZE / 2,
      BOTTOM_RADIUS,
      rad(BOTTOM_CENTER_DEG),
      TEXT_COLOR,
      fontSpec,
      'bottom'
    );
  }

  // 6) Debug
  if (DEBUG_GUIDE) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(baseCX, baseCY, rRing, 0, Math.PI * 2);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 10]);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(baseCX, baseCY, rClip, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.stroke();
    ctx.restore();
  }

  const finalPng = canvas.toBuffer('image/png');
  return { finalPng, previewJpg: finalPng };
}

module.exports = { compose, SIZE };
