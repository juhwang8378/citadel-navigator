import { PermissionFlagsBits, SlashCommandBuilder, type AutocompleteInteraction, MessageFlags } from 'discord.js';
import type { Command } from './types.js';
import { readConfig } from '../storage/configStore.js';
import { createPendingAction } from '../utils/pendingActions.js';
import { findCategoryByInput, getSortedCategories } from '../utils/categoryHelpers.js';

export const naviAddCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('navi_add')
    .setDescription('현재 채널을 카테고리에 등록합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((option) =>
      option
        .setName('category')
        .setDescription('카테고리를 선택하세요.')
        .setRequired(true)
        .setAutocomplete(true),
    ),
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '길드나 채널 정보를 찾을 수 없습니다.', flags: MessageFlags.Ephemeral });
      return;
    }
    const guildChannel = await interaction.guild.channels.fetch(interaction.channelId).catch(() => null);
    if (!guildChannel) {
      await interaction.reply({ content: '채널 정보를 불러올 수 없습니다.', flags: MessageFlags.Ephemeral });
      return;
    }
    const categoryInput = interaction.options.getString('category', true);
    const config = await readConfig();
    const targetCategory = findCategoryByInput(config, categoryInput);
    if (!targetCategory) {
      await interaction.reply({ content: '해당 카테고리를 찾을 수 없습니다.', flags: MessageFlags.Ephemeral });
      return;
    }
    const token = createPendingAction({
      userId: interaction.user.id,
      type: 'CHANNEL_ADD',
      payload: {
        channelId: guildChannel.id,
        categoryId: targetCategory.id,
        categoryName: targetCategory.name,
        channelName: guildChannel.name,
      },
    });
    await interaction.reply({
      content: `관리자 권한으로 "${guildChannel.name}" 채널을 "${targetCategory.name}" 카테고리에 등록하시겠습니까? 이 변경사항은 서버 내 모든 유저에게 반영됩니다. 자주 변경하면 사용자에게 혼란을 줄 수 있습니다.`,
      flags: MessageFlags.Ephemeral,
      components: [
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: '확인', custom_id: `admin:confirm:${token}` },
            { type: 2, style: 4, label: '취소', custom_id: `admin:cancel:${token}` },
          ],
        },
      ],
    });
  },
  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused().trim().toLowerCase();
    const categories = await getSortedCategories();
    const filtered = categories
      .filter(
        (cat) =>
          cat.name.toLowerCase().includes(focused) || cat.id.toLowerCase().includes(focused),
      )
      .slice(0, 25)
      .map((cat) => ({ name: cat.name, value: cat.id }));
    await interaction.respond(filtered);
  },
};
