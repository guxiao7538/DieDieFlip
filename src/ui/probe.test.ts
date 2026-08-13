/**
 * 满盘局面下的交互测试:全棋盘占满后吃子产生空格,库存棋选中后仍可放置。
 */
import { describe, expect, it } from 'vitest';
import type { Cell, GameState, Piece, PieceType, PlayerState } from '../game/types';
import { BOARD_H, BOARD_W } from '../game/types';
import { computeHighlights, createUiState, handleInvClick } from './interaction';
import { legalMoves } from '../game/moves';

function P(type: PieceType, color: 'red' | 'black' = 'red'): Piece { return { type, color }; }
const open = (...pieces: Piece[]): Cell => ({ kind: 'open', pieces });
const empty = (): Cell => ({ kind: 'open', pieces: [] });
function emptyBoard(): Cell[][] {
  return Array.from({ length: BOARD_H }, () => Array.from({ length: BOARD_W }, empty));
}
function mk(cells: Cell[][] = emptyBoard(), p0: Partial<PlayerState> = {}, p1: Partial<PlayerState> = {}, current: 0 | 1 = 0): GameState {
  return {
    board: cells,
    players: [{ color: 'red', inventory: [], ...p0 }, { color: 'black', inventory: [], ...p1 }],
    current, winner: null, draw: false, history: [], moveLog: [],
    options: { useEnemyForPlace: false, eatFacedown: false, allowLowCapture: false },
  };
}

describe('满盘局面', () => {
  it('吃子产生空格后,库存棋选中可获得放置目标', () => {
    const s = mk(emptyBoard(), { inventory: [P('炮', 'red')] }, {}, 0);
    // 棋盘除 (0,0) 外全部占满(模拟吃子后留下的空格)
    const cells: [PieceType, 'red' | 'black'][] = Array.from({ length: 31 }, (_, i) =>
      i % 2 === 0 ? ['兵', 'red'] : ['兵', 'black'],
    );
    let k = 0;
    for (let y = 0; y < BOARD_H; y++) {
      for (let x = 0; x < BOARD_W; x++) {
        if (k === 0) { k++; continue; }
        const [t, c] = cells[k - 1]!;
        s.board[y]![x] = open(P(t, c));
        k++;
      }
    }
    const moves = legalMoves(s, 0);
    expect(moves.some((m) => m.kind === 'place')).toBe(true);
    const ui = handleInvClick(s, createUiState(), P('炮', 'red'));
    const hl = computeHighlights(s, ui);
    expect(hl.placeTargets).toHaveLength(1);
    expect(hl.placeTargets[0]).toEqual({ x: 0, y: 0 });
  });
});
