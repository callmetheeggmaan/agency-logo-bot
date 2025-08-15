// register.js — registers /agencylogo with options for your guild
require('dotenv').config();
const { REST, Routes, ApplicationCommandOptionType } = require('discord.js');

const { APP_ID, GUILD_ID, DISCORD_TOKEN } = process.env;
if (!APP_ID || !GUILD_ID || !DISCORD_TOKEN) {
  console.error('Missing APP_ID, GUILD_ID, or DISCORD_TOKEN in .env');
  process.exit(1);
}

const commands = [
  {
    name: 'ping',
    description: 'Latency check',
  },
  {
    name: 'agencylogo',
    description: 'Generate an agency badge from an image',
    options: [
      {
        name: 'upload',
        description: 'Image to place in the center',
        type: ApplicationCommandOptionType.Attachment,
        required: true,
      },
      {
        name: 'name',
        description: 'Bottom text (e.g., the person’s name)',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: 'background',
        description: 'Background mode',
        type: ApplicationCommandOptionType.String,
        required: false,
        choices: [
          { name: 'solid', value: 'solid' },
          { name: 'transparent', value: 'transparent' },
        ],
      },
      {
        name: 'size',
        description: 'Export size (px)',
        type: ApplicationCommandOptionType.Integer,
        required: false,
        choices: [
          { name: '512', value: 512 },
          { name: '1024', value: 1024 },
          { name: '2048 (max quality)', value: 2048 },
        ],
      },
      {
        name: 'style',
        description: 'Style preset',
        type: ApplicationCommandOptionType.String,
        required: false,
        choices: [
          { name: 'default', value: 'default' },
          { name: 'purple',  value: 'purple'  },
          { name: 'gold',    value: 'gold'    },
          { name: 'neon',    value: 'neon'    },
        ],
      },
    ],
  },
];

(async () => {
  try {
    console.log('Registering commands for app:', APP_ID, 'in guild:', GUILD_ID);
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    await rest.put(Routes.applicationGuildCommands(APP_ID, GUILD_ID), { body: commands });
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
    process.exit(1);
  }
})();
