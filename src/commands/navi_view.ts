import { PermissionFlagsBits, SlashCommandBuilder, ButtonStyle } from 'discord.js';
import type { Command } from './types.js';
import { readConfig } from '../storage/configStore.js';
import { buildButtons, renderAdmin, VIEW_ACCENT } from '../admin/ui.js';

export const naviViewCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('navi_view')
    .setDescription('내비게이터 전체 구성을 확인합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const config = await readConfig();
    const categories = [...config.categories].sort((a, b) => a.order - b.order);
    const lines: string[] = [];
    for (const category of categories) {
      lines.push(`**${category.name}**`);
      const channels = Object.entries(config.channelRegistry)
        .filter(([, entry]) => entry.categoryId === category.id)
        .map(([id]) => `<#${id}>`);
      lines.push(channels.length > 0 ? channels.map((c) => `• ${c}`).join('\n') : '• (채널 없음)');
    }
    if (categories.length === 0) {
      lines.push('등록된 카테고리가 없습니다.');
    }

    const row = buildButtons([{ id: 'noop:view', label: '읽기 전용', style: ButtonStyle.Secondary }]);
    await interaction.reply(renderAdmin(lines.join('\n'), [row], VIEW_ACCENT));
  },
};
