/**
 * 记谱文本生成单测:五种动作、红黑视角换算、吃子数量、走棋方推导。
 * 坐标约定:引擎坐标 board[y][x],x 0-3 物理左→右,y 0-7 物理上→下(红下黑上)。
 */

import { describe, expect, it } from 'vitest';
import { applyMove } from '../game/state';
import type { Cell, GameState, Piece, PieceType, PlayerState } from '../game/types';
import { BOARD_H, BOARD_W } from '../game/types';
import { moverColor, moverOf, notationFor } from './notation';

// ---------- 构造 helper ----------

function P(type: PieceType, color: 'red' | 'black' = 'red'): Piece {
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
    moveLog: [],
    options: { useEnemyForPlace: false, eatFacedown: false, allowLowCapture: false },
  };
}

function put(s: GameState, x: number, y: number, cell: Cell): void {
  s.board[y]![x] = cell;
}

const xy = (x: number, y: number) => ({ x, y });

describe('走棋方推导', () => {
  it('applyMove 后行动权切换,走棋方为对方', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('兵', 'red')));
    put(s, 1, 0, open(P('兵', 'black')));
    const s2 = applyMove(s, { kind: 'move', from: xy(0, 0), to: xy(1, 0) });
    expect(s2.current).toBe(1);
    expect(moverOf(s2)).toBe(0);
    expect(moverColor(s2)).toBe('red');
  });
});

describe('翻棋记谱', () => {
  it('首翻红棋:走棋方成为红方,按红视角记坐标', () => {
    const s = mk(emptyBoard(), { color: null }, { color: null });
    put(s, 0, 7, down(P('车', 'red'))); // 物理左下,红视角 (4,1)
    const s2 = applyMove(s, { kind: 'flip', pos: xy(0, 7) });
    expect(notationFor({ kind: 'flip', pos: xy(0, 7) }, null, s2)).toBe(
      '翻(4,1)車',
    );
  });

  it('首翻黑棋:走棋方成为黑方,按黑视角记坐标', () => {
    const s = mk(emptyBoard(), { color: null }, { color: null });
    put(s, 3, 0, down(P('兵', 'black'))); // 物理右上,黑视角 (4,1)
    const s2 = applyMove(s, { kind: 'flip', pos: xy(3, 0) });
    expect(notationFor({ kind: 'flip', pos: xy(3, 0) }, null, s2)).toBe(
      '翻(4,1)卒',
    );
  });
});

describe('移动记谱', () => {
  it('红方移动:按红视角记起点与终点', () => {
    const before = mk(emptyBoard(), {}, {}, 1); // 轮到玩家1,即本步为玩家0(红)走
    put(before, 0, 0, open(P('车', 'red'))); // 物理左上,红视角 (4,8)
    const after = mk(emptyBoard(), {}, {}, 1);
    expect(
      notationFor(
        { kind: 'move', from: xy(0, 0), to: xy(3, 7) },
        before,
        after,
      ),
    ).toBe('車(4,8)→(1,1)');
  });

  it('黑方移动:按黑视角记坐标', () => {
    const before = mk(emptyBoard(), {}, {}, 0); // 轮到玩家0,即本步为玩家1(黑)走
    put(before, 0, 0, open(P('车', 'black'))); // 物理左上,黑视角 (1,1)
    const after = mk(emptyBoard(), {}, {}, 0);
    expect(
      notationFor(
        { kind: 'move', from: xy(0, 0), to: xy(1, 0) },
        before,
        after,
      ),
    ).toBe('車(1,1)→(2,1)');
  });

  it('吃整叠:记被吃顶层子名与数量', () => {
    const before = mk(emptyBoard(), {}, {}, 0); // 黑方走
    put(before, 0, 0, open(P('车', 'black')));
    put(before, 1, 0, open(P('兵', 'black'), P('兵', 'black'))); // 吃己方 2 层
    const after = mk(emptyBoard(), {}, {}, 0);
    expect(
      notationFor(
        { kind: 'move', from: xy(0, 0), to: xy(1, 0) },
        before,
        after,
      ),
    ).toBe('車(1,1)→(2,1)×卒×2');
  });

  it('吃单枚:不记数量', () => {
    const before = mk(emptyBoard(), {}, {}, 1); // 红方走
    put(before, 0, 0, open(P('车', 'red')));
    put(before, 1, 0, open(P('马', 'black')));
    const after = mk(emptyBoard(), {}, {}, 1);
    expect(
      notationFor(
        { kind: 'move', from: xy(0, 0), to: xy(1, 0) },
        before,
        after,
      ),
    ).toBe('車(4,8)→(3,8)×馬');
  });
});

describe('放置/叠层/取层记谱', () => {
  it('放置:子名与目标坐标(红视角)', () => {
    const after = mk(emptyBoard(), {}, {}, 1); // 红方走
    expect(
      notationFor(
        { kind: 'place', piece: P('马', 'red'), to: xy(0, 7) },
        null,
        after,
      ),
    ).toBe('放馬(4,1)');
  });

  it('叠层:子名与目标坐标加数量(黑视角)', () => {
    const after = mk(emptyBoard(), {}, {}, 0); // 黑方走
    expect(
      notationFor(
        { kind: 'stack', piece: P('兵', 'black'), to: xy(2, 3), count: 2 },
        null,
        after,
      ),
    ).toBe('叠卒(3,4)+2');
  });

  it('取层:子名取自已方叠层顶层(黑视角)', () => {
    const before = mk(emptyBoard(), {}, {}, 0); // 黑方走
    put(before, 0, 0, open(P('兵', 'black'), P('车', 'black'))); // 顶层车
    const after = mk(emptyBoard(), {}, {}, 0);
    expect(
      notationFor({ kind: 'peel', from: xy(0, 0), count: 1 }, before, after),
    ).toBe('取車(1,1)−1');
  });
});
