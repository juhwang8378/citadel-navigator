import {
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
  type GuildBasedChannel,
  GuildMember,
  PermissionFlagsBits,
} from 'discord.js';
import { readConfig } from '../storage/configStore.js';
import {
  addFavorite,
  getFavorites,
  removeFavorite as removeFavoriteFromStore,
  reorderFavorites,
} from '../storage/userStore.js';
import {
  getOrCreateSession,
  goBack,
  resetSession,
  setCurrentScreen,
} from './sessionStore.js';
import {
  renderAddFavPickCategory,
  renderAddFavPickChannel,
  renderChannelList,
  renderEditFavorites,
  renderHome,
  renderInfoMessage,
  renderPickCategory,
  renderRemoveFavorite,
  renderReorderFavorite,
  type ChannelOption,
} from './screens.js';
import type { Category } from '../storage/configStore.js';

const BACK_VALUE = 'BACK';

function truncate(text: string, max = 60): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function firstLine(text?: string | null): string {
  if (!text) return '설명 없음';
  const [line] = text.split('\n');
  const trimmed = line.trim();
  return trimmed.length > 0 ? trimmed : '설명 없음';
}

async function ensureMember(interaction: ChatInputCommandInteraction | StringSelectMenuInteraction): Promise<GuildMember | null> {
  if (!interaction.guild) return null;
  const member = interaction.member;
  if (member && member instanceof GuildMember) return member;
  try {
    const fetched = await interaction.guild.members.fetch(interaction.user.id);
    return fetched;
  } catch {
    return null;
  }
}

function canView(channel: GuildBasedChannel, member: GuildMember): boolean {
  const perms = channel.permissionsFor(member);
  return perms?.has(PermissionFlagsBits.ViewChannel) ?? false;
}

async function fetchRegisteredChannels(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  categoryId: string,
): Promise<{ category: Category | undefined; channels: ChannelOption[] }> {
  const config = await readConfig();
  const category = config.categories.find((c) => c.id === categoryId);
  if (!interaction.guild || !category) {
    return { category, channels: [] };
  }

  const channelIds = Object.entries(config.channelRegistry)
    .filter(([, entry]) => entry.categoryId === categoryId)
    .map(([channelId]) => channelId);

  const member = await ensureMember(interaction);
  const result: ChannelOption[] = [];
  for (const channelId of channelIds) {
    try {
      const channel = await interaction.guild.channels.fetch(channelId);
      if (!channel || !member || !canView(channel, member)) continue;
      result.push({
        id: channel.id,
        name: channel.name,
        description: truncate(firstLine((channel as any).topic)),
      });
    } catch {
      // skip missing channels
    }
  }

  return { category, channels: result };
}

async function resolveFavorites(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  favorites: string[],
): Promise<ChannelOption[]> {
  if (!interaction.guild) return [];
  const member = await ensureMember(interaction);
  const visible: ChannelOption[] = [];
  for (const id of favorites) {
    try {
      const channel = await interaction.guild.channels.fetch(id);
      if (!channel || !member || !canView(channel, member)) continue;
      visible.push({
        id: channel.id,
        name: channel.name,
        description: truncate(firstLine((channel as any).topic)),
      });
    } catch {
      // ignore invalid
    }
  }
  return visible;
}

async function showHome(interaction: ChatInputCommandInteraction | StringSelectMenuInteraction, sessionUserId: string) {
  const favorites = await getFavorites(sessionUserId);
  const visibleFavs = await resolveFavorites(interaction, favorites);
  const favMentions = visibleFavs.map((fav) => `<#${fav.id}>`);
  const session = getOrCreateSession(sessionUserId);
  const result = renderHome({ favorites: favMentions, hasBack: session.stack.length > 0 });
  await interaction.editReply(result);
}

async function openCategoryPicker(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  userId: string,
): Promise<void> {
  const config = await readConfig();
  const categories = [...config.categories].sort((a, b) => a.order - b.order);
  await interaction.editReply(renderPickCategory(categories));
}

async function openChannelList(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  userId: string,
  categoryId: string,
  selectedChannelId?: string,
): Promise<void> {
  const { category, channels } = await fetchRegisteredChannels(interaction, categoryId);
  if (!category) {
    await interaction.editReply(renderInfoMessage('해당 카테고리를 찾을 수 없습니다.'));
    return;
  }
  const jumpUrl =
    selectedChannelId && interaction.guild
      ? `https://discord.com/channels/${interaction.guild.id}/${selectedChannelId}`
      : undefined;
  const result = renderChannelList({
    categoryName: category.name,
    categoryId: category.id,
    channels,
    selectedChannelId,
    jumpUrl,
  });
  await interaction.editReply(result);
}

async function openEditFavorites(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  hasCurrentChannel: boolean,
  notice?: string,
): Promise<void> {
  await interaction.editReply(renderEditFavorites({ hasCurrentChannel, notice }));
}

