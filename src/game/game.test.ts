/**
 * 规则引擎单元测试:五操作合法性、叠层/层数机制、胜负判定、悔棋。
 * 坐标约定:xy(x, y) 对应 board[y][x],统一经 put() 写入。
 */

import { describe, expect, it } from 'vitest';
import { fullSet } from './pieces';
import { cellAt, isLegalMove, legalMoves, targetsFor, targetsInRange, topOf } from './moves';
import {
  applyMove,
  countPieces,
  createInitialState,
  markDraw,
  surrender,
  undo,
} from './state';
import type {
  Cell,
  Color,
  GameState,
  Piece,
  PieceType,
  PlayerState,
} from './types';
import { BOARD_H, BOARD_W } from './types';

// ---------- 测试构造 helper ----------

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

/** 在 (x, y) 放棋,board[y][x] */
function put(s: GameState, x: number, y: number, cell: Cell): void {
  s.board[y]![x] = cell;
}

const xy = (x: number, y: number) => ({ x, y });

// ---------- 开局与翻棋 ----------

describe('开局', () => {
  it('32 格全部为暗格,含完整一副 32 棋', () => {
    const s = createInitialState();
    const downs: Piece[] = [];
    for (let y = 0; y < BOARD_H; y++) {
      for (let x = 0; x < BOARD_W; x++) {
        const c = cellAt(s.board, xy(x, y));
        expect(c.kind).toBe('facedown');
        if (c.kind === 'facedown') downs.push(c.piece);
      }
    }
    expect(downs).toHaveLength(32);
    const key = (p: Piece) => `${p.color}:${p.type}`;
    expect(downs.map(key).sort()).toEqual(fullSet().map(key).sort());
  });

  it('阵营未定时只能翻棋', () => {
    const s = createInitialState();
    expect(legalMoves(s, 0).every((m) => m.kind === 'flip')).toBe(true);
  });

  it('翻棋揭幕:首位翻棋者定阵营,对方自动归属另一色', () => {
    const s = createInitialState();
    const flip = legalMoves(s, 0).find(
      (m): m is Extract<typeof m, { kind: 'flip' }> => m.kind === 'flip',
    )!;
    const flipped = cellAt(s.board, flip.pos);
    const color = flipped.kind === 'facedown' ? flipped.piece.color : 'red';
    const s2 = applyMove(s, flip);
    expect(s2.players[0].color).toBe(color);
    expect(s2.players[1].color).toBe(color === 'red' ? 'black' : 'red');
    expect(s2.current).toBe(1);
    expect(s2.winner).toBeNull();
  });

  it('第二枚翻出同色棋时,双方阵营仍保持一红一黑', () => {
    const s = createInitialState();
    const flips = legalMoves(s, 0).filter(
      (m): m is Extract<typeof m, { kind: 'flip' }> => m.kind === 'flip',
    );
    // 找一枚与第一枚同色的暗格给第二位翻
    const first = flips[0]!;
    const firstColor = (() => {
      const c = cellAt(s.board, first.pos);
      return c.kind === 'facedown' ? c.piece.color : 'red';
    })();
    const secondPos = flips.find(
      (f) =>
        !(f.pos.x === first.pos.x && f.pos.y === first.pos.y) &&
        (() => {
          const c = cellAt(s.board, f.pos);
          return c.kind === 'facedown' && c.piece.color === firstColor;
        })(),
    )!;
    const s2 = applyMove(s, first);
    const s3 = applyMove(s2, { kind: 'flip', pos: secondPos.pos });
    const c0 = s3.players[0].color;
    const c1 = s3.players[1].color;
    expect(c0).not.toBeNull();
    expect(c1).not.toBeNull();
    expect(c0).not.toBe(c1); // 双方颜色不同,不存在"两个红方"
  });

  it('棋子总数守恒:吃子后棋盘+库存总数不变', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 1, 1, open(P('车', 'red')));
    put(s, 3, 1, open(P('兵', 'black')));
    const s2 = applyMove(s, { kind: 'move', from: xy(1, 1), to: xy(3, 1) });
    expect(countPieces(s2, 0) + countPieces(s2, 1)).toBe(
      countPieces(s, 0) + countPieces(s, 1),
    );
  });
});

