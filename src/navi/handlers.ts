import {
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
  type ChannelSelectMenuInteraction,
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
import { safeEditReply } from '../utils/debug.js';
type NaviInteraction =
  | ChatInputCommandInteraction
  | StringSelectMenuInteraction
  | ChannelSelectMenuInteraction
  | ButtonInteraction;

function navButtons(userId: string): { showBack: boolean; showHome: boolean } {
  const showBack = getOrCreateSession(userId).stack.length > 0;
  return { showBack, showHome: true };
}

async function ensureMember(interaction: NaviInteraction): Promise<GuildMember | null> {
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
  interaction: NaviInteraction,
  categoryId: string,
): Promise<{ category: Category | undefined; channels: ChannelOption[] }> {
  const config = await readConfig();
  const category = config.categories.find((c) => c.id === categoryId);
  if (!interaction.guild || !category) {
    return { category, channels: [] };
  }

  const channelIds = Object.entries(config.channelRegistry)
    .filter(([, entry]) => entry.categoryId === categoryId)
    .sort(([, a], [, b]) => (a.position ?? 0) - (b.position ?? 0))
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
      });
    } catch {
      // skip missing channels
    }
  }

  return { category, channels: result };
}

async function resolveFavorites(
  interaction: NaviInteraction,
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
      });
    } catch {
      // ignore invalid
    }
  }
  return visible;
}

async function showHome(interaction: NaviInteraction, sessionUserId: string) {
  const favorites = await getFavorites(sessionUserId);
  const visibleFavs = await resolveFavorites(interaction, favorites);
  const favMentions = visibleFavs.map((fav) => `<#${fav.id}>`);
  const session = getOrCreateSession(sessionUserId);
  const result = renderHome({ favorites: favMentions, hasBack: session.stack.length > 0 });
  await safeEditReply(interaction, result, 'home');
}

async function openCategoryPicker(interaction: NaviInteraction, userId: string): Promise<void> {
  const config = await readConfig();
  const categories = [...config.categories].sort((a, b) => a.order - b.order);
  const canGoBack = getOrCreateSession(userId).stack.length > 0;
  if (categories.length === 0) {
    await safeEditReply(interaction, renderInfoMessage('등록된 카테고리가 없습니다.', navButtons(userId)), 'pick-category-empty');
    return;
  }
  await safeEditReply(interaction, renderPickCategory({ categories, canGoBack }), 'pick-category');
}

async function openChannelList(
  interaction: NaviInteraction,
  userId: string,
  categoryId: string,
): Promise<void> {
  const { category, channels } = await fetchRegisteredChannels(interaction, categoryId);
  if (!category) {
    await safeEditReply(interaction, renderInfoMessage('해당 카테고리를 찾을 수 없습니다.', navButtons(userId)), 'channel-list-missing');
    return;
  }
  const canGoBack = getOrCreateSession(userId).stack.length > 0;
  const result = renderChannelList({
    categoryName: category.name,
    categoryId: category.id,
    channels,
    canGoBack,
  });
  await safeEditReply(interaction, result, 'channel-list');
}

async function openEditFavorites(interaction: NaviInteraction, hasCurrentChannel: boolean, notice?: string): Promise<void> {
  const userId = interaction.user.id;
  const canGoBack = getOrCreateSession(userId).stack.length > 0;
  await safeEditReply(interaction, renderEditFavorites({ hasCurrentChannel, notice, canGoBack }), 'edit-favorites');
}

async function addFavoriteWithChecks(
  interaction: NaviInteraction,
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

async function openRemoveFavorite(
  interaction: NaviInteraction,
  userId: string,
): Promise<void> {
  const favorites = await getFavorites(userId);
  const visible = await resolveFavorites(interaction, favorites);
  if (visible.length === 0) {
    await safeEditReply(interaction, renderInfoMessage('삭제할 즐겨찾기가 없습니다.', navButtons(userId)), 'remove-fav-empty');
    return;
  }
  const canGoBack = getOrCreateSession(userId).stack.length > 0;
  await safeEditReply(interaction, renderRemoveFavorite({ favorites: visible, canGoBack }), 'remove-fav');
}

async function openReorderFavorite(
  interaction: NaviInteraction,
  userId: string,
  sourceIndex?: number,
): Promise<void> {
  const favorites = await getFavorites(userId);
  const visible = await resolveFavorites(interaction, favorites);
  if (visible.length === 0) {
    await safeEditReply(interaction, renderInfoMessage('즐겨찾기가 없습니다.', navButtons(userId)), 'reorder-fav-empty');
    return;
  }
  const canGoBack = getOrCreateSession(userId).stack.length > 0;
  await safeEditReply(interaction, renderReorderFavorite({ favorites: visible, sourceIndex, canGoBack }), 'reorder-fav');
}

export async function handleNaviCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.user.id;
  resetSession(userId);
  await showHome(interaction, userId);
}

