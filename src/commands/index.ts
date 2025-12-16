import type { Command } from './types.js';
import { naviCommand } from './navi.js';
import { naviEditCommand } from './navi_edit.js';
import { naviViewCommand } from './navi_view.js';

export const commands: Command[] = [naviCommand, naviEditCommand, naviViewCommand];
