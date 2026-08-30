/** 测试夹具:四份测试文件共用的棋盘/状态构造 helper。仅供测试,引擎与运行时不得引用。 */

import type {
  Cell,
  Color,
  GameState,
  Piece,
  PieceType,
  PlayerState,
} from '../game/types';
import { BOARD_H, BOARD_W } from '../game/types';

export function P(type: PieceType, color: Color = 'red'): Piece {
  return { type, color };
}
export const open = (...pieces: Piece[]): Cell => ({ kind: 'open', pieces });
export const down = (p: Piece): Cell => ({ kind: 'facedown', piece: p });
export const empty = (): Cell => ({ kind: 'open', pieces: [] });

export function emptyBoard(): Cell[][] {
  return Array.from({ length: BOARD_H }, () =>
    Array.from({ length: BOARD_W }, empty),
  );
}

export function mk(
  cells: Cell[][] = emptyBoard(),
  p0: Partial<PlayerState> = {},
  p1: Partial<PlayerState> = {},
  current: 0 | 1 = 0,
): GameState {
  return {
    board: cells,
    players: [
      { color: 'red', inventory: [], ...p0 },
      { color: 'black', inventory: [], ...p1 },
    ],
    current,
    winner: null,
    draw: false,
    history: [],
    moveLog: [],
    options: { useEnemyForPlace: false, eatFacedown: false, allowLowCapture: false },
  };
}

/** 在 (x, y) 放棋,board[y][x] */
export function put(s: GameState, x: number, y: number, cell: Cell): void {
  s.board[y]![x] = cell;
}

export const xy = (x: number, y: number) => ({ x, y });
