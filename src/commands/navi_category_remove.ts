import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import { readConfig, removeCategory } from '../storage/configStore.js';

export const naviCategoryRemoveCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('navi_category_remove')
    .setDescription('내비게이터 카테고리를 삭제합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option.setName('category').setDescription('카테고리 아이디').setRequired(true),
    ),
  async execute(interaction) {
    const categoryId = interaction.options.getString('category', true);
    const config = await readConfig();
    const target = config.categories.find((c) => c.id === categoryId);
    if (!target) {
      await interaction.reply({ content: '해당 카테고리가 없습니다.', ephemeral: true });
      return;
    }
    await removeCategory(categoryId);
    await interaction.reply({
      content: `"${target.name}" 카테고리가 삭제되었습니다.`,
      ephemeral: true,
    });
  },
};
