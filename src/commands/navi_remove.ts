import { PermissionFlagsBits, SlashCommandBuilder, type AutocompleteInteraction, MessageFlags } from 'discord.js';
import type { Command } from './types.js';
import { readConfig } from '../storage/configStore.js';
import { createPendingAction } from '../utils/pendingActions.js';
import { findCategoryByInput } from '../utils/categoryHelpers.js';

export const naviRemoveCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('navi_remove')
    .setDescription('현재 채널을 카테고리에서 제거합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((option) =>
      option
        .setName('category')
        .setDescription('현재 채널이 속한 카테고리')
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
    const config = await readConfig();
    const registry = config.channelRegistry[guildChannel.id];
    if (!registry) {
      await interaction.reply({ content: '이 채널은 내비게이션에 등록되어 있지 않습니다.', flags: MessageFlags.Ephemeral });
      return;
    }
    const categoryInput = interaction.options.getString('category', true);
    const targetCategory = findCategoryByInput(config, categoryInput);
    if (!targetCategory) {
      await interaction.reply({ content: '해당 카테고리를 찾을 수 없습니다.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (targetCategory.id !== registry.categoryId) {
      await interaction.reply({ content: '이 채널은 선택한 카테고리에 등록되어 있지 않습니다.', flags: MessageFlags.Ephemeral });
      return;
    }

    const token = createPendingAction({
      userId: interaction.user.id,
      type: 'CHANNEL_REMOVE',
      payload: {
        channelId: guildChannel.id,
        categoryId: targetCategory.id,
        categoryName: targetCategory.name,
        channelName: guildChannel.name,
      },
    });

    await interaction.reply({
      content: `관리자 권한으로 "${guildChannel.name}" 채널을 "${targetCategory.name}" 카테고리에서 제거하시겠습니까? 이 변경사항은 서버 내 모든 유저에게 반영됩니다. 자주 변경하면 사용자에게 혼란을 줄 수 있습니다.`,
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
    const channelId = interaction.channel?.id;
    if (!channelId) {
      await interaction.respond([]);
      return;
    }
    const config = await readConfig();
    const registry = config.channelRegistry[channelId];
    if (!registry) {
      await interaction.respond([]);
      return;
    }
    const category = config.categories.find((c) => c.id === registry.categoryId);
    if (!category) {
      await interaction.respond([]);
      return;
    }
    if (
      category.name.toLowerCase().includes(focused) ||
      category.id.toLowerCase().includes(focused) ||
      focused.length === 0
    ) {
      await interaction.respond([{ name: category.name, value: category.id }]);
    } else {
      await interaction.respond([]);
    }
  },
};