// ---------- 移动与走法 ----------

describe('移动', () => {
  it('车:直线延伸,途经空格,目标可吃(层数满足),被棋阻挡不可越过', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 2, open(P('车', 'red')));
    put(s, 1, 2, open(P('兵', 'black'))); // 紧邻,可吃
    put(s, 3, 2, open(P('兵', 'black'))); // 被 (1,2) 阻挡,不可达
    const targets = targetsFor(s, xy(0, 2));
    expect(targets).toContainEqual(xy(1, 2)); // 吃
    expect(targets).toContainEqual(xy(0, 1)); // 上方空格
    expect(targets).not.toContainEqual(xy(2, 2)); // 被阻挡
    expect(targets).not.toContainEqual(xy(3, 2)); // 被阻挡
  });

  it('车:路径遇暗格即停,不可越过', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 2, open(P('车', 'red')));
    put(s, 1, 2, down(P('兵', 'black')));
    const targets = targetsFor(s, xy(0, 2));
    expect(targets).not.toContainEqual(xy(1, 2)); // 暗格不可落子
    expect(targets).not.toContainEqual(xy(2, 2));
    expect(targets).toContainEqual(xy(0, 1)); // 其他方向不受影响
  });

  it('马:斜向一格,不受蹩脚限制', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 1, 1, open(P('马', 'red')));
    const targets = targetsFor(s, xy(1, 1));
    expect(targets).toContainEqual(xy(0, 0));
    expect(targets).toContainEqual(xy(0, 2));
    expect(targets).toContainEqual(xy(2, 0));
    expect(targets).toContainEqual(xy(2, 2));
  });

  it('士/象/帅/兵:横竖一格', () => {
    for (const type of ['士', '象', '帅', '兵'] as const) {
      const s = mk(emptyBoard(), {}, {}, 0);
      put(s, 1, 1, open(P(type, 'red')));
      const targets = targetsFor(s, xy(1, 1));
      expect(targets).toContainEqual(xy(1, 0));
      expect(targets).toContainEqual(xy(0, 1));
      expect(targets).toContainEqual(xy(2, 1));
      expect(targets).not.toContainEqual(xy(0, 0));
    }
  });

  it('可吃己方棋子(规则四.1),进入库存', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 1, 1, open(P('车', 'red')));
    put(s, 2, 1, open(P('兵', 'red')));
    const s2 = applyMove(s, { kind: 'move', from: xy(1, 1), to: xy(2, 1) });
    expect(s2.players[0].inventory).toEqual([P('兵', 'red')]);
    expect(topOf(cellAt(s2.board, xy(2, 1)))).toEqual(P('车', 'red'));
  });

  it('移动以整叠为单位,且严格换手', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('兵', 'red'), P('车', 'red'), P('兵', 'red')));
    const s2 = applyMove(s, { kind: 'move', from: xy(0, 0), to: xy(0, 1) });
    expect(s2.current).toBe(1); // 红走一步,轮到黑
    expect(cellAt(s2.board, xy(0, 0))).toEqual(empty());
    expect(cellAt(s2.board, xy(0, 1))).toEqual(
      open(P('兵', 'red'), P('车', 'red'), P('兵', 'red')),
    );
  });

  it('不能移动到暗格(可选规则B未开放)', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('车', 'red')));
    put(s, 1, 0, down(P('兵', 'black')));
    expect(
      isLegalMove(s, { kind: 'move', from: xy(0, 0), to: xy(1, 0) }),
    ).toBe(false);
  });
});

// ---------- 炮 ----------

