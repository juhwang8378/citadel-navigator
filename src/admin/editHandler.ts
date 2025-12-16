import {
  ActionRowBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  ChannelType,
  PermissionFlagsBits,
  StringSelectMenuInteraction,
  MessageFlags,
  TextChannel,
  VoiceChannel,
  ForumChannel,
  CategoryChannel,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
} from 'discord.js';
import { buildButtons, buildStringSelect, renderAdmin, EDIT_ACCENT } from './ui.js';
import {
  getChannelsByCategory,
  insertCategoryAt,
  readConfig,
  reorderCategory,
  reorderChannels,
  unregisterChannel,
  writeConfig,
} from '../storage/configStore.js';
import { getEditSession, setEditSession, startEditSession, endEditSession, type EditMode } from './editSession.js';
import { nanoid } from 'nanoid';

function ensureModerator(interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction): boolean {
  const member = interaction.member;
  if (member && 'permissions' in member) {
    const perms = (member as any).permissions;
    if (perms && typeof perms !== 'string' && typeof perms.has === 'function') {
      return perms.has(PermissionFlagsBits.ManageChannels);
    }
  }
  return false;
}

function makeSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ㄱ-ㅎ가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '') || `cat-${nanoid(6)}`;
}

function uniqueCategoryId(configName: string, existingIds: string[]): string {
  let base = makeSlug(configName);
  let candidate = base;
  let idx = 1;
  while (existingIds.includes(candidate)) {
    candidate = `${base}-${idx}`;
    idx += 1;
  }
  return candidate;
}

async function removeEmptyCategories(): Promise<void> {
  const config = await readConfig();
  const used = new Set(Object.values(config.channelRegistry).map((c) => c.categoryId));
  config.categories = config.categories
    .filter((c) => used.has(c.id))
    .sort((a, b) => a.order - b.order)
    .map((c, idx) => ({ ...c, order: idx + 1 }));
  await writeConfig(config);
}

function renderNavRow(): any[] {
  return [
    buildButtons([
      { id: 'naviedit:back', label: '뒤로가기', style: ButtonStyle.Secondary },
      { id: 'naviedit:home', label: '처음으로', style: ButtonStyle.Primary },
    ]),
  ];
}

function renderHomeRow(): any[] {
  return [buildButtons([{ id: 'naviedit:home', label: '처음으로', style: ButtonStyle.Primary }])];
}

function sortByPosition(a: TextChannel | VoiceChannel | ForumChannel | CategoryChannel, b: TextChannel | VoiceChannel | ForumChannel | CategoryChannel) {
  return (a.position ?? 0) - (b.position ?? 0);
}

async function listUnassignedChannels(interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction) {
  if (!interaction.guild) return [];
  const config = await readConfig();
  const assigned = new Set(Object.keys(config.channelRegistry));
  const channels = interaction.guild.channels.cache
    .filter((ch) => ch.type !== ChannelType.GuildCategory && (ch as any).isTextBased?.())
    .filter((ch): ch is TextChannel | VoiceChannel | ForumChannel | CategoryChannel => !!ch && 'position' in ch)
    .sort(sortByPosition)
    .filter((ch) => !assigned.has(ch.id))
    .map((ch) => ({ label: ch.name, value: ch.id }))
    .slice(0, 25);
  return channels;
}

async function listCategoryChannels(interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction, categoryId: string) {
  if (!interaction.guild) return [];
  const config = await readConfig();
  const channelIds = getChannelsByCategory(config, categoryId);
  const channels = channelIds
    .map((id) => interaction.guild!.channels.cache.get(id))
    .filter((ch): ch is TextChannel | VoiceChannel | ForumChannel | CategoryChannel => !!ch && 'position' in ch)
    .sort(sortByPosition)
    .map((ch, idx) => ({ label: `${idx + 1}. ${ch.name}`, value: ch.id }));
  return channels;
}

