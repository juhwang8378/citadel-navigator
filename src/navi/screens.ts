import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type InteractionEditReplyOptions,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import type { Category } from '../storage/configStore.js';

export type ChannelOption = {
  id: string;
  name: string;
};

export type RenderResult = InteractionEditReplyOptions & {
  components: any[];
};

function toContainers(rows: ActionRowBuilder<MessageActionRowComponentBuilder>[]): any[] {
  return rows.map((row) => row.toJSON());
}

function buildSelect(
  customId: string,
  placeholder: string,
  options: StringSelectMenuOptionBuilder[],
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions(options);
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}

function buildChannelSelect(
  customId: string,
  placeholder: string,
  maxValues = 1,
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  const menu = new ChannelSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMaxValues(maxValues);
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu);
}

function buildNavRow(options: { showBack?: boolean; showHome?: boolean }): ActionRowBuilder<MessageActionRowComponentBuilder> | null {
  const buttons: ButtonBuilder[] = [];
  if (options.showBack) {
    buttons.push(
      new ButtonBuilder().setCustomId('navi:nav:back').setLabel('뒤로가기').setStyle(ButtonStyle.Secondary),
    );
  }
  if (options.showHome) {
    buttons.push(
      new ButtonBuilder().setCustomId('navi:nav:home').setLabel('홈으로').setStyle(ButtonStyle.Primary),
    );
  }
  if (buttons.length === 0) return null;
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(buttons);
}

// Screen A: 홈
export function renderHome(options: { favorites: string[]; hasBack: boolean }): RenderResult {
  const { favorites, hasBack } = options;
  const favoritesText = favorites.length > 0 ? favorites.map((f) => `• ${f}`).join('\n') : '즐겨찾기가 없습니다.';
  const mainRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId('navi:home:go').setLabel('이동하기').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('navi:home:edit').setLabel('즐겨찾기 편집').setStyle(ButtonStyle.Secondary),
  );
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [mainRow];
  const navRow = buildNavRow({ showBack: hasBack });
  if (navRow) rows.push(navRow);

  return {
    content: `**채널 내비게이터**\n원하는 채널로 이동하거나 즐겨찾기를 관리하세요.\n\n즐겨찾기:\n${favoritesText}\n`,
    components: toContainers(rows),
  };
}

// Screen B: 카테고리 선택
export function renderPickCategory(options: { categories: Category[]; canGoBack: boolean }): RenderResult {
  const selectOptions: StringSelectMenuOptionBuilder[] = options.categories.map((cat) =>
    new StringSelectMenuOptionBuilder().setLabel(cat.name).setValue(cat.id),
  );
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
    buildSelect('navi:pickcat', '카테고리 선택', selectOptions),
  ];
  const navRow = buildNavRow({ showBack: options.canGoBack, showHome: true });
  if (navRow) rows.push(navRow);
  return {
    content: '카테고리를 선택하세요.',
    components: toContainers(rows),
  };
}

// Screen C: 채널 목록
export function renderChannelList(options: {
  categoryName: string;
  categoryId: string;
  channels: ChannelOption[];
  canGoBack: boolean;
}): RenderResult {
  const navRow = buildNavRow({ showBack: options.canGoBack, showHome: true });
  const channelOpts = options.channels.map((ch) => new StringSelectMenuOptionBuilder().setLabel(ch.name).setValue(ch.id));
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
    buildSelect(`navi:chanlist:${options.categoryId}`, `${options.categoryName} 채널 선택`, channelOpts),
  ];
  if (navRow) rows.push(navRow);

  return {
    content: `카테고리: ${options.categoryName}\n아래에서 이동할 채널을 선택하세요.`,
    components: toContainers(rows),
  };
}

