import { ButtonInteraction, ButtonStyle } from 'discord.js';
import { nanoid } from 'nanoid';
import { addCategory, readConfig, removeCategory, registerChannel, unregisterChannel } from '../storage/configStore.js';
import { cancelPendingAction, consumePendingAction, getPendingAction } from '../utils/pendingActions.js';
import { EDIT_ACCENT } from '../admin/ui.js';

const COMPONENTS_FLAG = 1 << 15;

function wrap(content: string) {
  return {
    embeds: [{ description: content }],
    components: [
      { type: 1, accent_color: EDIT_ACCENT, components: [{ type: 2, style: ButtonStyle.Secondary, label: '확인', custom_id: 'noop', disabled: true }] },
    ],
    flags: COMPONENTS_FLAG,
  };
}

export async function handleAdminActionButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith('admin:')) return false;

  await interaction.deferUpdate();
  const [, action, token] = interaction.customId.split(':');
  if (!token) {
    await interaction.editReply(wrap('요청 정보를 확인할 수 없습니다.'));
    return true;
  }

  const pending = getPendingAction(token);
  if (!pending || pending.userId !== interaction.user.id) {
    await interaction.editReply(wrap('요청을 찾을 수 없습니다. 다시 시도하세요.'));
    cancelPendingAction(token);
    return true;
  }

  if (action === 'cancel') {
    cancelPendingAction(token);
    await interaction.editReply(wrap('취소되었습니다.'));
    return true;
  }

  if (action !== 'confirm') {
    await interaction.editReply(wrap('잘못된 요청입니다.'));
    cancelPendingAction(token);
    return true;
  }

  const entry = consumePendingAction(token);
  if (!entry) {
    await interaction.editReply(wrap('요청을 찾을 수 없습니다. 다시 시도하세요.'));
    return true;
  }

  switch (entry.type) {
    case 'CAT_ADD': {
      const { id, name, order } = entry.payload;
      const config = await readConfig();
      let finalId = id;
      if (config.categories.find((c) => c.id === finalId)) {
        finalId = `${finalId}-${nanoid(4)}`;
      }
      await addCategory({ id: finalId, name, order });
      await interaction.editReply(wrap(`카테고리가 추가되었습니다.\n이름: ${name}\n정렬 순서: ${order}`));
      return true;
    }
    case 'CAT_REMOVE': {
      const { categoryId, name } = entry.payload;
      const config = await readConfig();
      const target = config.categories.find((c) => c.id === categoryId);
      if (!target) {
        await interaction.editReply(wrap('해당 카테고리가 없습니다.'));
        return true;
      }
      await removeCategory(categoryId);
      await interaction.editReply(wrap(`"${name}" 카테고리가 삭제되었습니다.`));
      return true;
    }
    case 'CHANNEL_ADD': {
      const { channelId, categoryId, categoryName, channelName } = entry.payload;
      const config = await readConfig();
      const category = config.categories.find((c) => c.id === categoryId);
      if (!category) {
        await interaction.editReply(wrap('해당 카테고리를 찾을 수 없습니다.'));
        return true;
      }
      await registerChannel(channelId, categoryId);
      await interaction.editReply(wrap(`"${channelName}" 채널이 "${categoryName}" 카테고리에 등록되었습니다.`));
      return true;
    }
    case 'CHANNEL_REMOVE': {
      const { channelId, categoryId, categoryName, channelName } = entry.payload;
      const config = await readConfig();
      const current = config.channelRegistry[channelId];
      if (!current || current.categoryId !== categoryId) {
        await interaction.editReply(wrap('해당 채널은 지정된 카테고리에 등록되어 있지 않습니다.'));
        return true;
      }
      await unregisterChannel(channelId);
      await interaction.editReply(wrap(`"${channelName}" 채널이 "${categoryName}" 카테고리에서 제거되었습니다.`));
      return true;
    }
  }

  await interaction.editReply(wrap('알 수 없는 요청입니다.'));
  return true;
}
