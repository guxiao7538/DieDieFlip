/** 一副完整中国象棋棋子(红黑各一套,共 32 枚)与走法定义。 */

import type { Color, Piece, PieceType } from './types';

function set(color: Color, types: [PieceType, number][]): Piece[] {
  return types.flatMap(([type, n]) =>
    Array.from({ length: n }, () => ({ type, color })),
  );
}

/** 单套 16 枚:帅1 士2 象2 车2 马2 炮2 兵5 */
export function halfSet(color: Color): Piece[] {
  return set(color, [
    ['帅', 1],
    ['士', 2],
    ['象', 2],
    ['车', 2],
    ['马', 2],
    ['炮', 2],
    ['兵', 5],
  ]);
}

/** 完整一副 32 枚 */
export function fullSet(): Piece[] {
  return [...halfSet('red'), ...halfSet('black')];
}

/** 按翻翻棋规则“小兵”走法的棋种:士/象/帅/将/兵 横竖各一格 */
export function isPawnLike(type: PieceType): boolean {
  return type === '士' || type === '象' || type === '帅' || type === '兵';
}
