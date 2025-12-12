import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type APISelectMenuOption,
  type InteractionReplyOptions,
} from 'discord.js';
import type { Category } from '../storage/configStore.js';

export type ChannelOption = {
  id: string;
  name: string;
  description: string;
};

export type RenderResult = InteractionReplyOptions & {
  components: ActionRowBuilder<StringSelectMenuBuilder>[];
};

const BACK_VALUE = 'BACK';

function buildSelect(customId: string, placeholder: string, options: APISelectMenuOption[]): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions(options);
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

// Screen A: 홈
export function renderHome(options: { favorites: string[]; hasBack: boolean }): RenderResult {
  const { favorites, hasBack } = options;
  const favoritesText = favorites.length > 0 ? favorites.map((f) => `• ${f}`).join('\n') : '즐겨찾기가 없습니다.';
  const selectOptions: APISelectMenuOption[] = [
    new StringSelectMenuOptionBuilder().setLabel('이동하기').setValue('GO'),
    new StringSelectMenuOptionBuilder().setLabel('즐겨찾기 편집').setValue('EDIT'),
  ];
  if (hasBack) {
    selectOptions.push(new StringSelectMenuOptionBuilder().setLabel('뒤로가기').setValue(BACK_VALUE));
  }
  return {
    content: `**채널 내비게이터**\n원하는 채널로 이동하거나 즐겨찾기를 관리하세요.\n\n즐겨찾기:\n${favoritesText}`,
    components: [buildSelect('navi:home', '메뉴를 선택하세요', selectOptions)],
  };
}

// Screen B: 카테고리 선택
export function renderPickCategory(categories: Category[]): RenderResult {
  const options: APISelectMenuOption[] = categories.map((cat) =>
    new StringSelectMenuOptionBuilder().setLabel(cat.name).setValue(cat.id),
  );
  options.push(new StringSelectMenuOptionBuilder().setLabel('뒤로가기').setValue(BACK_VALUE));
  return {
    content: '카테고리를 선택하세요.',
    components: [buildSelect('navi:pickcat', '카테고리 선택', options)],
  };
}

// Screen C: 채널 목록 + 선택
export function renderChannelList(options: {
  categoryName: string;
  categoryId: string;
  channels: ChannelOption[];
  selectedChannelId?: string;
  jumpUrl?: string;
}): RenderResult {
  const channelOptions: APISelectMenuOption[] = options.channels.map((ch) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`#${ch.name} — ${ch.description}`)
      .setValue(ch.id)
      .setDescription('이 채널로 이동 링크 보기'),
  );
  channelOptions.push(new StringSelectMenuOptionBuilder().setLabel('뒤로가기').setValue(BACK_VALUE));

  const rows: ActionRowBuilder<StringSelectMenuBuilder>[] = [
    buildSelect(`navi:chanlist:${options.categoryId}`, '채널 선택', channelOptions),
  ];

  if (options.selectedChannelId) {
    const actionOptions: APISelectMenuOption[] = [
      new StringSelectMenuOptionBuilder().setLabel('즐겨찾기에 추가').setValue('FAV_ADD'),
      new StringSelectMenuOptionBuilder().setLabel('뒤로가기').setValue(BACK_VALUE),
      new StringSelectMenuOptionBuilder().setLabel('홈으로').setValue('HOME'),
    ];
    rows.push(buildSelect(`navi:chanactions:${options.categoryId}`, '다음 작업을 선택하세요', actionOptions));
  }

  const selectionText = options.selectedChannelId
    ? `<#${options.selectedChannelId}> 로 이동: ${options.jumpUrl ?? ''}`.trim()
    : '';

  return {
    content: `카테고리: ${options.categoryName}\n채널을 선택하면 해당 채널로 이동할 수 있는 링크를 보여줍니다.\n${selectionText}`,
    components: rows,
  };
}