async function listAssignedChannels(interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction) {
  if (!interaction.guild) return [];
  const config = await readConfig();
  const assignedIds = Object.keys(config.channelRegistry);
  const channels = assignedIds
    .map((id) => interaction.guild!.channels.cache.get(id))
    .filter((ch): ch is TextChannel | VoiceChannel | ForumChannel | CategoryChannel => !!ch && 'position' in ch)
    .sort(sortByPosition)
    .map((ch) => ({ label: ch.name, value: ch.id }));
  return channels;
}

function renderAddChannelStart(options: { available: { label: string; value: string }[]; selectedCount: number }) {
  const rows = [
    buildStringSelect('naviedit:add:channels', '채널 선택 (최대 25개)', options.available, 25),
    buildButtons([{ id: 'naviedit:add:channels:confirm', label: '확인', style: ButtonStyle.Success }]),
  ];
  return renderAdmin(
    `내비게이터에 추가할 카테고리가 없는 채널을 선택해주세요 (최대 25개)\n현재 선택: ${options.selectedCount}개`,
    rows,
    EDIT_ACCENT,
  );
}

function renderAddMethod() {
  const rows = [
    buildButtons([
      { id: 'naviedit:add:method:existing', label: '기존 카테고리에 추가하기', style: ButtonStyle.Secondary },
      { id: 'naviedit:add:method:new', label: '새 카테고리에 추가하기', style: ButtonStyle.Success },
    ]),
    ...renderNavRow(),
  ];
  return renderAdmin('아래 채널들을 추가할 카테고리를 선택해주세요', rows, EDIT_ACCENT);
}

function renderPickCategory(categories: { id: string; name: string }[]) {
  const options = categories.map((c) => ({ label: c.name, value: c.id }));
  const rows = [buildStringSelect('naviedit:add:existing:category', '카테고리 선택', options), ...renderNavRow()];
  return renderAdmin('추가할 카테고리를 정해주세요', rows, EDIT_ACCENT);
}

function renderAddConfirm(count: number, categoryName: string, overrideWarnings: string[]) {
  const lines = [`총 ${count}개의 채널을 ${categoryName}에 추가하시겠습니까?`];
  if (overrideWarnings.length > 0) {
    lines.push('아래 채널은 다른 카테고리에 이미 있습니다. 이동합니다:');
    lines.push(...overrideWarnings.map((w) => `• ${w}`));
  }
  const rows = [
    buildButtons([
      { id: 'naviedit:add:confirm:submit', label: '확인', style: ButtonStyle.Success },
      { id: 'naviedit:add:confirm:cancel', label: '취소', style: ButtonStyle.Secondary },
    ]),
    ...renderNavRow(),
  ];
  return renderAdmin(lines.join('\n'), rows, EDIT_ACCENT);
}

function renderDeleteStart(options: { available: { label: string; value: string }[]; selectedCount: number }) {
  const rows = [
    buildStringSelect('naviedit:delete:channels', '삭제할 채널 선택 (최대 25개)', options.available, 25),
    buildButtons([{ id: 'naviedit:delete:confirm', label: '확인', style: ButtonStyle.Success }]),
  ];
  return renderAdmin(
    `내비게이터에서 삭제할 카테고리가 있는 채널을 선택해주세요 (최대 25개)\n현재 선택: ${options.selectedCount}개`,
    rows,
    EDIT_ACCENT,
  );
}

function renderDeleteConfirm(grouped: Record<string, string[]>) {
  const lines = [
    '정말 이 채널들을 관리자 권한으로 내비게이션에서 삭제하시겠습니까?',
    '카테고리 안에 채널이 존재하지 않게 되면 해당 카테고리도 자동으로 삭제됩니다.',
    '이 변경사항은 서버 내 모든 유저에게 반영됩니다.',
    '자주 변경하면 사용자에게 혼란을 줄 수 있습니다.',
  ];
  for (const [category, channels] of Object.entries(grouped)) {
    lines.push(`\n${category}`);
    channels.forEach((ch) => lines.push(`• ${ch}`));
  }
  const rows = [buildButtons([
    { id: 'naviedit:delete:submit', label: '삭제', style: ButtonStyle.Danger },
    { id: 'naviedit:delete:undo', label: '실행취소', style: ButtonStyle.Primary },
  ])];
  return renderAdmin(lines.join('\n'), rows, EDIT_ACCENT);
}