export async function handleNaviInteraction(
  interaction: StringSelectMenuInteraction | ChannelSelectMenuInteraction | ButtonInteraction,
): Promise<void> {
  const customId = interaction.customId;
  if (!customId.startsWith('navi:')) return;

  await interaction.deferUpdate();
  const userId = interaction.user.id;
  const session = getOrCreateSession(userId);

  if (customId === 'navi:nav:back') {
    goBack(userId);
    await renderCurrent(interaction, userId);
    return;
  }

  if (customId === 'navi:nav:home') {
    resetSession(userId);
    await showHome(interaction, userId);
    return;
  }

  if (customId === 'navi:home:go') {
    setCurrentScreen(userId, { screen: 'PICK_CATEGORY' });
    await openCategoryPicker(interaction, userId);
    return;
  }

  if (customId === 'navi:home:edit') {
    setCurrentScreen(userId, { screen: 'EDIT_FAVORITES' });
    await openEditFavorites(interaction, interaction.channel !== null);
    return;
  }

  if (interaction.isChannelSelectMenu()) {
    if (customId.startsWith('navi:chanselect:')) {
      const categoryId = customId.split(':')[2] ?? '';
      const channelId = interaction.values[0];
      setCurrentScreen(userId, { screen: 'CHANNEL_LIST', categoryId });
      const { channels } = await fetchRegisteredChannels(interaction, categoryId);
      const allowed = channels.find((c) => c.id === channelId);
      if (!allowed) {
        await safeEditReply(interaction, renderInfoMessage('선택한 채널을 사용할 수 없습니다.', navButtons(userId)), 'channel-select-invalid');
        return;
      }
      const link = interaction.guild ? `https://discord.com/channels/${interaction.guild.id}/${channelId}` : '';
      await safeEditReply(interaction, renderInfoMessage(`선택한 채널로 이동: <#${channelId}> ${link}`.trim(), navButtons(userId)), 'channel-select');
      return;
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (customId === 'navi:pickcat') {
      const value = interaction.values[0];
      setCurrentScreen(userId, { screen: 'CHANNEL_LIST', categoryId: value });
      await openChannelList(interaction, userId, value);
      return;
    }

    if (customId === 'navi:editfav') {
      const choice = interaction.values[0];
      if (choice === 'ADD_CURRENT') {
        const channel = interaction.channel;
        if (!channel) {
          await safeEditReply(interaction, renderInfoMessage('현재 채널 정보를 확인할 수 없습니다.', navButtons(userId)), 'editfav-nochannel');
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
      return;
    }

    if (customId === 'navi:removefav') {
      const value = interaction.values[0];
      await removeFavoriteFromStore(userId, value);
      await openEditFavorites(interaction, interaction.channel !== null, '삭제되었습니다.');
      session.stack = [];
      session.current = { screen: 'EDIT_FAVORITES' };
      return;
    }

    if (customId.startsWith('navi:reorder:pick')) {
      const value = interaction.values[0];
      const idx = parseInt(value, 10);
      setCurrentScreen(userId, { screen: 'REORDER_FAV', sourceIndex: idx });
      await openReorderFavorite(interaction, userId, idx);
      return;
    }

    if (customId.startsWith('navi:reorder:target')) {
      const value = interaction.values[0];
      const targetIndex = parseInt(value, 10);
      const sourceIndex =
        session.current.screen === 'REORDER_FAV' ? session.current.sourceIndex : undefined;
      if (sourceIndex === undefined) {
        await openReorderFavorite(interaction, userId);
        return;
      }
      await reorderFavorites(userId, sourceIndex, targetIndex);
      await openEditFavorites(interaction, interaction.channel !== null, '순서가 변경되었습니다.');
      session.stack = [];
      session.current = { screen: 'EDIT_FAVORITES' };
      return;
    }
  }
}

async function renderCurrent(interaction: NaviInteraction, userId: string) {
  const session = getOrCreateSession(userId);
  switch (session.current.screen) {
    case 'HOME':
      await showHome(interaction, userId);
      break;
    case 'PICK_CATEGORY':
      await openCategoryPicker(interaction, userId);
      break;
    case 'CHANNEL_LIST':
      await openChannelList(interaction, userId, session.current.categoryId);
      break;
    case 'EDIT_FAVORITES':
      await openEditFavorites(interaction, interaction.channel !== null);
      break;
    case 'REMOVE_FAV':
      await openRemoveFavorite(interaction, userId);
      break;
    case 'REORDER_FAV':
      await openReorderFavorite(interaction, userId, session.current.sourceIndex);
      break;
  }
}