async function addFavoriteWithChecks(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  userId: string,
  channelId: string,
): Promise<string | null> {
  if (!interaction.guild) return '길드 정보를 찾을 수 없습니다.';
  const member = await ensureMember(interaction);
  if (!member) return '권한 정보를 가져올 수 없습니다.';
  let channel: GuildBasedChannel | null = null;
  try {
    channel = await interaction.guild.channels.fetch(channelId);
  } catch {
    return '채널을 찾을 수 없습니다.';
  }
  if (!channel) return '채널을 찾을 수 없습니다.';
  if (!canView(channel, member)) return '채널을 볼 수 없어 즐겨찾기에 추가할 수 없습니다.';

  const result = await addFavorite(userId, channelId);
  if (!result.ok) {
    if (result.reason === 'duplicate') return '이미 즐겨찾기에 있습니다.';
    if (result.reason === 'max') return '즐겨찾기는 최대 5개까지 가능합니다.';
  }
  return null;
}

async function openAddFavCategory(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  userId: string,
): Promise<void> {
  const config = await readConfig();
  const categories = [...config.categories].sort((a, b) => a.order - b.order);
  await interaction.editReply(renderAddFavPickCategory(categories));
}

async function openAddFavChannel(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  userId: string,
  categoryId: string,
): Promise<void> {
  const { category, channels } = await fetchRegisteredChannels(interaction, categoryId);
  if (!category) {
    await interaction.editReply(renderInfoMessage('해당 카테고리를 찾을 수 없습니다.'));
    return;
  }
  await interaction.editReply(
    renderAddFavPickChannel({ categoryId: category.id, categoryName: category.name, channels }),
  );
}

async function openRemoveFavorite(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  userId: string,
): Promise<void> {
  const favorites = await getFavorites(userId);
  const visible = await resolveFavorites(interaction, favorites);
  if (visible.length === 0) {
    await interaction.editReply(renderInfoMessage('삭제할 즐겨찾기가 없습니다.'));
    return;
  }
  await interaction.editReply(renderRemoveFavorite(visible));
}

async function openReorderFavorite(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
  userId: string,
  sourceIndex?: number,
): Promise<void> {
  const favorites = await getFavorites(userId);
  const visible = await resolveFavorites(interaction, favorites);
  if (visible.length === 0) {
    await interaction.editReply(renderInfoMessage('즐겨찾기가 없습니다.'));
    return;
  }
  await interaction.editReply(renderReorderFavorite({ favorites: visible, sourceIndex }));
}

export async function handleNaviCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.user.id;
  resetSession(userId);
  await showHome(interaction, userId);
}