function renderOrderPickCategory(categories: { id: string; name: string }[]) {
  const options = categories.map((c) => ({ label: c.name, value: c.id }));
  const rows = [buildStringSelect('naviedit:order:category', '카테고리 선택', options), ...renderHomeRow()];
  return renderAdmin('순서를 변경할 채널의 카테고리를 정해주세요', rows, EDIT_ACCENT);
}

function renderOrderPickChannel(categoryName: string, options: { label: string; value: string }[]) {
  const rows = [buildStringSelect('naviedit:order:channel', `${categoryName} 채널 선택`, options), ...renderHomeRow()];
  return renderAdmin('순서를 변경할 채널을 선택하세요', rows, EDIT_ACCENT);
}

function renderOrderPickPosition(categoryName: string, options: { label: string; value: string }[]) {
  const rows = [buildStringSelect('naviedit:order:position', '새 위치 선택', options), ...renderHomeRow()];
  return renderAdmin(`${categoryName} 카테고리 안에서 선택한 채널의 새로운 자리를 정해주세요`, rows, EDIT_ACCENT);
}

function renderCategoryOrderPick(categories: { id: string; name: string }[]) {
  const options = categories.map((c, idx) => ({ label: `${idx + 1}. ${c.name}`, value: c.id }));
  const rows = [buildStringSelect('naviedit:catorder:category', '카테고리 선택', options), ...renderHomeRow()];
  return renderAdmin('순서를 변경할 카테고리를 정해주세요', rows, EDIT_ACCENT);
}

function renderCategoryOrderPosition(categoryName: string, options: { label: string; value: string }[]) {
  const rows = [buildStringSelect('naviedit:catorder:position', '새 위치 선택', options), ...renderHomeRow()];
  return renderAdmin(`${categoryName} 카테고리의 새로운 자리를 정해주세요`, rows, EDIT_ACCENT);
}

export async function handleEditCommand(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  mode: EditMode,
) {
  const session = startEditSession(interaction.user.id, mode);
  const respond = async (payload: any) => {
    if (interaction instanceof ButtonInteraction) {
      await interaction.deferUpdate();
      await interaction.editReply(payload);
    } else {
      await interaction.reply(payload);
    }
  };
  switch (mode) {
    case 'ADD_CHANNEL':
      if (!interaction.guild) {
        await respond({ content: '길드에서만 사용할 수 있습니다.', flags: MessageFlags.Ephemeral });
        break;
      }
      {
        const available = await listUnassignedChannels(interaction);
        if (available.length === 0) {
          await respond({ ...renderAdmin('추가할 채널이 없습니다.', renderHomeRow()), flags: MessageFlags.Ephemeral });
          break;
        }
        await respond({
          ...renderAddChannelStart({
            available,
            selectedCount: 0,
          }),
          flags: MessageFlags.Ephemeral,
        });
      }
      break;
    case 'DELETE_CHANNEL':
      session.current = { step: 'DELETE_PICK_CHANNELS', channels: [] };
      {
        const available = await listAssignedChannels(interaction);
        if (available.length === 0) {
          await respond({ ...renderAdmin('삭제할 채널이 없습니다.', renderHomeRow()), flags: MessageFlags.Ephemeral });
          break;
        }
        await respond({
          ...renderDeleteStart({ available, selectedCount: 0 }),
          flags: MessageFlags.Ephemeral,
        });
      }
      break;
    case 'ORDER_CHANNEL': {
      session.current = { step: 'ORDER_PICK_CATEGORY' };
      const config = await readConfig();
      const categories = [...config.categories].sort((a, b) => a.order - b.order);
      await respond({ ...renderOrderPickCategory(categories), flags: MessageFlags.Ephemeral });
      break;
    }
    case 'ORDER_CATEGORY': {
      session.current = { step: 'CATEGORY_ORDER_PICK' };
      const config = await readConfig();
      const categories = [...config.categories].sort((a, b) => a.order - b.order);
      await respond({ ...renderCategoryOrderPick(categories), flags: MessageFlags.Ephemeral });
      break;
    }
  }
}

