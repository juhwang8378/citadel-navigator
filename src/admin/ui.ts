import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';

export const EDIT_ACCENT = 0xed0000;
export const VIEW_ACCENT = 0x0073ed;

const COMPONENTS_FLAG = 1 << 15;

export type AdminRender = {
  embeds: { description: string }[];
  components: any[];
  flags?: number;
  ephemeral?: boolean;
};

function toContainers(rows: ActionRowBuilder<MessageActionRowComponentBuilder>[], accent: number): any[] {
  return rows.map((row) => ({ ...row.toJSON(), accent_color: accent }));
}

export function buildButtons(buttons: { id: string; label: string; style: ButtonStyle }[]): ActionRowBuilder<MessageActionRowComponentBuilder> {
  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>();
  buttons.forEach((btn) => {
    row.addComponents(new ButtonBuilder().setCustomId(btn.id).setLabel(btn.label).setStyle(btn.style));
  });
  return row;
}

export function buildStringSelect(
  customId: string,
  placeholder: string,
  opts: { label: string; value: string }[],
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  const select = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions(opts.map((o) => new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value)));
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(select);
}

export function buildChannelSelect(
  customId: string,
  placeholder: string,
  maxValues: number,
  channelTypes?: number[],
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  const select = new ChannelSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMaxValues(maxValues);
  if (channelTypes) {
    select.setChannelTypes(channelTypes as any);
  }
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(select);
}

export function renderAdmin(content: string, rows: ActionRowBuilder<MessageActionRowComponentBuilder>[], accent = EDIT_ACCENT): AdminRender {
  return { embeds: [{ description: content }], components: toContainers(rows, accent), flags: COMPONENTS_FLAG };
}
