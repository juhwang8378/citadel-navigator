import { Client, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { commands } from './commands/index.js';
import type { Command } from './commands/types.js';
import { handleNaviInteraction } from './navi/handlers.js';
import { handleAdminActionButton } from './commands/adminConfirm.js';
import { handleEditInteraction, handleEditModalInteraction } from './admin/editHandler.js';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  throw new Error('DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID 환경 변수가 필요합니다.');
}

const botToken = token;
const appClientId = clientId;
const targetGuildId = guildId;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function registerCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(botToken);
  await rest.put(Routes.applicationGuildCommands(appClientId, targetGuildId), {
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
    if (interaction.isAutocomplete()) {
      const command = commands.find((cmd) => cmd.data.name === interaction.commandName) as Command | undefined;
      if (command?.autocomplete) {
        await command.autocomplete(interaction);
      }
      return;
    }
    if (interaction.isChatInputCommand()) {
      const command = commands.find((cmd) => cmd.data.name === interaction.commandName) as Command | undefined;
      if (!command) return;
      await command.execute(interaction);
      return;
    }
    if (interaction.isModalSubmit()) {
      const handled = await handleEditModalInteraction(interaction);
      if (handled) return;
    }
    if (interaction.isStringSelectMenu() || interaction.isChannelSelectMenu() || interaction.isButton()) {
      if (interaction.isButton()) {
        const handled = await handleAdminActionButton(interaction);
        if (handled) return;
      }
      const editHandled = await handleEditInteraction(interaction);
      if (editHandled) return;
      await handleNaviInteraction(interaction);
    }
  } catch (error) {
    console.error(error);
    const errorPayload = {
      content: '오류가 발생했습니다. 잠시 후 다시 시도하세요.',
      components: [
        { type: 1, accent_color: '#ed0000', components: [{ type: 2, style: 2, label: '확인', custom_id: 'noop', disabled: true }] },
      ],
      flags: 1 << 15,
    };
    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(errorPayload as any).catch(() => {});
      } else {
        await interaction.reply({ ...(errorPayload as any), ephemeral: true }).catch(() => {});
      }
    }
  }
});

client.login(token);
