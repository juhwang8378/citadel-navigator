import { SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import { handleNaviCommand } from '../navi/handlers.js';

export const naviCommand: Command = {
  data: new SlashCommandBuilder().setName('navi').setDescription('채널 내비게이터를 엽니다.'),
  execute: handleNaviCommand,
};
