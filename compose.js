const { createCanvas, loadImage } = require('canvas');
const path = require('path');

// Use a safe built-in font so we don't need a .ttf file
const FONT_FAMILY = 'sans-serif';

// Your existing composition function
async function compose(avatarUrl, username) {
    const canvas = createCanvas(512, 512);
    const ctx = canvas.getContext('2d');

    // Background fill
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Load avatar/logo
    const avatar = await loadImage(avatarUrl);
    ctx.drawImage(avatar, 0, 0, 512, 512);

    // Add username text
    ctx.font = `40px ${FONT_FAMILY}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(username, canvas.width / 2, canvas.height - 30);

    return canvas.toBuffer();
}

module.exports = { compose };