describe('炮', () => {
  it('平移:途经全空,目标必须为空,遇棋阻挡', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('炮', 'red')));
    put(s, 2, 0, open(P('兵', 'black')));
    const targets = targetsFor(s, xy(0, 0));
    expect(targets).toContainEqual(xy(1, 0)); // 最近空格
    expect(targets).not.toContainEqual(xy(2, 0)); // 目标有棋,不可平移
    expect(targets).not.toContainEqual(xy(3, 0));
    expect(targets).toContainEqual(xy(0, 1)); // 其他方向
  });

  it('打吃:恰隔一个炮架(叠层整体算一个),吃层数满足的目标', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('炮', 'red')));
    put(s, 0, 2, open(P('车', 'black'), P('车', 'black'))); // 2层炮架(整叠算一个)
    put(s, 0, 4, open(P('兵', 'black'))); // 1层目标,可吃
    expect(targetsFor(s, xy(0, 0))).toContainEqual(xy(0, 4));
  });

  it('打吃:炮架本身不是目标,不可隔两个炮架', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('炮', 'red')));
    put(s, 0, 2, open(P('兵', 'black'))); // 炮架
    put(s, 0, 4, open(P('兵', 'black'))); // 炮架后紧邻,是合法目标
    put(s, 0, 6, open(P('兵', 'black'))); // 与炮之间有两个棋,不可吃
    const targets = targetsFor(s, xy(0, 0));
    expect(targets).not.toContainEqual(xy(0, 2)); // 炮架不是目标
    expect(targets).toContainEqual(xy(0, 4)); // 隔一个炮架
    expect(targets).not.toContainEqual(xy(0, 6)); // 隔两个炮架
  });

  it('打吃:层数不足不能吃', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('炮', 'red')));
    put(s, 1, 0, open(P('兵', 'black'))); // 炮架
    put(s, 2, 0, open(P('车', 'black'), P('车', 'black'))); // 2层目标
    expect(targetsFor(s, xy(0, 0))).not.toContainEqual(xy(2, 0));
  });

  it('暗格可作炮架:隔未翻开的棋打翻开的棋(传统象棋隔山打牛)', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('炮', 'red')));
    put(s, 0, 2, down(P('兵', 'black'))); // 暗格作炮架
    put(s, 0, 4, open(P('兵', 'black'))); // 目标
    expect(targetsFor(s, xy(0, 0))).toContainEqual(xy(0, 4));
    expect(
      isLegalMove(s, { kind: 'move', from: xy(0, 0), to: xy(0, 4) }),
    ).toBe(true);
  });

  it('暗格不可作目标:炮架后遇暗格即不可打', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('炮', 'red')));
    put(s, 0, 1, open(P('兵', 'black'))); // 炮架(翻开)
    put(s, 0, 2, down(P('兵', 'black'))); // 暗格(第二个棋,不可作目标)
    put(s, 0, 3, open(P('兵', 'black')));
    expect(targetsFor(s, xy(0, 0))).not.toContainEqual(xy(0, 2));
    expect(targetsFor(s, xy(0, 0))).not.toContainEqual(xy(0, 3));
  });
});

// ---------- 层数吃子 ----------

describe('层数吃子', () => {
  it('单枚(1层)不能吃 2 层叠层', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 1, 1, open(P('车', 'red')));
    put(s, 2, 1, open(P('兵', 'black'), P('兵', 'black')));
    expect(
      isLegalMove(s, { kind: 'move', from: xy(1, 1), to: xy(2, 1) }),
    ).toBe(false);
  });

  it('层数较多可吃层数较少;同层互吃', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 1, 1, open(P('兵', 'red'), P('兵', 'red'), P('兵', 'red'))); // 3层
    put(s, 2, 1, open(P('车', 'black'))); // 1层
    expect(
      isLegalMove(s, { kind: 'move', from: xy(1, 1), to: xy(2, 1) }),
    ).toBe(true);
    // 同层互吃
    const s2 = mk(emptyBoard(), {}, {}, 0);
    put(s2, 1, 1, open(P('兵', 'red'), P('兵', 'red')));
    put(s2, 2, 1, open(P('兵', 'black'), P('兵', 'black')));
    expect(
      isLegalMove(s2, { kind: 'move', from: xy(1, 1), to: xy(2, 1) }),
    ).toBe(true);
  });

  it('吃子时整叠(含多色)全部进入吃子者库存', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 1, 1, open(P('兵', 'red'), P('兵', 'red'), P('车', 'red'))); // 3层
    put(s, 2, 1, open(P('兵', 'black'), P('炮', 'black'))); // 2层,可吃
    const s2 = applyMove(s, { kind: 'move', from: xy(1, 1), to: xy(2, 1) });
    expect(s2.players[0].inventory).toEqual([
      P('兵', 'black'),
      P('炮', 'black'),
    ]);
    expect(cellAt(s2.board, xy(2, 1))).toEqual(
      open(P('兵', 'red'), P('兵', 'red'), P('车', 'red')),
    );
  });

  it('叠层(同类)走法以顶层棋种类为准,吃子层数按整叠', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 1, 1, open(P('兵', 'red'), P('兵', 'red'), P('兵', 'red')));
    // 顶层仍为兵:走法横竖一格
    const targets = targetsFor(s, xy(1, 1));
    expect(targets).toContainEqual(xy(1, 0));
    expect(targets).not.toContainEqual(xy(1, 3));
    // 3层兵叠可吃 2 层敌叠
    put(s, 2, 1, open(P('车', 'black'), P('车', 'black')));
    expect(
      isLegalMove(s, { kind: 'move', from: xy(1, 1), to: xy(2, 1) }),
    ).toBe(true);
  });
});

