import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import { readConfig, unregisterChannel } from '../storage/configStore.js';

export const naviUnregisterCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('navi_unregister')
    .setDescription('현재 채널을 내비게이터에서 해제합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    if (!interaction.guild || !interaction.channel) {
      await interaction.reply({ content: '길드나 채널 정보를 찾을 수 없습니다.', ephemeral: true });
      return;
    }
    const config = await readConfig();
    const registered = config.channelRegistry[interaction.channel.id];
    if (!registered) {
      await interaction.reply({ content: '이 채널은 등록되어 있지 않습니다.', ephemeral: true });
      return;
    }
    await unregisterChannel(interaction.channel.id);
    await interaction.reply({ content: '채널 등록이 해제되었습니다.', ephemeral: true });
  },
};
