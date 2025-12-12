import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import { readConfig, registerChannel } from '../storage/configStore.js';

export const naviRegisterCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('navi_register')
    .setDescription('현재 채널을 카테고리에 등록합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((option) =>
      option.setName('category').setDescription('카테고리 아이디').setRequired(true),
    ),
  async execute(interaction) {
    if (!interaction.guild || !interaction.channel) {
      await interaction.reply({ content: '길드나 채널 정보를 찾을 수 없습니다.', ephemeral: true });
      return;
    }
    const categoryId = interaction.options.getString('category', true);
    const config = await readConfig();
    const exists = config.categories.find((c) => c.id === categoryId);
    if (!exists) {
      await interaction.reply({ content: '해당 카테고리가 없습니다.', ephemeral: true });
      return;
    }
    await registerChannel(interaction.channel.id, categoryId);
    await interaction.reply({
      content: `이 채널이 "${exists.name}" 카테고리에 등록되었습니다.`,
      ephemeral: true,
    });
  },
};