// ---------- 放置 / 叠层 / 取层 ----------

describe('放置', () => {
  it('库存己方色棋可放置到任意空格', () => {
    const s = mk(emptyBoard(), { inventory: [P('兵', 'red')] }, {}, 0);
    const s2 = applyMove(s, { kind: 'place', piece: P('兵', 'red'), to: xy(3, 7) });
    expect(cellAt(s2.board, xy(3, 7))).toEqual(open(P('兵', 'red')));
    expect(s2.players[0].inventory).toEqual([]);
  });

  it('库存敌方色棋默认不可放置(可选规则A未开放)', () => {
    const s = mk(emptyBoard(), { inventory: [P('兵', 'black')] }, {}, 0);
    expect(
      isLegalMove(s, { kind: 'place', piece: P('兵', 'black'), to: xy(0, 0) }),
    ).toBe(false);
    // 开放可选规则A后可用,且保留实际颜色
    const s2 = { ...s, options: { useEnemyForPlace: true, eatFacedown: false } };
    expect(
      isLegalMove(s2, { kind: 'place', piece: P('兵', 'black'), to: xy(0, 0) }),
    ).toBe(true);
    const s3 = applyMove(s2, { kind: 'place', piece: P('兵', 'black'), to: xy(0, 0) });
    expect(cellAt(s3.board, xy(0, 0))).toEqual(open(P('兵', 'black')));
  });
});

describe('叠层', () => {
  it('库存同类棋叠到棋盘同类叠层顶,一次可叠多枚', () => {
    const s = mk(emptyBoard(), { inventory: [P('兵', 'red'), P('兵', 'red')] }, {}, 0);
    put(s, 0, 0, open(P('兵', 'red')));
    const s2 = applyMove(s, {
      kind: 'stack',
      piece: P('兵', 'red'),
      to: xy(0, 0),
      count: 2,
    });
    expect(cellAt(s2.board, xy(0, 0))).toEqual(
      open(P('兵', 'red'), P('兵', 'red'), P('兵', 'red')),
    );
    expect(s2.players[0].inventory).toEqual([]);
  });

  it('count 不能超过库存数量', () => {
    const s = mk(emptyBoard(), { inventory: [P('兵', 'red')] }, {}, 0);
    put(s, 0, 0, open(P('兵', 'red')));
    expect(
      isLegalMove(s, {
        kind: 'stack',
        piece: P('兵', 'red'),
        to: xy(0, 0),
        count: 2,
      }),
    ).toBe(false);
  });

  it('不同类型不可叠', () => {
    const s = mk(emptyBoard(), { inventory: [P('车', 'red')] }, {}, 0);
    put(s, 0, 0, open(P('兵', 'red')));
    expect(
      isLegalMove(s, {
        kind: 'stack',
        piece: P('车', 'red'),
        to: xy(0, 0),
        count: 1,
      }),
    ).toBe(false);
  });

  it('不可压顶敌方同类叠层(ADR-0004):叠层仅限己方叠层', () => {
    const s = mk(emptyBoard(), { inventory: [P('兵', 'red')] }, {}, 0);
    put(s, 0, 0, open(P('兵', 'black'), P('兵', 'black')));
    expect(
      isLegalMove(s, {
        kind: 'stack',
        piece: P('兵', 'red'),
        to: xy(0, 0),
        count: 1,
      }),
    ).toBe(false);
    // 己方同类叠层可叠
    const s2 = mk(emptyBoard(), { inventory: [P('兵', 'red')] }, {}, 0);
    put(s2, 0, 0, open(P('兵', 'red')));
    expect(
      isLegalMove(s2, {
        kind: 'stack',
        piece: P('兵', 'red'),
        to: xy(0, 0),
        count: 1,
      }),
    ).toBe(true);
  });
});

