// register.js
// Run this once (node register.js) after updating to re-register commands

const { REST, Routes, ApplicationCommandOptionType } = require('discord.js');
require('dotenv').config();

const commands = [
  {
    name: 'ping',
    description: 'Replies with Pong!'
  },
  {
    name: 'agencylogo',
    description: 'Generate an agency logo with a custom background and name',
    options: [
      {
        name: 'name',
        description: 'The name to put on the logo',
        type: ApplicationCommandOptionType.String,
        required: true
      },
      {
        name: 'background',
        description: 'Background type',
        type: ApplicationCommandOptionType.String,
        required: false,
        choices: [
          { name: 'Solid', value: 'solid' },
          { name: 'Transparent', value: 'transparent' },
          { name: 'Gradient', value: 'gradient' }
        ]
      },
      {
        name: 'image',
        description: 'The image file to place in the logo',
        type: ApplicationCommandOptionType.Attachment,
        required: true
      }
    ]
  }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Commands registered globally.');
  } catch (error) {
    console.error(error);
  }
})();
