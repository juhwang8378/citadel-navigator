import { PermissionFlagsBits, SlashCommandBuilder, MessageFlags } from 'discord.js';
import { nanoid } from 'nanoid';
import type { Command } from './types.js';
import { readConfig } from '../storage/configStore.js';
import { createPendingAction } from '../utils/pendingActions.js';

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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
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
    const token = createPendingAction({
      userId: interaction.user.id,
      type: 'CAT_ADD',
      payload: { id, name, order: sortOrder },
    });
    await interaction.reply({
      content: `관리자 권한으로 "${name}" 카테고리를 내비게이션에 등록하시겠습니까? 이 변경사항은 서버 내 모든 유저에게 반영됩니다. 자주 변경하면 사용자에게 혼란을 줄 수 있습니다.`,
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
};
