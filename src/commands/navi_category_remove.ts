import { PermissionFlagsBits, SlashCommandBuilder, type AutocompleteInteraction, MessageFlags } from 'discord.js';
import type { Command } from './types.js';
import { readConfig } from '../storage/configStore.js';
import { createPendingAction } from '../utils/pendingActions.js';
import { findCategoryByInput, getSortedCategories } from '../utils/categoryHelpers.js';

export const naviCategoryRemoveCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('navi_category_remove')
    .setDescription('내비게이터 카테고리를 삭제합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((option) =>
      option
        .setName('category')
        .setDescription('카테고리 아이디')
        .setRequired(true)
        .setAutocomplete(true),
    ),
  async execute(interaction) {
    const categoryId = interaction.options.getString('category', true);
    const config = await readConfig();
    const target = findCategoryByInput(config, categoryId);
    if (!target) {
      await interaction.reply({ content: '해당 카테고리가 없습니다.', flags: MessageFlags.Ephemeral });
      return;
    }
    const token = createPendingAction({
      userId: interaction.user.id,
      type: 'CAT_REMOVE',
      payload: { categoryId: target.id, name: target.name },
    });
    await interaction.reply({
      content: `관리자 권한으로 "${target.name}" 카테고리를 내비게이션에서 제거하시겠습니까? 이 변경사항은 서버 내 모든 유저에게 반영됩니다. 자주 변경하면 사용자에게 혼란을 줄 수 있습니다.`,
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
