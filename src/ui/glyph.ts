/** 显示层红黑棋字映射:红帅仕相、黑将士象,兵卒有别。
 * 引擎 PieceType 保持规则文档中文(帅/士/象/车/马/炮/兵),仅显示时映射。 */

import type { Color, Piece, PieceType } from '../game/types';

export const GLYPH: Record<Color, Record<PieceType, string>> = {
  red: { 帅: '帅', 士: '仕', 象: '相', 车: '车', 马: '马', 炮: '炮', 兵: '兵' },
  black: { 帅: '将', 士: '士', 象: '象', 车: '车', 马: '马', 炮: '炮', 兵: '卒' },
};

export function glyphOf(piece: Piece): string {
  return GLYPH[piece.color][piece.type];
}
