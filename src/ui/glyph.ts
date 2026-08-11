/** 显示层红黑棋字映射:参照中国象棋传统繁体字样。
 * 车統一"車"[jū]、红炮"炮"黑"砲"、红黑馬"馬"。
 * 引擎 PieceType 保持规则文档中文(帅/士/象/车/马/炮/兵),仅显示时映射。 */

import type { Color, Piece, PieceType } from '../game/types';

export const GLYPH: Record<Color, Record<PieceType, string>> = {
  red: { 帅: '帅', 士: '仕', 象: '相', 车: '車', 马: '馬', 炮: '炮', 兵: '兵' },
  black: { 帅: '将', 士: '士', 象: '象', 车: '車', 马: '馬', 炮: '砲', 兵: '卒' },
};

export function glyphOf(piece: Piece): string {
  return GLYPH[piece.color][piece.type];
}