// Screen D: 즐겨찾기 편집
export function renderEditFavorites(options: {
  hasCurrentChannel: boolean;
  notice?: string;
  canGoBack: boolean;
}): RenderResult {
  const { hasCurrentChannel, notice, canGoBack } = options;
  const opts: StringSelectMenuOptionBuilder[] = [
    new StringSelectMenuOptionBuilder()
      .setLabel('현재 채널을 즐겨찾기에 추가')
      .setValue('ADD_CURRENT')
      .setDescription(hasCurrentChannel ? '지금 보고 있는 채널을 추가' : '현재 채널이 없어 선택 불가')
      .setEmoji({ name: '⭐' }),
    new StringSelectMenuOptionBuilder().setLabel('즐겨찾기에서 삭제').setValue('REMOVE'),
    new StringSelectMenuOptionBuilder().setLabel('즐겨찾기 순서 변경').setValue('REORDER'),
  ];

  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
    buildSelect('navi:editfav', '메뉴를 선택하세요', opts),
  ];
  const navRow = buildNavRow({ showBack: canGoBack, showHome: true });
  if (navRow) rows.push(navRow);

  return {
    content: `${notice ? `${notice}\n\n` : ''}즐겨찾기(최대 5개)를 추가/삭제/순서 변경할 수 있습니다.`,
    components: toContainers(rows),
  };
}

// Screen E: 즐겨찾기 삭제
export function renderRemoveFavorite(options: {
  favorites: ChannelOption[];
  canGoBack: boolean;
}): RenderResult {
  const opts: StringSelectMenuOptionBuilder[] = options.favorites.map((fav) =>
    new StringSelectMenuOptionBuilder().setLabel(`#${fav.name}`).setValue(fav.id),
  );
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [
    buildSelect('navi:removefav', '즐겨찾기 선택', opts),
  ];
  const navRow = buildNavRow({ showBack: options.canGoBack, showHome: true });
  if (navRow) rows.push(navRow);
  return {
    content: '삭제할 즐겨찾기를 선택하세요.',
    components: toContainers(rows),
  };
}

// Screen F: 즐겨찾기 순서 변경
export function renderReorderFavorite(options: {
  favorites: ChannelOption[];
  sourceIndex?: number;
  canGoBack: boolean;
}): RenderResult {
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  let content = '즐겨찾기 순서를 변경하세요.';

  if (options.sourceIndex === undefined) {
    const firstOptions: StringSelectMenuOptionBuilder[] = options.favorites.map((fav, idx) =>
      new StringSelectMenuOptionBuilder().setLabel(`#${fav.name}`).setValue(String(idx)),
    );
    rows.push(buildSelect('navi:reorder:pick', '이동할 즐겨찾기를 선택하세요', firstOptions));
    content = '순서를 변경할 즐겨찾기를 선택하세요.';
  } else {
    const selected = options.favorites[options.sourceIndex];
    const moveOptions: StringSelectMenuOptionBuilder[] = options.favorites.map((fav, idx) =>
      new StringSelectMenuOptionBuilder().setLabel(`${idx + 1}번 위치로 이동`).setValue(String(idx)),
    );
    rows.push(buildSelect('navi:reorder:target', '이동할 위치 선택(1~마지막)', moveOptions));
    const selectedText = selected ? `#${selected.name}` : '선택된 즐겨찾기';
    content = `${selectedText}의 즐겨찾기 순서를 변경하세요.`;
  }

  const navRow = buildNavRow({ showBack: options.canGoBack, showHome: true });
  if (navRow) rows.push(navRow);

  return {
    content,
    components: toContainers(rows),
  };
}

export function renderInfoMessage(
  text: string,
  nav?: { showBack?: boolean; showHome?: boolean },
): RenderResult {
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];
  if (nav) {
    const navRow = buildNavRow(nav);
    if (navRow) {
      rows.push(navRow);
    }
  }
  if (rows.length === 0) {
    rows.push(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder().setCustomId('navi:noop').setLabel('확인').setStyle(ButtonStyle.Secondary).setDisabled(true),
      ),
    );
  }
  return {
    content: text,
    components: toContainers(rows),
  };
}
