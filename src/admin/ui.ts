import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';

export const EDIT_ACCENT = undefined;
export const VIEW_ACCENT = undefined;

export type AdminRender = {
  content: string;
  components: any[];
  ephemeral?: boolean;
};

function toContainers(rows: ActionRowBuilder<MessageActionRowComponentBuilder>[]): any[] {
  return rows.map((row) => row.toJSON());
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
  maxValues = 1,
): ActionRowBuilder<MessageActionRowComponentBuilder> {
  const safeMax = Math.max(1, Math.min(maxValues, opts.length || 1));
  const select = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(safeMax)
    .addOptions(opts.map((o) => new StringSelectMenuOptionBuilder().setLabel(o.label).setValue(o.value)));
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(select);
}

export function renderAdmin(content: string, rows: ActionRowBuilder<MessageActionRowComponentBuilder>[], accent = EDIT_ACCENT): AdminRender {
  return { content, components: toContainers(rows) };
}