async function handleAddChannelsSelect(interaction: StringSelectMenuInteraction) {
  if (!ensureModerator(interaction)) return;
  const session = getEditSession(interaction.user.id);
  if (!session) return;
  if (session.mode !== 'ADD_CHANNEL') return;
  if (session.current.step !== 'PICK_ADD_CHANNELS') return;
  const selected = interaction.values.slice(0, 25);
  setEditSession(interaction.user.id, { step: 'PICK_ADD_CHANNELS', channels: selected });
  await interaction.deferUpdate();
  await interaction.editReply(
    renderAddChannelStart({ available: await listUnassignedChannels(interaction), selectedCount: selected.length }),
  );
}

async function handleAddChannelsConfirm(interaction: ButtonInteraction) {
  if (!ensureModerator(interaction)) return;
  const session = getEditSession(interaction.user.id);
  if (!session || session.mode !== 'ADD_CHANNEL') return;
  if (session.current.step !== 'PICK_ADD_CHANNELS') return;
  const channels = session.current.channels;
  await interaction.deferUpdate();
  if (channels.length === 0) {
    await interaction.editReply(renderAdmin('채널을 선택해주세요.', renderNavRow(), EDIT_ACCENT));
    return;
  }
  setEditSession(interaction.user.id, { step: 'ADD_METHOD', channels });
  await interaction.editReply(renderAddMethod());
}

async function handleAddMethod(interaction: ButtonInteraction) {
  const session = getEditSession(interaction.user.id);
  if (!session || session.mode !== 'ADD_CHANNEL') return;
  if (session.current.step !== 'ADD_METHOD') return;
  if (interaction.customId === 'naviedit:add:method:existing') {
    await interaction.deferUpdate();
    const config = await readConfig();
    const categories = [...config.categories].sort((a, b) => a.order - b.order);
    setEditSession(interaction.user.id, { step: 'ADD_EXISTING_CATEGORY', channels: session.current.channels });
    await interaction.editReply(renderPickCategory(categories));
  } else if (interaction.customId === 'naviedit:add:method:new') {
    const modal = new ModalBuilder()
      .setCustomId('naviedit:add:newname')
      .setTitle('새 카테고리 이름')
      .addComponents([
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('name')
            .setLabel('새 카테고리의 이름을 정해주세요')
            .setStyle(TextInputStyle.Short)
            .setRequired(true),
        ),
      ]);
    await interaction.showModal(modal);
  }
}

async function handleAddExistingCategory(interaction: StringSelectMenuInteraction) {
  const session = getEditSession(interaction.user.id);
  if (!session || session.mode !== 'ADD_CHANNEL') return;
  if (session.current.step !== 'ADD_EXISTING_CATEGORY') return;
  const categoryId = interaction.values[0];
  const config = await readConfig();
  const category = config.categories.find((c) => c.id === categoryId);
  if (!category) {
    await interaction.reply({ content: '카테고리를 찾을 수 없습니다.', flags: MessageFlags.Ephemeral });
    return;
  }
  const overrides: string[] = [];
  session.current.channels.forEach((ch) => {
    const entry = config.channelRegistry[ch];
    if (entry && entry.categoryId !== categoryId) {
      overrides.push(`<#${ch}> (${config.categories.find((c) => c.id === entry.categoryId)?.name ?? '기존'})`);
    }
  });
  setEditSession(interaction.user.id, {
    step: 'ADD_CONFIRM',
    channels: session.current.channels,
    categoryId,
    categoryName: category.name,
    overrideNeeded: overrides,
  });
  await interaction.update(renderAddConfirm(session.current.channels.length, category.name, overrides));
}

