/**
 * 记谱文本生成:坐标式,坐标按走棋方视角标注,与棋盘四边刻度一致。
 * 引擎坐标为红方座位视角(x 0-3 物理左→右,y 0-7 物理上→下,红方在下);
 * 红方走棋转红视角(列 4-x、行 8-y),黑方走棋转黑视角(列 x+1、行 y+1)。
 * 纯函数,零 DOM 依赖,可独立单测。
 */

import { cellAt } from '../game/moves';
import type { Color, GameState, Move, Piece, Pos } from '../game/types';
import { glyphOf } from './glyph';

/** 本步走棋方:applyMove 后行动权已切换,故为对方 */
export function moverOf(after: GameState): 0 | 1 {
  return after.current === 0 ? 1 : 0;
}

/** 本步走棋方阵营颜色(开局首翻后即已确定,不会为 null) */
export function moverColor(after: GameState): Color | null {
  return after.players[moverOf(after)]?.color ?? null;
}

function toView(pos: Pos, color: Color): Pos {
  if (color === 'red') return { x: 4 - pos.x, y: 8 - pos.y };
  return { x: pos.x + 1, y: pos.y + 1 };
}

function coord(p: Pos): string {
  return `(${p.x},${p.y})`;
}

function topAt(state: GameState | null, pos: Pos): Piece | null {
  if (!state) return null;
  const cell = cellAt(state.board, pos);
  return cell.kind === 'open' ? (cell.pieces.at(-1) ?? null) : null;
}

/**
 * 生成一步的记谱动作文本(不含回合号与颜色前缀,由记谱面板拼接)。
 * @param before 本步之前的状态快照(= history[i]);翻棋/放置/叠层用不到,可为 null
 * @param after  本步之后的状态快照(最后一步为当前 state,其余为 history[i+1])
 */
export function notationFor(
  move: Move,
  before: GameState | null,
  after: GameState,
): string {
  // 阵营未定(仅开局第一翻前)按先手座位(红视角)记坐标
  const view = moverColor(after) ?? 'red';

  switch (move.kind) {
    case 'flip': {
      const top = topAt(after, move.pos);
      return `翻${coord(toView(move.pos, view))}${top ? glyphOf(top) : ''}`;
    }
    case 'move': {
      const src = topAt(before, move.from);
      const name = src ? glyphOf(src) : '';
      let text = `${name}${coord(toView(move.from, view))}→${coord(toView(move.to, view))}`;
      // 被吃整叠:记顶层子名,超过一枚记数量
      const tgt = before ? cellAt(before.board, move.to) : null;
      if (tgt && tgt.kind === 'open' && tgt.pieces.length > 0) {
        const cap = tgt.pieces[tgt.pieces.length - 1]!;
        text += `×${glyphOf(cap)}${tgt.pieces.length > 1 ? `×${tgt.pieces.length}` : ''}`;
      }
      return text;
    }
    case 'place':
      return `放${glyphOf(move.piece)}${coord(toView(move.to, view))}`;
    case 'stack':
      return `叠${glyphOf(move.piece)}${coord(toView(move.to, view))}+${move.count}`;
    case 'peel': {
      const src = topAt(before, move.from);
      const name = src ? glyphOf(src) : '';
      return `取${name}${coord(toView(move.from, view))}−${move.count}`;
    }
  }
}