export async function handleNaviSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const customId = interaction.customId;
  if (!customId.startsWith('navi:')) return;

  // customId 구조: navi:<화면키>[:추가파라미터]
  await interaction.deferUpdate();
  const userId = interaction.user.id;
  const session = getOrCreateSession(userId);
  const [id, sub, param] = customId.split(':');

  switch (`${id}:${sub}`) {
    case 'navi:home': {
      const choice = interaction.values[0];
      if (choice === 'GO') {
        setCurrentScreen(userId, { screen: 'PICK_CATEGORY' });
        await openCategoryPicker(interaction, userId);
      } else if (choice === 'EDIT') {
        setCurrentScreen(userId, { screen: 'EDIT_FAVORITES' });
        await openEditFavorites(interaction, interaction.channel !== null);
      } else if (choice === BACK_VALUE) {
        goBack(userId);
        await renderCurrent(interaction, userId);
      }
      break;
    }
    case 'navi:pickcat': {
      const value = interaction.values[0];
      if (value === BACK_VALUE) {
        goBack(userId);
        await renderCurrent(interaction, userId);
        break;
      }
      setCurrentScreen(userId, { screen: 'CHANNEL_LIST', categoryId: value });
      await openChannelList(interaction, userId, value);
      break;
    }
    case 'navi:chanlist': {
      const categoryId = param;
      const value = interaction.values[0];
      if (value === BACK_VALUE) {
        goBack(userId);
        await renderCurrent(interaction, userId);
        break;
      }
      session.current = { screen: 'CHANNEL_LIST', categoryId: categoryId ?? '', selectedChannelId: value };
      await openChannelList(interaction, userId, categoryId ?? '', value);
      break;
    }
    case 'navi:chanactions': {
      const categoryId = param;
      const action = interaction.values[0];
      if (action === 'FAV_ADD') {
        const currentScreen = session.current.screen === 'CHANNEL_LIST' ? session.current : null;
        const targetChannelId = currentScreen?.selectedChannelId;
        if (!targetChannelId) {
          await interaction.editReply(renderInfoMessage('채널을 먼저 선택하세요.'));
          return;
        }
        const error = await addFavoriteWithChecks(interaction, userId, targetChannelId);
        if (error) {
          await interaction.editReply(renderInfoMessage(error));
          return;
        }
        session.stack = [];
        session.current = { screen: 'EDIT_FAVORITES' };
        await openEditFavorites(interaction, interaction.channel !== null, '추가되었습니다.');
        return;
      }
      if (action === BACK_VALUE) {
        goBack(userId);
        await renderCurrent(interaction, userId);
        return;
      }
      if (action === 'HOME') {
        resetSession(userId);
        await showHome(interaction, userId);
        return;
      }
      break;
    }
    case 'navi:editfav': {
      const choice = interaction.values[0];
      if (choice === 'ADD_CURRENT') {
        const channel = interaction.channel;
        if (!channel) {
          await interaction.editReply(renderInfoMessage('현재 채널 정보를 확인할 수 없습니다.'));
          return;
        }
        const error = await addFavoriteWithChecks(interaction, userId, channel.id);
        if (error) {
          await openEditFavorites(interaction, interaction.channel !== null, error);
          return;
        }
        await openEditFavorites(interaction, interaction.channel !== null, '추가되었습니다.');
        return;
      }
      if (choice === 'ADD_FROM_CATEGORY') {
        setCurrentScreen(userId, { screen: 'ADD_FAV_FROM_CATEGORY' });
        await openAddFavCategory(interaction, userId);
        return;
      }
      if (choice === 'REMOVE') {
        setCurrentScreen(userId, { screen: 'REMOVE_FAV' });
        await openRemoveFavorite(interaction, userId);
        return;
      }
      if (choice === 'REORDER') {
        setCurrentScreen(userId, { screen: 'REORDER_FAV' });
        await openReorderFavorite(interaction, userId);
        return;
      }
      if (choice === BACK_VALUE) {
        goBack(userId);
        await renderCurrent(interaction, userId);
        return;
      }
      if (choice === 'HOME') {
        resetSession(userId);
        await showHome(interaction, userId);
        return;
      }
      break;
    }
    case 'navi:addfavcat': {
      const value = interaction.values[0];
      if (value === BACK_VALUE) {
        goBack(userId);
        await renderCurrent(interaction, userId);
        return;
      }
      setCurrentScreen(userId, { screen: 'ADD_FAV_PICK_CHANNEL', categoryId: value });
      await openAddFavChannel(interaction, userId, value);
      return;
    }
    case 'navi:addfavchan': {
      const categoryId = param;
      const value = interaction.values[0];
      if (value === BACK_VALUE) {
        goBack(userId);
        await renderCurrent(interaction, userId);
        return;
      }
      const error = await addFavoriteWithChecks(interaction, userId, value);
      if (error) {
        await openEditFavorites(interaction, interaction.channel !== null, error);
      } else {
        await openEditFavorites(interaction, interaction.channel !== null, '추가되었습니다.');
      }
      session.stack = [];
      session.current = { screen: 'EDIT_FAVORITES' };
      return;
    }
    case 'navi:removefav': {
      const value = interaction.values[0];
      if (value === BACK_VALUE) {
        goBack(userId);
        await renderCurrent(interaction, userId);
        return;
      }
      await removeFavoriteFromStore(userId, value);
      await openEditFavorites(interaction, interaction.channel !== null, '삭제되었습니다.');
      session.stack = [];
      session.current = { screen: 'EDIT_FAVORITES' };
      return;
    }
  }

  if (customId.startsWith('navi:reorder:pick')) {
    const value = interaction.values[0];
    if (value === BACK_VALUE) {
      goBack(userId);
      await renderCurrent(interaction, userId);
      return;
    }
    const idx = parseInt(value, 10);
    session.current = { screen: 'REORDER_FAV', sourceIndex: idx };
    await openReorderFavorite(interaction, userId, idx);
    return;
  }

  if (customId.startsWith('navi:reorder:target')) {
    const value = interaction.values[0];
    if (value === BACK_VALUE) {
      goBack(userId);
      await renderCurrent(interaction, userId);
      return;
    }
    const targetIndex = parseInt(value, 10);
    const sourceIndex = (session.current.screen === 'REORDER_FAV' && session.current.sourceIndex !== undefined)
      ? session.current.sourceIndex
      : 0;
    await reorderFavorites(userId, sourceIndex, targetIndex);
    await openEditFavorites(interaction, interaction.channel !== null, '순서가 변경되었습니다.');
    session.stack = [];
    session.current = { screen: 'EDIT_FAVORITES' };
    return;
  }
}

async function renderCurrent(interaction: ChatInputCommandInteraction | StringSelectMenuInteraction, userId: string) {
  const session = getOrCreateSession(userId);
  switch (session.current.screen) {
    case 'HOME':
      await showHome(interaction, userId);
      break;
    case 'PICK_CATEGORY':
      await openCategoryPicker(interaction, userId);
      break;
    case 'CHANNEL_LIST':
      await openChannelList(interaction, userId, session.current.categoryId, session.current.selectedChannelId);
      break;
    case 'EDIT_FAVORITES':
      await openEditFavorites(interaction, interaction.channel !== null);
      break;
    case 'ADD_FAV_FROM_CATEGORY':
      await openAddFavCategory(interaction, userId);
      break;
    case 'ADD_FAV_PICK_CHANNEL':
      await openAddFavChannel(interaction, userId, session.current.categoryId);
      break;
    case 'REMOVE_FAV':
      await openRemoveFavorite(interaction, userId);
      break;
    case 'REORDER_FAV':
      await openReorderFavorite(interaction, userId, session.current.sourceIndex);
      break;
  }
}