async function applyChannelAdd(sessionData: any) {
  const { channels, categoryId } = sessionData;
  const config = await readConfig();
  const touched = new Set<string>();
  for (const ch of channels) {
    const existing = config.channelRegistry[ch];
    if (existing) {
      touched.add(existing.categoryId);
      delete config.channelRegistry[ch];
    }
  }
  touched.forEach((catId) => {
    const list = getChannelsByCategory(config, catId);
    list.forEach((id: string, idx: number) => {
      if (config.channelRegistry[id]) {
        config.channelRegistry[id].position = idx + 1;
      }
    });
  });
  const existingInCategory = getChannelsByCategory(config, categoryId);
  channels.forEach((ch: string, idx: number) => {
    config.channelRegistry[ch] = { categoryId, position: existingInCategory.length + idx + 1 };
  });
  await writeConfig(config);
}

async function handleAddConfirm(interaction: ButtonInteraction, isSubmit: boolean) {
  const session = getEditSession(interaction.user.id);
  if (!session || session.mode !== 'ADD_CHANNEL') return;
  if (session.current.step !== 'ADD_CONFIRM') return;
  await interaction.deferUpdate();
  if (!isSubmit) {
    await interaction.editReply(renderAddMethod());
    setEditSession(interaction.user.id, { step: 'ADD_METHOD', channels: session.current.channels });
    return;
  }
  await applyChannelAdd(session.current);
  await removeEmptyCategories();
  setEditSession(interaction.user.id, { step: 'PICK_ADD_CHANNELS', channels: [] });
  await interaction.editReply(renderAdmin('채널이 추가되었습니다.', renderHomeRow(), EDIT_ACCENT));
}

async function handleNewCategoryModal(interaction: ModalSubmitInteraction) {
  if (!interaction.customId.startsWith('naviedit:add:newname')) return;
  const session = getEditSession(interaction.user.id);
  if (!session || session.mode !== 'ADD_CHANNEL') return;
  if (session.current.step !== 'ADD_METHOD') return;
  const name = interaction.fields.getTextInputValue('name').trim();
  const config = await readConfig();
  const categories = [...config.categories].sort((a, b) => a.order - b.order);
  const options = Array.from({ length: categories.length + 1 }).map((_, idx) => ({
    label: `${idx + 1}번 위치`,
    value: String(idx),
  }));
  const { channels } = session.current;
  setEditSession(interaction.user.id, { step: 'ADD_NEW_CATEGORY_ORDER', channels, categoryName: name });
  await interaction.reply({
    ...renderAdmin(
      '사용자에게 보여질 새 카테고리 순서를 정해주세요',
      [buildStringSelect('naviedit:add:new:order', '순서 선택', options), ...renderNavRow()],
      EDIT_ACCENT,
    ),
    flags: MessageFlags.Ephemeral,
  });
}

async function handleNewCategoryOrder(interaction: StringSelectMenuInteraction) {
  const session = getEditSession(interaction.user.id);
  if (!session || session.mode !== 'ADD_CHANNEL') return;
  if (session.current.step !== 'ADD_NEW_CATEGORY_ORDER') return;
  const position = parseInt(interaction.values[0], 10);
  const config = await readConfig();
  const warnings: string[] = [];
  session.current.channels.forEach((ch) => {
    const entry = config.channelRegistry[ch];
    if (entry) {
      warnings.push(`<#${ch}> (${config.categories.find((c) => c.id === entry.categoryId)?.name ?? '기존'})`);
    }
  });
  setEditSession(interaction.user.id, {
    step: 'ADD_NEW_CONFIRM',
    channels: session.current.channels,
    categoryName: session.current.categoryName,
    position,
    overrideNeeded: warnings,
  });
  await interaction.update(renderAddConfirm(session.current.channels.length, session.current.categoryName, warnings));
}