describe('取层', () => {
  it('取走 1..n-1 枚进库存,该格保底一枚', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('兵', 'red'), P('兵', 'red'), P('车', 'red')));
    const s2 = applyMove(s, { kind: 'peel', from: xy(0, 0), count: 2 });
    expect(s2.players[0].inventory).toEqual([P('兵', 'red'), P('车', 'red')]);
    expect(cellAt(s2.board, xy(0, 0))).toEqual(open(P('兵', 'red')));
    // 全取走非法(保底一枚)
    expect(isLegalMove(s, { kind: 'peel', from: xy(0, 0), count: 3 })).toBe(
      false,
    );
  });

  it('仅限己方叠层(ADR-0001):敌方顶层叠层不可取,己方顶层叠层可取', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('车', 'black'), P('车', 'black')));
    expect(isLegalMove(s, { kind: 'peel', from: xy(0, 0), count: 1 })).toBe(
      false,
    );
    const s3 = mk(emptyBoard(), {}, {}, 0);
    put(s3, 0, 0, open(P('兵', 'red'), P('兵', 'red')));
    expect(isLegalMove(s3, { kind: 'peel', from: xy(0, 0), count: 1 })).toBe(
      true,
    );
  });
});

// ---------- 走法范围(子力不足提示用) ----------

describe('targetsInRange', () => {
  it('包含层数不足的目标格(车)', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('车', 'red')));
    put(s, 2, 0, open(P('兵', 'black'), P('兵', 'black'))); // 2层,吃不动
    const range = targetsInRange(s, xy(0, 0));
    expect(range).toContainEqual(xy(2, 0)); // 层数不足也在范围内
    expect(targetsFor(s, xy(0, 0))).not.toContainEqual(xy(2, 0));
  });

  it('炮打吃范围:炮架后第一个棋(忽略层数)', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('炮', 'red')));
    put(s, 0, 2, open(P('兵', 'black'))); // 炮架
    put(s, 0, 4, open(P('车', 'black'), P('车', 'black'))); // 2层,吃不动
    const range = targetsInRange(s, xy(0, 0));
    expect(range).toContainEqual(xy(0, 4));
    expect(targetsFor(s, xy(0, 0))).not.toContainEqual(xy(0, 4));
  });

  it('暗格不在范围内', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('兵', 'red')));
    put(s, 1, 0, down(P('兵', 'black')));
    expect(targetsInRange(s, xy(0, 0))).not.toContainEqual(xy(1, 0));
  });
});

// ---------- 胜负与终局 ----------

