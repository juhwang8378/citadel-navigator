import { Client, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { commands } from './commands/index.js';
import type { Command } from './commands/types.js';
import { handleNaviSelect } from './navi/handlers.js';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error('DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID 환경 변수가 필요합니다.');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function registerCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands.map((command) => command.data.toJSON()),
  });
  console.log('슬래시 명령 등록 완료');
}

client.once(Events.ClientReady, async (c) => {
  console.log(`봇 로그인: ${c.user.tag}`);
  await registerCommands();
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.find((cmd) => cmd.data.name === interaction.commandName) as Command | undefined;
      if (!command) return;
      await command.execute(interaction);
      return;
    }
    if (interaction.isStringSelectMenu()) {
      await handleNaviSelect(interaction);
    }
  } catch (error) {
    console.error(error);
    if (interaction.isRepliable()) {
      const message = '오류가 발생했습니다. 잠시 후 다시 시도하세요.';
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: message, components: [] }).catch(() => {});
      } else {
        await interaction.reply({ content: message, ephemeral: true }).catch(() => {});
      }
    }
  }
});

client.login(token);
