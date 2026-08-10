/** 棋子与对局核心类型。引擎零 DOM 依赖,可独立单测。 */

export type Color = 'red' | 'black';

/** 棋子类型,直接使用中文,与规则文档一致 */
export type PieceType = '帅' | '士' | '象' | '车' | '马' | '炮' | '兵';

export interface Piece {
  type: PieceType;
  color: Color;
}

/**
 * 棋盘格:
 * - facedown:暗格,内容对双方隐藏,只能被翻棋
 * - open:已翻开,pieces 为叠层(底部→顶部),空数组即空格
 */
export type Cell =
  | { kind: 'facedown'; piece: Piece }
  | { kind: 'open'; pieces: Piece[] };

export interface Pos {
  x: number;
  y: number;
}

/** 可选规则开关,第一版全部 false,仅预留接口 */
export interface GameOptions {
  /** 可选规则A:允许用库存中对方颜色的棋子叠层/放置(顶层仍须己方色) */
  useEnemyForPlace: boolean;
  /** 可选规则B:允许吃未翻开棋子 */
  eatFacedown: boolean;
}

export interface PlayerState {
  /** null=阵营未定(尚未翻出第一枚棋) */
  color: Color | null;
  inventory: Piece[];
}

export interface GameState {
  /** board[y][x] */
  board: Cell[][];
  players: [PlayerState, PlayerState];
  current: 0 | 1;
  winner: 0 | 1 | null;
  /** true=和局(双方协商) */
  draw: boolean;
  /** 状态历史栈,悔棋用。applyMove 时把旧状态压栈 */
  history: GameState[];
  options: GameOptions;
}

/** 五种操作。count 仅叠层/取层使用:一次可叠/取多枚,均算一步 */
export type Move =
  | { kind: 'flip'; pos: Pos }
  | { kind: 'move'; from: Pos; to: Pos }
  | { kind: 'place'; piece: Piece; to: Pos }
  | { kind: 'stack'; piece: Piece; to: Pos; count: number }
  | { kind: 'peel'; from: Pos; count: number };

export const BOARD_W = 4;
export const BOARD_H = 8;
