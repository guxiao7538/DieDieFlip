/**
 * 状态管理:开局洗牌、执行操作、胜负判定、悔棋、投降、和局。
 * 状态不可变:applyMove 返回新状态,旧状态压入 history 供悔棋回退。
 */

import { fullSet } from './pieces';
import { cellAt, isLegalMove, legalMoves } from './moves';
import type {
  Cell,
  Color,
  GameOptions,
  GameState,
  Move,
  Piece,
  PlayerState,
} from './types';
import { BOARD_H, BOARD_W } from './types';

export const DEFAULT_OPTIONS: GameOptions = {
  useEnemyForPlace: false,
  eatFacedown: false,
  allowLowCapture: false,
};

/** Fisher-Yates 洗牌 */
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function emptyPlayer(): PlayerState {
  return { color: null, inventory: [] };
}

export function createInitialState(
  options: GameOptions = DEFAULT_OPTIONS,
): GameState {
  const pieces = shuffle(fullSet());
  const board: Cell[][] = [];
  let k = 0;
  for (let y = 0; y < BOARD_H; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < BOARD_W; x++) {
      row.push({ kind: 'facedown', piece: pieces[k]! });
      k++;
    }
    board.push(row);
  }
  return {
    board,
    players: [emptyPlayer(), emptyPlayer()],
    current: 0,
    winner: null,
    draw: false,
    history: [],
    moveLog: [],
    options,
  };
}

/** 深拷贝玩家(库存数组独立) */
function clonePlayer(p: PlayerState): PlayerState {
  return { color: p.color, inventory: [...p.inventory] };
}

/** 某玩家全部棋子数:棋盘叠层中该色 + 暗格中该色 + 库存(胜利条件A与库存面板显示用)。
 * 暗格棋也计入——未翻开的棋只是"没亮出来",并未被吃掉(规则八.条件A)。 */
export function countPieces(state: GameState, player: number): number {
  const color = state.players[player]!.color;
  if (color === null) return 0;
  let n = state.players[player]!.inventory.length;
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.kind === 'open') {
        n += cell.pieces.filter((p) => p.color === color).length;
      } else if (cell.piece.color === color) {
        n += 1;
      }
    }
  }
  return n;
}

/** 库存中移除一枚匹配棋子(不变式:调用前已校验存在) */
function removeFromInventory(player: PlayerState, piece: Piece): void {
  const idx = player.inventory.findIndex(
    (p) => p.type === piece.type && p.color === piece.color,
  );
  if (idx >= 0) player.inventory.splice(idx, 1);
}