async function handleAddNewConfirm(interaction: ButtonInteraction, isSubmit: boolean) {
  const session = getEditSession(interaction.user.id);
  if (!session || session.mode !== 'ADD_CHANNEL') return;
  if (session.current.step !== 'ADD_NEW_CONFIRM') return;
  await interaction.deferUpdate();
  if (!isSubmit) {
    await interaction.editReply(renderAddMethod());
    setEditSession(interaction.user.id, { step: 'ADD_METHOD', channels: session.current.channels });
    return;
  }
  const config = await readConfig();
  const id = uniqueCategoryId(session.current.categoryName, config.categories.map((c) => c.id));
  const newCategory = { id, name: session.current.categoryName, order: 0 };
  await insertCategoryAt(newCategory, session.current.position);
  await applyChannelAdd({ channels: session.current.channels, categoryId: id });
  await removeEmptyCategories();
  setEditSession(interaction.user.id, { step: 'PICK_ADD_CHANNELS', channels: [] });
  await interaction.editReply(renderAdmin('새 카테고리가 생성되고 채널이 추가되었습니다.', renderHomeRow(), EDIT_ACCENT));
}

async function handleDeleteSelect(interaction: StringSelectMenuInteraction) {
  const session = getEditSession(interaction.user.id);
  if (!session || session.mode !== 'DELETE_CHANNEL') return;
  if (session.current.step !== 'DELETE_PICK_CHANNELS') return;
  const selected = interaction.values.slice(0, 25);
  setEditSession(interaction.user.id, { step: 'DELETE_PICK_CHANNELS', channels: selected });
  await interaction.deferUpdate();
  await interaction.editReply(
    renderDeleteStart({ available: await listAssignedChannels(interaction), selectedCount: selected.length }),
  );
}

async function handleDeleteConfirmPrompt(interaction: ButtonInteraction) {
  const session = getEditSession(interaction.user.id);
  if (!session || session.mode !== 'DELETE_CHANNEL') return;
  if (session.current.step !== 'DELETE_PICK_CHANNELS') return;
  await interaction.deferUpdate();
  const channels = session.current.channels;
  if (channels.length === 0) {
    await interaction.editReply(renderAdmin('삭제할 채널을 선택해주세요.', renderNavRow(), EDIT_ACCENT));
    return;
  }
  const config = await readConfig();
  const grouped: Record<string, string[]> = {};
  channels.forEach((ch) => {
    const entry = config.channelRegistry[ch];
    if (!entry) return;
    const categoryName = config.categories.find((c) => c.id === entry.categoryId)?.name ?? '알 수 없음';
    if (!grouped[categoryName]) grouped[categoryName] = [];
    grouped[categoryName].push(`<#${ch}>`);
  });
  setEditSession(interaction.user.id, { step: 'DELETE_CONFIRM', channels });
  await interaction.editReply(renderDeleteConfirm(grouped));
}

async function handleDeleteSubmit(interaction: ButtonInteraction) {
  const session = getEditSession(interaction.user.id);
  if (!session || session.mode !== 'DELETE_CHANNEL') return;
  if (session.current.step !== 'DELETE_CONFIRM') return;
  await interaction.deferUpdate();
  for (const ch of session.current.channels) {
    await unregisterChannel(ch);
  }
  await removeEmptyCategories();
  setEditSession(interaction.user.id, { step: 'DELETE_PICK_CHANNELS', channels: [] });
  await interaction.editReply(renderAdmin('채널이 카테고리에서 삭제되었습니다.', renderHomeRow(), EDIT_ACCENT));
}

