// bot.js
// Node 20+ (you set "engines": { "node": ">=20" } in package.json)

const {
  Client,
  GatewayIntentBits,
  AttachmentBuilder,
  PermissionFlagsBits
} = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

const { compose } = require('./compose'); // your composer (uses sans-serif)

const EPHEMERAL = 64; // InteractionResponseFlags.Ephemeral

// ---------- Config ----------
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || '';

// ---------- Client ----------
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Download helper with timeout (uses global fetch on Node 20)
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
  if (!STAFF_ROLE_ID) return true;
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles.cache.has(STAFF_ROLE_ID);
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // /ping
  if (interaction.commandName === 'ping') {
    await interaction.reply({ content: 'Pong 🏓', flags: 0 }); // public
    return;
  }

  // /agencylogo
  if (interaction.commandName === 'agencylogo') {
    if (!memberHasStaff(interaction.member)) {
      await interaction.reply({
        content: '🚫 You do not have permission to use this command.',
        flags: EPHEMERAL
      });
      return;
    }

    const name = interaction.options.getString('name') || '';
    const background = interaction.options.getString('background') || 'solid';
    const attachment = interaction.options.getAttachment('image');

    if (!attachment) {
      await interaction.reply({
        content: '❌ You must attach an image (PNG/JPG/WebP).',
        flags: EPHEMERAL
      });
      return;
    }
    if (attachment.size > MAX_UPLOAD_BYTES) {
      await interaction.reply({
        content: `❌ Image too large. Max ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.`,
        flags: EPHEMERAL
      });
      return;
    }
    if (attachment.contentType && !ALLOWED_MIME.has(attachment.contentType)) {
      await interaction.reply({
        content: '❌ Unsupported image type. Use PNG, JPG, or WebP.',
        flags: EPHEMERAL
      });
      return;
    }

    // ACK within 3s (public so the result shows in channel)
    await interaction.deferReply({ flags: 0 });

    try {
      const baseBuffer = await downloadToBuffer(attachment.url, 25000);
      const { finalPng } = await compose({ baseBuffer, name, background });

      const file = new AttachmentBuilder(finalPng, {
        name: `agency-logo-${Date.now()}.png`
      });

      await interaction.editReply({
        content: `Here’s your badge • **${name || 'NO NAME'}**`,
        files: [file]
      });
    } catch (err) {
      console.error('[agencylogo]', err);
      const msg = err?.message || 'Unknown error';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: `❌ Failed to generate: ${msg}` });
      } else {
        await interaction.reply({ content: `❌ Failed to generate: ${msg}`, flags: EPHEMERAL });
      }
    }
  }
});

// Safety nets
process.on('unhandledRejection', (e) => console.error('UNHANDLED_REJECTION', e));
process.on('uncaughtException', (e) => console.error('UNCAUGHT_EXCEPTION', e));

client.login(process.env.DISCORD_TOKEN);
