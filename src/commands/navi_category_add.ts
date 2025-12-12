import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { nanoid } from 'nanoid';
import type { Command } from './types.js';
import { addCategory, readConfig } from '../storage/configStore.js';

function makeSlug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ㄱ-ㅎ가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `cat-${nanoid(6)}`;
}

export const naviCategoryAddCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('navi_category_add')
    .setDescription('내비게이터 카테고리를 추가합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option.setName('name').setDescription('카테고리 이름').setRequired(true),
    )
    .addIntegerOption((option) =>
      option.setName('order').setDescription('정렬 순서 (숫자가 작을수록 위)'),
    ),
  async execute(interaction) {
    const name = interaction.options.getString('name', true);
    const order = interaction.options.getInteger('order') ?? undefined;
    const config = await readConfig();
    let id = makeSlug(name);
    if (config.categories.find((c) => c.id === id)) {
      id = `${id}-${nanoid(4)}`;
    }
    const sortOrder = order ?? config.categories.length + 1;
    await addCategory({ id, name, order: sortOrder });
    await interaction.reply({
      content: `카테고리가 추가되었습니다.\n아이디: ${id}\n이름: ${name}\n정렬 순서: ${sortOrder}`,
      ephemeral: true,
    });
  },
};