async function handleDeleteUndo(interaction: ButtonInteraction) {
  const session = getEditSession(interaction.user.id);
  if (!session || session.mode !== 'DELETE_CHANNEL') return;
  if (session.current.step !== 'DELETE_CONFIRM') return;
  const prev = session.current.channels ?? [];
  setEditSession(interaction.user.id, { step: 'DELETE_PICK_CHANNELS', channels: prev });
  await interaction.deferUpdate();
  await interaction.editReply(
    renderDeleteStart({ available: await listAssignedChannels(interaction), selectedCount: prev.length }),
  );
}

async function handleOrderCategory(interaction: StringSelectMenuInteraction) {
  const session = getEditSession(interaction.user.id);
  if (!session || session.mode !== 'ORDER_CHANNEL') return;
  if (session.current.step !== 'ORDER_PICK_CATEGORY') return;
  const categoryId = interaction.values[0];
  const config = await readConfig();
  const category = config.categories.find((c) => c.id === categoryId);
  if (!category) {
    await interaction.reply({ content: '카테고리를 찾을 수 없습니다.', flags: MessageFlags.Ephemeral });
    return;
  }
  setEditSession(interaction.user.id, { step: 'ORDER_PICK_CHANNEL', categoryId });
  const options = await listCategoryChannels(interaction, categoryId);
  await interaction.update(renderOrderPickChannel(category.name, options));
}

async function handleOrderChannelSelect(interaction: StringSelectMenuInteraction) {
  const session = getEditSession(interaction.user.id);
  if (!session || session.mode !== 'ORDER_CHANNEL') return;
  if (session.current.step !== 'ORDER_PICK_CHANNEL') return;
  const channelId = interaction.values[0];
  const config = await readConfig();
  const { categoryId } = session.current;
  const channels = getChannelsByCategory(config, categoryId);
  if (!channels.includes(channelId)) {
    await interaction.reply({ content: '선택한 채널은 해당 카테고리에 없습니다.', flags: MessageFlags.Ephemeral });
    return;
  }
  const options = channels
    .map((id, idx) => ({ label: `${idx + 1}. ${interaction.guild?.channels.cache.get(id)?.name ?? '채널'}`, value: String(idx) }))
    .filter((opt, idx) => channels[idx] !== channelId);
  setEditSession(interaction.user.id, { step: 'ORDER_PICK_POSITION', categoryId, channelId });
  const categoryName = config.categories.find((c) => c.id === categoryId)?.name ?? '';
  await interaction.update(renderOrderPickPosition(categoryName, options));
}

async function handleOrderPosition(interaction: StringSelectMenuInteraction) {
  const session = getEditSession(interaction.user.id);
  if (!session || session.mode !== 'ORDER_CHANNEL') return;
  if (session.current.step !== 'ORDER_PICK_POSITION') return;
  const targetIndex = parseInt(interaction.values[0], 10);
  const { categoryId, channelId } = session.current;
  await reorderChannels(categoryId, channelId, targetIndex);
  setEditSession(interaction.user.id, { step: 'ORDER_PICK_CATEGORY' });
  await interaction.update(renderAdmin('채널 순서가 변경되었습니다.', renderHomeRow(), EDIT_ACCENT));
}

async function handleCatOrderSelect(interaction: StringSelectMenuInteraction) {
  const session = getEditSession(interaction.user.id);
  if (!session || session.mode !== 'ORDER_CATEGORY') return;
  if (session.current.step !== 'CATEGORY_ORDER_PICK') return;
  const categoryId = interaction.values[0];
  const config = await readConfig();
  const categories = [...config.categories].sort((a, b) => a.order - b.order);
  const currentIdx = categories.findIndex((c) => c.id === categoryId);
  const options = categories
    .map((c, idx) => ({ label: `${idx + 1}. ${c.name}`, value: String(idx) }))
    .filter((_, idx) => idx !== currentIdx);
  setEditSession(interaction.user.id, { step: 'CATEGORY_ORDER_POSITION', categoryId });
  const categoryName = categories.find((c) => c.id === categoryId)?.name ?? '';
  await interaction.update(renderCategoryOrderPosition(categoryName, options));
}

