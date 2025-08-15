// bot.js — role-gated workflow: save to /output, DM user, post preview, log
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, AttachmentBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { request } = require('undici');
const { compose } = require('./compose');            // ← uses your canvas-based compose
const { createCanvas, loadImage } = require('canvas');

const {
  DISCORD_TOKEN,
  STAFF_ROLE_ID,        // role allowed to use /agencylogo (admins always allowed)
  OUTPUT_CHANNEL_ID,    // optional: channel to post a small preview
} = process.env;

if (!DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN in .env');
  process.exit(1);
}

// Ensure output dir exists
const OUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => console.log(`✅ Logged in as ${client.user.tag}`));

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    return interaction.reply('Pong 🏓');
  }

  if (interaction.commandName === 'agencylogo') {
    // ---- Role gate (server only) ----
    if (interaction.inGuild()) {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);
      const isStaff = STAFF_ROLE_ID ? member.roles.cache.has(STAFF_ROLE_ID) : false;
      if (!isAdmin && !isStaff) {
        return interaction.reply({ content: 'Sorry, this command is staff-only.', ephemeral: true });
      }
    }

    // ---- Read options ----
    const upload = interaction.options.getAttachment('upload', true);
    const name = (interaction.options.getString('name', true) || '').trim();
    const background = interaction.options.getString('background') || 'solid'; // 'solid' | 'transparent'
    const style = interaction.options.getString('style') || 'default';         // matches compose.js presets
    const size = interaction.options.getInteger('size') || 1024;               // 512 | 1024 | 2048

    await interaction.deferReply();

    try {
      // Validate file type
      if (!upload?.contentType?.startsWith('image/')) {
        throw new Error('Upload must be an image file (png/jpg/webp).');
      }

      // Fetch attachment
      const res = await request(upload.url);
      if (res.statusCode !== 200) throw new Error(`Failed to fetch upload: ${res.statusCode}`);
      const baseBuffer = Buffer.from(await res.body.arrayBuffer());
      if (!baseBuffer.length) throw new Error('Downloaded zero bytes from attachment');

      console.log('[agencylogo]', {
        by: `${interaction.user.tag} (${interaction.user.id})`,
        guild: interaction.guild?.name || 'DM',
        len: baseBuffer.length, background, style, size, name
      });

      // ---- Compose at full size (2048), then downscale if requested ----
      const { finalPng: fullPng } = await compose({ baseBuffer, name, background, style });

      // Downscale to requested size (keeps PNG)
      const target = Math.min(Math.max(size, 256), 2048);
      let finalPng = fullPng;
      if (target !== 2048) {
        const src = await loadImage(fullPng);
        const c = createCanvas(target, target);
        const ctx = c.getContext('2d');
        ctx.drawImage(src, 0, 0, target, target);
        finalPng = c.toBuffer('image/png');
      }

      // Small preview (PNG for transparent bg, JPEG otherwise)
      const previewSize = 512;
      const pCanvas = createCanvas(previewSize, previewSize);
      const pCtx = pCanvas.getContext('2d');
      const pImg = await loadImage(finalPng);
      pCtx.drawImage(pImg, 0, 0, previewSize, previewSize);
      const previewIsPng = background === 'transparent';
      const previewBuf = previewIsPng
        ? pCanvas.toBuffer('image/png')
        : pCanvas.toBuffer('image/jpeg', { quality: 0.9 });

      // ---- Save to disk ----
      const safe = s => (s || 'logo').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g,'').slice(0, 40);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseName = `AGENCY-${safe(name)}-${safe(interaction.user.username)}-${stamp}-${target}`;
      const fullPath = path.join(OUT_DIR, `${baseName}.png`);
      fs.writeFileSync(fullPath, finalPng);

      // ---- Reply in channel ----
      const embed = new EmbedBuilder()
        .setTitle(`Agency Logo • ${name || 'Untitled'}`)
        .setDescription(`Style: **${style}** • Background: **${background}** • Size: **${target}px**`)
        .setFooter({ text: `Saved → output/${baseName}.png` });

      const files = [
        new AttachmentBuilder(previewBuf, { name: `${baseName}-preview.${previewIsPng ? 'png' : 'jpg'}` }),
        new AttachmentBuilder(finalPng,   { name: `${baseName}.png` }),
      ];

      await interaction.editReply({ embeds: [embed], files });

      // ---- DM user (best effort) ----
      try {
        await interaction.user.send({
          content: `Here’s your badge • **${name}**`,
          files: [new AttachmentBuilder(finalPng, { name: `${baseName}.png` })],
        });
      } catch {
        console.warn('DM failed (user likely has DMs off).');
      }

      // ---- Optional: post preview to a channel ----
      if (OUTPUT_CHANNEL_ID) {
        try {
          const ch = await client.channels.fetch(OUTPUT_CHANNEL_ID);
          if (ch?.isTextBased()) {
            await ch.send({
              content: `New agency badge: **${name}** by <@${interaction.user.id}>`,
              files: [new AttachmentBuilder(previewBuf, { name: `${baseName}-preview.${previewIsPng ? 'png' : 'jpg'}` })],
            });
          }
        } catch (e) {
          console.warn('Posting to OUTPUT_CHANNEL_ID failed:', e?.message);
        }
      }

      console.log(`✅ Saved ${fullPath}`);
    } catch (e) {
      console.error('❌ Error:', e);
      await interaction.editReply(`Failed to generate: ${e?.message || 'Unknown error'}`);
    }
  }
});

client.login(DISCORD_TOKEN);

// keep process alive on Windows
setInterval(() => {}, 1 << 30);
