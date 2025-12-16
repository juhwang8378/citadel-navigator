import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import { handleEditCommand } from '../admin/editHandler.js';
import type { EditMode } from '../admin/editSession.js';

const choices: { name: string; value: EditMode }[] = [
  { name: '채널 추가', value: 'ADD_CHANNEL' },
  { name: '채널 삭제', value: 'DELETE_CHANNEL' },
  { name: '채널 순서', value: 'ORDER_CHANNEL' },
  { name: '카테고리 순서', value: 'ORDER_CATEGORY' },
];

export const naviEditCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('navi_edit')
    .setDescription('내비게이터 편집')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((option) =>
      option
        .setName('option')
        .setDescription('수행할 작업')
        .setRequired(true)
        .addChoices(...choices.map((c) => ({ name: c.name, value: c.value }))),
    ),
  async execute(interaction) {
    const option = interaction.options.getString('option', true) as EditMode;
    await handleEditCommand(interaction, option);
  },
};
