import type { Command } from './types.js';
import { naviCommand } from './navi.js';
import { naviAddCommand } from './navi_add.js';
import { naviCategoryAddCommand } from './navi_category_add.js';
import { naviCategoryRemoveCommand } from './navi_category_remove.js';
import { naviRemoveCommand } from './navi_remove.js';

export const commands: Command[] = [
  naviCommand,
  naviAddCommand,
  naviRemoveCommand,
  naviCategoryAddCommand,
  naviCategoryRemoveCommand,
];