/** 执行一步操作,返回新状态。非法操作抛错。 */
export function applyMove(state: GameState, move: Move): GameState {
  if (!isLegalMove(state, move)) {
    throw new Error('非法操作:' + JSON.stringify(move));
  }
  const player = state.current;
  const board: Cell[][] = state.board.map((row) =>
    row.map((cell) =>
      cell.kind === 'open' ? { kind: 'open', pieces: [...cell.pieces] } : cell,
    ),
  );
  const players: [PlayerState, PlayerState] = [
    clonePlayer(state.players[0]),
    clonePlayer(state.players[1]),
  ];
  const me = players[player]!;

  switch (move.kind) {
    case 'flip': {
      const cell = board[move.pos.y]![move.pos.x]!;
      if (cell.kind !== 'facedown') throw new Error('该格已翻开');
      board[move.pos.y]![move.pos.x] = { kind: 'open', pieces: [cell.piece] };
      // 翻棋揭幕:首位翻棋者以翻出棋色为己方阵营,对方自动归属另一色
      if (me.color === null) {
        me.color = cell.piece.color;
        players[player === 0 ? 1 : 0]!.color =
          cell.piece.color === 'red' ? 'black' : 'red';
      }
      break;
    }
    case 'move': {
      const fromCell = board[move.from.y]![move.from.x]!;
      const toCell = board[move.to.y]![move.to.x]!;
      if (fromCell.kind !== 'open' || fromCell.pieces.length === 0) {
        throw new Error('源格无棋子');
      }
      if (toCell.kind === 'facedown') throw new Error('目标为暗格');
      const captured = toCell.pieces;
      if (captured.length > 0) {
        // 整叠被吃,全部进吃子者库存(含己方棋,规则四.1)
        me.inventory.push(...captured);
      }
      board[move.to.y]![move.to.x] = {
        kind: 'open',
        pieces: [...fromCell.pieces],
      };
      board[move.from.y]![move.from.x] = { kind: 'open', pieces: [] };
      break;
    }
    case 'place': {
      removeFromInventory(me, move.piece);
      const toCell = board[move.to.y]![move.to.x]!;
      if (toCell.kind !== 'open' || toCell.pieces.length !== 0) {
        throw new Error('目标非空格');
      }
      board[move.to.y]![move.to.x] = { kind: 'open', pieces: [move.piece] };
      break;
    }
    case 'stack': {
      for (let i = 0; i < move.count; i++) removeFromInventory(me, move.piece);
      const toCell = board[move.to.y]![move.to.x]!;
      if (toCell.kind !== 'open' || toCell.pieces.length === 0) {
        throw new Error('目标无叠层');
      }
      toCell.pieces.push(
        ...Array.from({ length: move.count }, () => ({ ...move.piece })),
      );
      break;
    }
    case 'peel': {
      const fromCell = board[move.from.y]![move.from.x]!;
      if (fromCell.kind !== 'open') throw new Error('源格未翻开');
      const n = fromCell.pieces.length;
      if (n - move.count < 1) throw new Error('该格须保留至少一枚');
      me.inventory.push(...fromCell.pieces.splice(n - move.count, move.count));
      break;
    }
  }

  const next: GameState = {
    ...state,
    board,
    players,
    current: player === 0 ? 1 : 0,
    winner: null,
    draw: false,
    history: [...state.history, state],
    moveLog: [...state.moveLog, move],
  };
  next.winner = checkWinner(next);
  return next;
}

/** 某玩家是否曾亮相过棋子:棋盘已翻开格有其色棋,或对方库存有其色棋(被吃走)。
 * 条件A 的前提:从未亮相过谈不上"被吃光",否则开局翻第一枚即误判。 */
function hasEverRevealed(state: GameState, player: number): boolean {
  const color = state.players[player]!.color;
  if (color === null) return false;
  for (const row of state.board) {
    for (const cell of row) {
      if (cell.kind === 'open' && cell.pieces.some((p) => p.color === color)) {
        return true;
      }
    }
  }
  return state.players[player === 0 ? 1 : 0]!.inventory.some(
    (p) => p.color === color,
  );
}

/** 胜负判定:条件A(对方曾亮相且已无任何棋子)与条件B(对方无任何合法操作) */
function checkWinner(next: GameState): 0 | 1 | null {
  for (const p of [0, 1] as const) {
    if (countPieces(next, p) === 0 && hasEverRevealed(next, p)) {
      return p === 0 ? 1 : 0;
    }
  }
  if (legalMoves(next, next.current).length === 0) {
    return next.current === 0 ? 1 : 0;
  }
  return null;
}

/** 悔一步:撤销最近一步操作并恢复行动者。无可悔时返回 null */
export function undo(state: GameState): GameState | null {
  if (state.history.length === 0) return null;
  return state.history[state.history.length - 1] ?? null;
}

/** 投降:player 认负,对方获胜(胜利条件C) */
export function surrender(state: GameState, player: number): GameState {
  return {
    ...state,
    winner: player === 0 ? 1 : 0,
    draw: false,
    history: [...state.history, state],
  };
}

/** 和局(双方协商一致) */
export function markDraw(state: GameState): GameState {
  return {
    ...state,
    winner: null,
    draw: true,
    history: [...state.history, state],
  };
}

/** 当前行动者的阵营颜色(未定时为 null) */
export function currentColor(state: GameState): Color | null {
  return state.players[state.current]?.color ?? null;
}