describe('胜负判定', () => {
  it('条件A:吃光对方最后一枚棋即胜', () => {
    const s = mk(emptyBoard(), {}, { color: 'black' }, 0);
    put(s, 0, 0, open(P('车', 'red')));
    put(s, 1, 0, open(P('车', 'black'))); // 黑棋盘上最后一枚(库存已空)
    const s2 = applyMove(s, { kind: 'move', from: xy(0, 0), to: xy(1, 0) });
    expect(s2.winner).toBe(0);
  });

  it('条件A:对方库存仍有棋时不算全灭', () => {
    const s = mk(
      emptyBoard(),
      {},
      { color: 'black', inventory: [P('兵', 'black')] },
      0,
    );
    put(s, 0, 0, open(P('车', 'red')));
    put(s, 1, 0, open(P('车', 'black')));
    const s2 = applyMove(s, { kind: 'move', from: xy(0, 0), to: xy(1, 0) });
    expect(s2.winner).toBeNull(); // 黑库存仍有 1 兵,不满足条件A
  });

  it('条件B:对方无任何合法操作即胜(马被围死)', () => {
    const s = mk(emptyBoard(), { color: 'red' }, { color: 'black' }, 0);
    put(s, 1, 1, open(P('马', 'black')));
    // 黑马四对角全是 2 层红叠,1 层马吃不动;全盘无暗格、黑无库存
    for (const [dx, dy] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ] as const) {
      put(s, 1 + dx, 1 + dy, open(P('兵', 'red'), P('兵', 'red')));
    }
    expect(legalMoves(s, 1)).toEqual([]); // 黑方确实无操作
    // 红方走一步(与围堵无关的独立兵),轮到黑方仍无操作 → 红胜
    put(s, 3, 7, open(P('兵', 'red')));
    const s2 = applyMove(s, { kind: 'move', from: xy(3, 7), to: xy(3, 6) });
    expect(legalMoves(s2, 1)).toEqual([]);
    expect(s2.winner).toBe(0);
  });

  it('投降:对方获胜;和局:draw 标记', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    expect(surrender(s, 0).winner).toBe(1);
    expect(markDraw(s).draw).toBe(true);
  });

  it('终局后双方均无合法操作', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('兵', 'red')));
    put(s, 1, 0, open(P('兵', 'black')));
    const s2 = applyMove(s, { kind: 'move', from: xy(0, 0), to: xy(1, 0) });
    expect(s2.winner).toBe(0);
    expect(legalMoves(s2, 0)).toEqual([]);
    expect(legalMoves(s2, 1)).toEqual([]);
  });
});

// ---------- 悔棋 ----------

describe('悔棋', () => {
  it('悔一步完整恢复上一步前的状态', () => {
    const s = mk(emptyBoard(), { inventory: [P('兵', 'red')] }, {}, 0);
    put(s, 0, 0, open(P('兵', 'red')));
    const s2 = applyMove(s, { kind: 'place', piece: P('兵', 'red'), to: xy(3, 7) });
    const back = undo(s2);
    expect(back).not.toBeNull();
    expect(back!.board).toEqual(s.board);
    expect(back!.players).toEqual(s.players);
    expect(back!.current).toBe(0);
    expect(back!.history).toEqual([]);
  });

  it('无可悔时返回 null', () => {
    const s = createInitialState();
    expect(undo(s)).toBeNull();
  });

  it('悔棋后重新行动,新分支压入历史', () => {
    const s = mk(emptyBoard(), { inventory: [P('兵', 'red')] }, {}, 0);
    put(s, 0, 0, open(P('兵', 'red')));
    const s2 = applyMove(s, { kind: 'place', piece: P('兵', 'red'), to: xy(3, 7) });
    const back = undo(s2)!;
    const s3 = applyMove(back, { kind: 'place', piece: P('兵', 'red'), to: xy(0, 7) });
    expect(s3.history).toHaveLength(1);
    expect(back.board[7]![0]).toEqual(empty());
  });

  it('非法操作抛错', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('兵', 'black'))); // 敌方棋,红方不可移动
    expect(() =>
      applyMove(s, { kind: 'move', from: xy(0, 0), to: xy(0, 1) }),
    ).toThrow();
  });
});

// ---------- 炮打吃完整矩阵 ----------

