import type { Command } from './types.js';
import { naviCommand } from './navi.js';
import { naviRegisterCommand } from './navi_register.js';
import { naviUnregisterCommand } from './navi_unregister.js';
import { naviCategoryAddCommand } from './navi_category_add.js';
import { naviCategoryRemoveCommand } from './navi_category_remove.js';

export const commands: Command[] = [
  naviCommand,
  naviRegisterCommand,
  naviUnregisterCommand,
  naviCategoryAddCommand,
  naviCategoryRemoveCommand,
];
