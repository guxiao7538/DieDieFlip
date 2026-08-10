/**
 * 交互状态机单测:上下文分派规则(点暗格翻棋、点己方棋选中、
 * 点目标执行、吃己方棋目标优先于切换选中、库存棋放置/叠层、取层角标)。
 */

import { describe, expect, it } from 'vitest';
import type { Cell, Color, GameState, Piece, PieceType, PlayerState } from '../game/types';
import { BOARD_H, BOARD_W } from '../game/types';
import {
  confirmCount,
  createUiState,
  handleCellClick,
  handleInvClick,
} from './interaction';

// ---------- 构造 helper ----------

function P(type: PieceType, color: Color = 'red'): Piece {
  return { type, color };
}
const open = (...pieces: Piece[]): Cell => ({ kind: 'open', pieces });
const down = (p: Piece): Cell => ({ kind: 'facedown', piece: p });
const empty = (): Cell => ({ kind: 'open', pieces: [] });

function emptyBoard(): Cell[][] {
  return Array.from({ length: BOARD_H }, () =>
    Array.from({ length: BOARD_W }, empty),
  );
}

function mk(
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
    options: { useEnemyForPlace: false, eatFacedown: false },
  };
}

function put(s: GameState, x: number, y: number, cell: Cell): void {
  s.board[y]![x] = cell;
}

const xy = (x: number, y: number) => ({ x, y });

describe('棋盘点击分派', () => {
  it('点暗格直接翻棋', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 1, 1, down(P('兵', 'red')));
    const ui = createUiState();
    const r = handleCellClick(s, ui, xy(1, 1));
    expect(r.state).not.toBeNull();
    expect(r.state!.history).toHaveLength(1);
  });

  it('点己方叠层选中,点目标执行移动', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('车', 'red')));
    put(s, 1, 0, open(P('兵', 'black')));
    const ui = createUiState();
    const r1 = handleCellClick(s, ui, xy(0, 0));
    expect(r1.state).toBeNull();
    expect(r1.ui.selectedPos).toEqual(xy(0, 0));
    const r2 = handleCellClick(s, r1.ui, xy(1, 0));
    expect(r2.state).not.toBeNull();
    expect(r2.state!.current).toBe(1);
  });

  it('吃己方棋的目标格优先于切换选中', () => {
    // 回归:选中红车后点相邻红兵(合法吃己方),应执行吃子而非切换选中
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('车', 'red')));
    put(s, 1, 0, open(P('兵', 'red')));
    const ui = createUiState();
    const r1 = handleCellClick(s, ui, xy(0, 0));
    const r2 = handleCellClick(s, r1.ui, xy(1, 0));
    expect(r2.state).not.toBeNull(); // 执行了吃己方
    expect(r2.state!.players[0].inventory).toEqual([P('兵', 'red')]);
    expect(r2.ui.selectedPos).toBeNull(); // 选中被清除
  });

  it('再点选中格取消选中,点非目标己方叠层切换选中', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('兵', 'red')));
    put(s, 0, 2, open(P('兵', 'red')));
    const ui = createUiState();
    const r1 = handleCellClick(s, ui, xy(0, 0));
    expect(r1.ui.selectedPos).toEqual(xy(0, 0));
    // 再点同一格取消
    const r2 = handleCellClick(s, r1.ui, xy(0, 0));
    expect(r2.ui.selectedPos).toBeNull();
    // 点另一己方叠层切换
    const r3 = handleCellClick(s, ui, xy(0, 0));
    const r4 = handleCellClick(s, r3.ui, xy(0, 2));
    expect(r4.ui.selectedPos).toEqual(xy(0, 2));
  });
});