describe('炮打吃矩阵', () => {
  it('打敌方单枚:炮架为敌方棋', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('炮', 'red')));
    put(s, 0, 2, open(P('兵', 'black'))); // 炮架(敌方)
    put(s, 0, 4, open(P('兵', 'black'))); // 目标
    expect(
      isLegalMove(s, { kind: 'move', from: xy(0, 0), to: xy(0, 4) }),
    ).toBe(true);
  });

  it('打敌方单枚:炮架为己方棋(规则:炮架可为敌方或己方)', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('炮', 'red')));
    put(s, 0, 2, open(P('车', 'red'))); // 炮架(己方)
    put(s, 0, 4, open(P('兵', 'black'))); // 目标
    expect(
      isLegalMove(s, { kind: 'move', from: xy(0, 0), to: xy(0, 4) }),
    ).toBe(true);
  });

  it('打己方单枚(规则四.1 允许吃己方)', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('炮', 'red')));
    put(s, 0, 2, open(P('兵', 'black'))); // 炮架
    put(s, 0, 4, open(P('兵', 'red'))); // 己方目标
    expect(
      isLegalMove(s, { kind: 'move', from: xy(0, 0), to: xy(0, 4) }),
    ).toBe(true);
  });

  it('炮架为叠层:整叠算一个炮架', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('炮', 'red')));
    put(s, 0, 2, open(P('车', 'black'), P('车', 'black'), P('兵', 'black'))); // 3层炮架
    put(s, 0, 4, open(P('兵', 'black')));
    expect(
      isLegalMove(s, { kind: 'move', from: xy(0, 0), to: xy(0, 4) }),
    ).toBe(true);
  });

  it('炮架与目标之间可隔空格', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('炮', 'red')));
    put(s, 0, 2, open(P('兵', 'black'))); // 炮架
    put(s, 0, 5, open(P('兵', 'black'))); // 目标,与炮架隔 2 空格
    expect(
      isLegalMove(s, { kind: 'move', from: xy(0, 0), to: xy(0, 5) }),
    ).toBe(true);
  });

  it('目标层数大于炮层数:不能吃(层数规则)', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('炮', 'red')));
    put(s, 0, 2, open(P('兵', 'black')));
    put(s, 0, 4, open(P('车', 'black'), P('车', 'black'))); // 2层目标
    expect(
      isLegalMove(s, { kind: 'move', from: xy(0, 0), to: xy(0, 4) }),
    ).toBe(false);
  });

  it('炮为叠层(2层)时按总层数比较,可吃 2 层目标', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('兵', 'red'), P('炮', 'red'))); // 顶层炮,2层
    put(s, 0, 2, open(P('兵', 'black')));
    put(s, 0, 4, open(P('车', 'black'), P('车', 'black'))); // 2层目标
    expect(
      isLegalMove(s, { kind: 'move', from: xy(0, 0), to: xy(0, 4) }),
    ).toBe(true);
  });

  it('炮架与目标之间隔暗格:不可打(暗格阻挡裁决)', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('炮', 'red')));
    put(s, 0, 2, open(P('兵', 'black'))); // 炮架
    put(s, 0, 3, down(P('兵', 'black'))); // 暗格在炮架与目标之间
    put(s, 0, 4, open(P('兵', 'black'))); // 目标
    expect(
      isLegalMove(s, { kind: 'move', from: xy(0, 0), to: xy(0, 4) }),
    ).toBe(false);
  });

  it('目标与炮之间隔两个已翻开棋:不可打', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('炮', 'red')));
    put(s, 0, 2, open(P('兵', 'black')));
    put(s, 0, 4, open(P('兵', 'black')));
    put(s, 0, 6, open(P('兵', 'black'))); // 与炮之间隔两个棋
    expect(
      isLegalMove(s, { kind: 'move', from: xy(0, 0), to: xy(0, 6) }),
    ).toBe(false);
  });

  it('炮平移与打吃共存:空格可平移,目标可打吃', () => {
    const s = mk(emptyBoard(), {}, {}, 0);
    put(s, 0, 0, open(P('炮', 'red')));
    put(s, 0, 2, open(P('兵', 'black'))); // 炮架
    put(s, 0, 4, open(P('兵', 'black'))); // 打吃目标
    put(s, 2, 0, open(P('兵', 'black'))); // 横向阻挡
    const targets = targetsFor(s, xy(0, 0));
    expect(targets).toContainEqual(xy(0, 1)); // 纵向平移
    expect(targets).toContainEqual(xy(0, 4)); // 纵向打吃
    expect(targets).toContainEqual(xy(1, 0)); // 横向平移到阻挡棋前
    expect(targets).not.toContainEqual(xy(2, 0)); // 炮架不可落子
    expect(targets).not.toContainEqual(xy(3, 0)); // 不可越过
  });
});