async function handleCatOrderPosition(interaction: StringSelectMenuInteraction) {
  const session = getEditSession(interaction.user.id);
  if (!session || session.mode !== 'ORDER_CATEGORY') return;
  if (session.current.step !== 'CATEGORY_ORDER_POSITION') return;
  const targetIndex = parseInt(interaction.values[0], 10);
  await reorderCategory(session.current.categoryId, targetIndex);
  setEditSession(interaction.user.id, { step: 'CATEGORY_ORDER_PICK' });
  await interaction.update(renderAdmin('카테고리 순서가 변경되었습니다.', renderHomeRow(), EDIT_ACCENT));
}

async function handleNav(interaction: ButtonInteraction) {
  const session = getEditSession(interaction.user.id);
  if (!session) {
    await interaction.reply({ content: '세션이 만료되었습니다. /navi_edit 명령을 다시 실행하세요.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.customId === 'naviedit:home') {
    endEditSession(interaction.user.id);
    await handleEditCommand(interaction, session.mode);
    return;
  }
  if (interaction.customId === 'naviedit:back') {
    // simple back: restart current mode from beginning
    endEditSession(interaction.user.id);
    await handleEditCommand(interaction, session.mode);
  }
}

export async function handleEditInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction) {
  if (!interaction.customId.startsWith('naviedit:')) return false;
  if (!ensureModerator(interaction)) {
    await interaction.reply({ content: '권한이 필요합니다.', flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'naviedit:add:channels:confirm') {
      await handleAddChannelsConfirm(interaction);
      return true;
    }
    if (interaction.customId === 'naviedit:add:method:existing' || interaction.customId === 'naviedit:add:method:new') {
      await handleAddMethod(interaction);
      return true;
    }
    if (interaction.customId === 'naviedit:add:confirm:submit') {
      await handleAddConfirm(interaction, true);
      return true;
    }
    if (interaction.customId === 'naviedit:add:confirm:cancel') {
      await handleAddConfirm(interaction, false);
      return true;
    }
    if (interaction.customId === 'naviedit:delete:confirm') {
      await handleDeleteConfirmPrompt(interaction);
      return true;
    }
    if (interaction.customId === 'naviedit:delete:submit') {
      await handleDeleteSubmit(interaction);
      return true;
    }
    if (interaction.customId === 'naviedit:delete:undo') {
      await handleDeleteUndo(interaction);
      return true;
    }
    if (interaction.customId === 'naviedit:back' || interaction.customId === 'naviedit:home') {
      await handleNav(interaction);
      return true;
    }
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'naviedit:add:channels') {
      await handleAddChannelsSelect(interaction);
      return true;
    }
    if (interaction.customId === 'naviedit:delete:channels') {
      await handleDeleteSelect(interaction);
      return true;
    }
    if (interaction.customId === 'naviedit:order:channel') {
      await handleOrderChannelSelect(interaction);
      return true;
    }
    if (interaction.customId === 'naviedit:add:existing:category') {
      await handleAddExistingCategory(interaction);
      return true;
    }
    if (interaction.customId === 'naviedit:add:new:order') {
      await handleNewCategoryOrder(interaction);
      return true;
    }
    if (interaction.customId === 'naviedit:order:category') {
      await handleOrderCategory(interaction);
      return true;
    }
    if (interaction.customId === 'naviedit:order:position') {
      await handleOrderPosition(interaction);
      return true;
    }
    if (interaction.customId === 'naviedit:catorder:category') {
      await handleCatOrderSelect(interaction);
      return true;
    }
    if (interaction.customId === 'naviedit:catorder:position') {
      await handleCatOrderPosition(interaction);
      return true;
    }
  }

  return true;
}

export async function handleEditModalInteraction(interaction: ModalSubmitInteraction) {
  if (interaction.customId.startsWith('naviedit:add:newname')) {
    await handleNewCategoryModal(interaction);
    return true;
  }
  return false;
}