describe('库存棋点击分派', () => {
  it('点库存棋选中,点空格放置', () => {
    const s = mk(emptyBoard(), { inventory: [P('兵', 'red')] }, {}, 0);
    const ui = createUiState();
    const ui2 = handleInvClick(s, ui, P('兵', 'red'));
    expect(ui2.selectedInv).toEqual(P('兵', 'red'));
    const r = handleCellClick(s, ui2, xy(3, 7));
    expect(r.state).not.toBeNull();
    expect(r.state!.board[7]![3]).toEqual(open(P('兵', 'red')));
  });

  it('点库存棋后点同类叠层 → 弹数量选择器 → 确认执行', () => {
    const s = mk(emptyBoard(), { inventory: [P('兵', 'red'), P('兵', 'red')] }, {}, 0);
    put(s, 0, 0, open(P('兵', 'red')));
    const ui = handleInvClick(s, createUiState(), P('兵', 'red'));
    const r = handleCellClick(s, ui, xy(0, 0));
    expect(r.state).toBeNull();
    expect(r.ui.countDlg).toMatchObject({ kind: 'stack', min: 1, max: 2 });
    const r2 = confirmCount(s, { ...r.ui, countDlg: { ...r.ui.countDlg!, value: 2 } });
    expect(r2.state).not.toBeNull();
    const pile = r2.state!.board[0]![0]!;
    expect(pile.kind === 'open' ? pile.pieces.length : 0).toBe(3);
  });

  it('点库存棋后点非目标格取消库存选中', () => {
    const s = mk(emptyBoard(), { inventory: [P('兵', 'red')] }, {}, 0);
    const ui = handleInvClick(s, createUiState(), P('兵', 'red'));
    const r = handleCellClick(s, ui, xy(0, 0)); // 空格是合法放置目标……
    expect(r.state).not.toBeNull(); // ……所以这里实际放置了
    // 用全占局面验证取消
    const s2 = mk(emptyBoard(), { inventory: [P('兵', 'red')] }, {}, 0);
    put(s2, 0, 0, open(P('车', 'red')));
    const ui2 = handleInvClick(s2, createUiState(), P('兵', 'red'));
    const r2 = handleCellClick(s2, ui2, xy(0, 0)); // 车格:非放置/叠层目标
    expect(r2.state).toBeNull();
    expect(r2.ui.selectedInv).toBeNull();
  });
});

describe('取层操作条', () => {
  it('选中层数>=2 的己方叠层:自动弹出取层条,确认后执行', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('兵', 'red'), P('兵', 'red'), P('车', 'red')));
    const ui = createUiState();
    const r1 = handleCellClick(s, ui, xy(0, 0));
    expect(r1.ui.selectedPos).toEqual(xy(0, 0));
    expect(r1.ui.countDlg).toMatchObject({ kind: 'peel', min: 1, max: 2 });
    const r3 = confirmCount(s, { ...r1.ui, countDlg: { ...r1.ui.countDlg!, value: 2 } });
    expect(r3.state).not.toBeNull();
    expect(r3.state!.players[0].inventory).toEqual([P('兵', 'red'), P('车', 'red')]);
  });

  it('取层条打开时点棋盘目标:正常执行移动并关闭条', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('兵', 'red'), P('兵', 'red'), P('车', 'red'))); // 顶层车,可走远
    put(s, 2, 0, open(P('兵', 'black')));
    const ui = createUiState();
    const r1 = handleCellClick(s, ui, xy(0, 0)); // 选中,弹出取层条
    expect(r1.ui.countDlg).not.toBeNull();
    const r2 = handleCellClick(s, r1.ui, xy(2, 0)); // 点吃子目标
    expect(r2.state).not.toBeNull();
    expect(r2.state!.players[0].inventory).toEqual([P('兵', 'black')]);
    expect(r2.ui.countDlg).toBeNull();
  });

  it('单层己方叠层不弹取层条', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('兵', 'red')));
    const ui = createUiState();
    const r1 = handleCellClick(s, ui, xy(0, 0));
    expect(r1.ui.selectedPos).toEqual(xy(0, 0));
    expect(r1.ui.countDlg).toBeNull();
  });

  it('敌方顶层叠层不可选中,不弹取层条(ADR-0001)', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('车', 'black'), P('车', 'black')));
    const ui = createUiState();
    const r1 = handleCellClick(s, ui, xy(0, 0));
    expect(r1.ui.selectedPos).toBeNull();
    expect(r1.ui.countDlg).toBeNull();
  });
});

describe('终局防护', () => {
  it('终局后点击不产生任何操作', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('兵', 'red')));
    put(s, 1, 0, open(P('兵', 'black')));
    // 手动构造终局
    const ended = { ...s, winner: 0 as const };
    const r = handleCellClick(ended, createUiState(), xy(0, 0));
    expect(r.state).toBeNull();
  });
});
