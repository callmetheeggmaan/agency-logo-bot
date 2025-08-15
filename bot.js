// bot.js
// Node 20+ required (you set "engines": { "node": ">=20" } in package.json)
// Env needed: DISCORD_TOKEN, (optional) STAFF_ROLE_ID
// Commands must already be registered by your register.js

const { Client, GatewayIntentBits, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

const { compose } = require('./compose'); // <-- your compose.js (uses sans-serif font)

// ---------- Config ----------
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB limit to avoid abuse/timeouts
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']); // no gifs
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || ''; // optional gate

// ---------- Client ----------
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Small helper: fetch -> Buffer with timeout (Node 20 has global fetch + AbortController)
async function downloadToBuffer(url, timeoutMs = 25000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} when downloading image`);
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  } finally {
    clearTimeout(t);
  }
}

function memberHasStaff(member) {
  if (!STAFF_ROLE_ID) return true; // no gate configured
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles.cache.has(STAFF_ROLE_ID);
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // /ping
  if (interaction.commandName === 'ping') {
    await interaction.reply({ content: 'Pong 🏓', ephemeral: false });
    return;
  }

  // /agencylogo
  if (interaction.commandName === 'agencylogo') {
    // 1) Permission gate (optional)
    if (!memberHasStaff(interaction.member)) {
      await interaction.reply({ content: '🚫 You do not have permission to use this command.', ephemeral: true });
      return;
    }

    // 2) Read options
    const name = interaction.options.getString('name') || '';
    const background = interaction.options.getString('background') || 'solid';
    const attachment = interaction.options.getAttachment('image');

    // 3) Validate inputs
    if (!attachment) {
      await interaction.reply({ content: '❌ You must attach an image (PNG/JPG/WebP).', ephemeral: true });
      return;
    }
    if (attachment.size > MAX_UPLOAD_BYTES) {
      await interaction.reply({ content: `❌ Image too large. Max ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.`, ephemeral: true });
      return;
    }
    if (attachment.contentType && !ALLOWED_MIME.has(attachment.contentType)) {
      await interaction.reply({ content: '❌ Unsupported image type. Use PNG, JPG, or WebP.', ephemeral: true });
      return;
    }

    // 4) ACK within 3 seconds
    await interaction.deferReply(); // public reply (not ephemeral) so users see the image

    try {
      // 5) Download user image with timeout
      const baseBuffer = await downloadToBuffer(attachment.url, 25000);

      // 6) Compose final logo (compose.js must export { compose })
      const { finalPng } = await compose({
        baseBuffer,
        name,
        background
      });

      // 7) Send final image
      const file = new AttachmentBuilder(finalPng, { name: `agency-logo-${Date.now()}.png` });
      await interaction.editReply({
        content: `Here’s your badge • **${name || 'NO NAME'}**`,
        files: [file]
      });
    } catch (err) {
      console.error('[agencylogo]', err);
      const msg = (err && err.message) ? err.message : 'Unknown error';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: `❌ Failed to generate: ${msg}` });
      } else {
        await interaction.reply({ content: `❌ Failed to generate: ${msg}`, ephemeral: true });
      }
    }
  }
});

// Global safety nets so crashes don’t kill the process silently
process.on('unhandledRejection', (e) => console.error('UNHANDLED_REJECTION', e));
process.on('uncaughtException', (e) => console.error('UNCAUGHT_EXCEPTION', e));

client.login(process.env.DISCORD_TOKEN);