// Screen D: 즐겨찾기 편집
export function renderEditFavorites(options: { hasCurrentChannel: boolean; notice?: string }): RenderResult {
  const { hasCurrentChannel, notice } = options;
  const opts: APISelectMenuOption[] = [
    new StringSelectMenuOptionBuilder()
      .setLabel('현재 채널을 즐겨찾기에 추가')
      .setValue('ADD_CURRENT')
      .setDescription(hasCurrentChannel ? '지금 보고 있는 채널을 추가' : '현재 채널이 없어 선택 불가')
      .setDefault(false)
      .setEmoji({ name: '⭐' }),
    new StringSelectMenuOptionBuilder().setLabel('카테고리에서 채널 선택해 추가').setValue('ADD_FROM_CATEGORY'),
    new StringSelectMenuOptionBuilder().setLabel('즐겨찾기에서 삭제').setValue('REMOVE'),
    new StringSelectMenuOptionBuilder().setLabel('즐겨찾기 순서 변경').setValue('REORDER'),
    new StringSelectMenuOptionBuilder().setLabel('뒤로가기').setValue(BACK_VALUE),
    new StringSelectMenuOptionBuilder().setLabel('홈으로').setValue('HOME'),
  ];

  if (!hasCurrentChannel) {
    opts[0].setDefault(true).setDescription('현재 채널이 없어요');
  }

  return {
    content: `${notice ? `${notice}\n\n` : ''}즐겨찾기(최대 5개)를 추가/삭제/순서 변경할 수 있습니다.`,
    components: [buildSelect('navi:editfav', '메뉴를 선택하세요', opts)],
  };
}

// Screen E: 즐겨찾기 추가 - 카테고리 선택
export function renderAddFavPickCategory(categories: Category[]): RenderResult {
  const opts: APISelectMenuOption[] = categories.map((cat) =>
    new StringSelectMenuOptionBuilder().setLabel(cat.name).setValue(cat.id),
  );
  opts.push(new StringSelectMenuOptionBuilder().setLabel('뒤로가기').setValue(BACK_VALUE));
  return {
    content: '즐겨찾기에 추가할 채널의 카테고리를 선택하세요.',
    components: [buildSelect('navi:addfavcat', '카테고리 선택', opts)],
  };
}

// Screen F: 즐겨찾기 추가 - 채널 선택
export function renderAddFavPickChannel(options: {
  categoryName: string;
  categoryId: string;
  channels: ChannelOption[];
}): RenderResult {
  const opts: APISelectMenuOption[] = options.channels.map((ch) =>
    new StringSelectMenuOptionBuilder().setLabel(`#${ch.name} — ${ch.description}`).setValue(ch.id),
  );
  opts.push(new StringSelectMenuOptionBuilder().setLabel('뒤로가기').setValue(BACK_VALUE));
  return {
    content: `카테고리 "${options.categoryName}"에서 즐겨찾기에 추가할 채널을 선택하세요.`,
    components: [buildSelect(`navi:addfavchan:${options.categoryId}`, '채널 선택', opts)],
  };
}

// Screen G: 즐겨찾기 삭제
export function renderRemoveFavorite(favorites: ChannelOption[]): RenderResult {
  const opts: APISelectMenuOption[] = favorites.map((fav) =>
    new StringSelectMenuOptionBuilder().setLabel(`#${fav.name}`).setValue(fav.id).setDescription(fav.description),
  );
  opts.push(new StringSelectMenuOptionBuilder().setLabel('뒤로가기').setValue(BACK_VALUE));
  return {
    content: '삭제할 즐겨찾기를 선택하세요.',
    components: [buildSelect('navi:removefav', '즐겨찾기 선택', opts)],
  };
}

// Screen H: 즐겨찾기 순서 변경 (2단계)
export function renderReorderFavorite(options: {
  favorites: ChannelOption[];
  sourceIndex?: number;
}): RenderResult {
  const firstOptions: APISelectMenuOption[] = options.favorites.map((fav, idx) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`#${fav.name}`)
      .setValue(String(idx))
      .setDescription(fav.description),
  );
  firstOptions.push(new StringSelectMenuOptionBuilder().setLabel('뒤로가기').setValue(BACK_VALUE));

  const rows: ActionRowBuilder<StringSelectMenuBuilder>[] = [
    buildSelect('navi:reorder:pick', '이동할 즐겨찾기를 선택하세요', firstOptions),
  ];

  if (options.sourceIndex !== undefined) {
    const moveOptions: APISelectMenuOption[] = options.favorites.map((fav, idx) =>
      new StringSelectMenuOptionBuilder()
        .setLabel(`${idx + 1}번 위치로 이동`)
        .setValue(String(idx))
        .setDescription(`#${fav.name}`),
    );
    moveOptions.push(new StringSelectMenuOptionBuilder().setLabel('뒤로가기').setValue(BACK_VALUE));
    rows.push(buildSelect('navi:reorder:target', '이동할 위치 선택(1~마지막)', moveOptions));
  }

  return {
    content: '즐겨찾기 순서를 변경하세요.',
    components: rows,
  };
}

export function renderInfoMessage(text: string): RenderResult {
  return {
    content: text,
    components: [],
  };
}
