import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  InteractionReplyOptions,
  InteractionEditReplyOptions,
} from 'discord.js';

type AnyInteraction =
  | ChatInputCommandInteraction
  | StringSelectMenuInteraction
  | ButtonInteraction
  | ModalSubmitInteraction;

type ReplyPayload = InteractionReplyOptions | InteractionEditReplyOptions | any;

async function logAndSend(
  interaction: AnyInteraction,
  payload: ReplyPayload,
  context: string,
  action: 'reply' | 'edit' | 'follow',
): Promise<void> {
  console.log(`[navi-debug:${context}] sending ${action}`, JSON.stringify(payload, null, 2));
  try {
    if (action === 'reply') {
      await (interaction as any).reply(payload);
    } else {
      if (action === 'edit') {
        await (interaction as any).editReply(payload);
      } else {
        await (interaction as any).followUp(payload);
      }
    }
  } catch (err: any) {
    console.error(`[navi-debug:${context}] failed`, err?.rawError ?? err);
    if (err?.rawError?.errors) {
      console.error(`[navi-debug:${context}] raw errors`, JSON.stringify(err.rawError.errors, null, 2));
    }
    throw err;
  }
}

export async function safeEditReply(interaction: AnyInteraction, payload: ReplyPayload, context: string): Promise<void> {
  await logAndSend(interaction, payload, context, 'edit');
}

export async function safeReply(interaction: AnyInteraction, payload: ReplyPayload, context: string): Promise<void> {
  await logAndSend(interaction, payload, context, 'reply');
}

export async function safeFollowUp(interaction: AnyInteraction, payload: ReplyPayload, context: string): Promise<void> {
  await logAndSend(interaction, payload, context, 'follow');
}
