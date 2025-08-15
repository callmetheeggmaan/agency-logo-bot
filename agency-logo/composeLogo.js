// composeLogo.js — bg + circular photo + inner ring + CURVED bottom text (upright, proper order)
// Requires: npm i canvas
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');

// ===== TUNING (for a 1024×1024 badge) =====
const CANVAS = 1024;

// Center photo (lens)
const INNER_RADIUS = 205;   // 195–225 to fit lens
const CENTER_X_OFFSET = 0;  // +right / -left
const CENTER_Y_OFFSET = -6; // +down  / -up

// Inner white ring
const RING_WIDTH = 12;      // 0 = off
const RING_COLOR = '#ffffff';

// Bottom curved text
const BOTTOM_TEXT   = 'EGG TEST';
const FONT_FAMILY   = 'Arial'; // swap to your installed font if you want
const FONT_WEIGHT   = 'bold';
const FONT_SIZE     = 68;
const TEXT_COLOR    = '#e6c76f';

// Curve geometry (match “STREAMER” arc)
// ↑ Increase BOTTOM_RADIUS to move text DOWN; decrease to move it UP.
const BOTTOM_RADIUS     = 392;  // try 380–410 to nail the vertical position
const BOTTOM_CENTER_DEG = 90;   // 90° = bottom center; tweak 88–92 if slightly off-center
const LETTER_SPACING_PX = 4;    // extra spacing between letters (0–6 usually looks good)
// =========================================

const CX = CANVAS / 2 + CENTER_X_OFFSET;
const CY = CANVAS / 2 + CENTER_Y_OFFSET;
const rad = d => (d * Math.PI) / 180;

// Draw text along an arc. For 'bottom', reverse chars and rotate for upright reading.
function drawArcText(ctx, text, cx, cy, radius, centerAngleRad, color, font, position = 'bottom') {
  if (position === 'bottom') text = [...text].reverse().join('');

  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // measure widths + add custom letter spacing
  const widths = [...text].map(ch => ctx.measureText(ch).width);
  const totalWidth =
    widths.reduce((sum, w, i) => sum + w + (i < widths.length - 1 ? LETTER_SPACING_PX : 0), 0);

  const totalAngle = totalWidth / radius;
  let angle = centerAngleRad - totalAngle / 2;

  // rotation offset: bottom uses −π/2 so letters are upright; top would use +π/2
  const rotOffset = position === 'bottom' ? -Math.PI / 2 : Math.PI / 2;

  for (let i = 0; i < text.length; i++) {
    const w = widths[i];

    // advance half glyph
    angle += (w / 2) / radius;

    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + rotOffset);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();

    // advance half glyph + spacing
    angle += (w / 2) / radius;
    if (i < text.length - 1) angle += (LETTER_SPACING_PX / radius);
  }

  ctx.restore();
}

async function run() {
  const canvas = createCanvas(CANVAS, CANVAS);
  const ctx = canvas.getContext('2d');

  // load assets
  const bg   = await loadImage('bg.png');   // badge background
  const mark = await loadImage('mark.png'); // center photo

  // background
  ctx.drawImage(bg, 0, 0, CANVAS, CANVAS);

  // circular photo (cover fit)
  const r = INNER_RADIUS;
  const d = r * 2;
  const scale = Math.max(d / mark.width, d / mark.height);
  const w = mark.width * scale;
  const h = mark.height * scale;

  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(mark, CX - w / 2, CY - h / 2, w, h);
  ctx.restore();

  // inner ring
  if (RING_WIDTH > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, r - RING_WIDTH / 2, 0, Math.PI * 2);
    ctx.strokeStyle = RING_COLOR;
    ctx.lineWidth = RING_WIDTH;
    ctx.stroke();
    ctx.restore();
  }

  // bottom curved text (upright, correct order)
  const fontSpec = `${FONT_WEIGHT} ${FONT_SIZE}px ${FONT_FAMILY}`;
  drawArcText(
    ctx,
    BOTTOM_TEXT,
    CANVAS / 2, CANVAS / 2,
    BOTTOM_RADIUS,
    rad(BOTTOM_CENTER_DEG),
    TEXT_COLOR,
    fontSpec,
    'bottom'
  );

  fs.writeFileSync('debug-final.png', canvas.toBuffer('image/png'));
  console.log('✅ Saved debug-final.png');
}

run().catch(err => { console.error(err); process.exit(1); });
