/**
 * 规则引擎:五种操作的合法性检查与全量合法操作枚举。
 *
 * 已裁决的规则边界(见 CONTEXT.md / docs/adr/):
 * - 取层仅限最上层为己方色的叠层(ADR-0001)
 * - 移动以整叠为单位;吃子时整叠进吃子者库存
 * - 暗格不可落子、不可作炮架、路径上遇暗格即阻挡(可选规则B未开放时)
 * - 叠层可压顶敌方同类叠层(叠入棋为己方色,顶层即为己方色,符合规则五.1)
 */

import { isPawnLike } from './pieces';
import type {
  Cell,
  GameState,
  Move,
  Piece,
  PieceType,
  Pos,
} from './types';
import { BOARD_H, BOARD_W } from './types';

const STEP4: ReadonlyArray<Pos> = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const STEP_DIAG: ReadonlyArray<Pos> = [
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

export function inBoard(pos: Pos): boolean {
  return pos.x >= 0 && pos.x < BOARD_W && pos.y >= 0 && pos.y < BOARD_H;
}

export function cellAt(board: Cell[][], pos: Pos): Cell {
  return board[pos.y]?.[pos.x] ?? { kind: 'open', pieces: [] };
}

export function topOf(cell: Cell): Piece | null {
  if (cell.kind !== 'open' || cell.pieces.length === 0) return null;
  return cell.pieces[cell.pieces.length - 1] ?? null;
}

/** 该格是否为某玩家的“己方叠层”:已翻开、非空、顶层为该玩家颜色 */
export function isOwnPile(state: GameState, pos: Pos, player: number): boolean {
  const top = topOf(cellAt(state.board, pos));
  return top !== null && top.color === state.players[player]!.color;
}

/** 攻击方叠层能否吃目标格:层数多者可吃少者或同层互吃,即攻击层数 >= 目标层数 */
function canCapture(state: GameState, from: Pos, to: Pos): boolean {
  const atk = cellAt(state.board, from);
  const tgt = cellAt(state.board, to);
  if (atk.kind !== 'open' || tgt.kind !== 'open') return false;
  return atk.pieces.length >= tgt.pieces.length;
}

/** 普通走子(车马士象帅兵)的目标判定:空格可走,已翻开叠层可吃(层数满足),暗格不可 */
function canOccupy(state: GameState, from: Pos, to: Pos): boolean {
  const tgt = cellAt(state.board, to);
  if (tgt.kind === 'facedown') return false; // 暗格(可选规则B未开放)
  if (tgt.pieces.length === 0) return true;
  return canCapture(state, from, to);
}

/** 车:横竖直线,途经须为空格,目标可吃 */
function rookTargets(state: GameState, from: Pos): Pos[] {
  return extend(state, from, STEP4, (pos) => canOccupy(state, from, pos));
}

/** 马:斜向一格(非“日”字),不受蹩脚限制 */
function horseTargets(state: GameState, from: Pos): Pos[] {
  return STEP_DIAG.filter((d) => {
    const to = { x: from.x + d.x, y: from.y + d.y };
    return inBoard(to) && canOccupy(state, from, to);
  }).map((d) => ({ x: from.x + d.x, y: from.y + d.y }));
}

/** 士/象/帅/兵:横竖一格 */
function pawnTargets(state: GameState, from: Pos): Pos[] {
  return STEP4.filter((d) => {
    const to = { x: from.x + d.x, y: from.y + d.y };
    return inBoard(to) && canOccupy(state, from, to);
  }).map((d) => ({ x: from.x + d.x, y: from.y + d.y }));
}

/** 沿方向延伸,对每个格子执行 accept;遇阻挡提前停止 */
function extend(
  state: GameState,
  from: Pos,
  dirs: ReadonlyArray<Pos>,
  accept: (pos: Pos) => boolean,
): Pos[] {
  const out: Pos[] = [];
  for (const d of dirs) {
    let pos = { x: from.x + d.x, y: from.y + d.y };
    while (inBoard(pos)) {
      const cell = cellAt(state.board, pos);
      if (cell.kind === 'facedown') break; // 暗格阻挡
      if (accept(pos)) out.push(pos);
      if (cell.pieces.length > 0) break; // 已翻开棋子阻挡继续延伸
      pos = { x: pos.x + d.x, y: pos.y + d.y };
    }
  }
  return out;
}

/** 炮(平移):横竖直线,途经全空,目标必须为空;遇任何棋子(或暗格)即阻挡 */
function cannonSlideTargets(state: GameState, from: Pos): Pos[] {
  return extend(
    state,
    from,
    STEP4,
    (pos) => {
      const cell = cellAt(state.board, pos);
      return cell.kind === 'open' && cell.pieces.length === 0;
    },
  );
}

/** 炮(打吃):与传统象棋一致的"隔山打牛"。
 * 炮与目标之间恰好一个棋子作炮架——未翻开的暗格也是棋子,可作炮架;
 * 目标必须已翻开(暗格不可被吃);整叠算一个炮架,层数须满足。 */
function cannonCaptureTargets(state: GameState, from: Pos): Pos[] {
  const out: Pos[] = [];
  for (const d of STEP4) {
    let pos = { x: from.x + d.x, y: from.y + d.y };
    let screen = false;
    while (inBoard(pos)) {
      const cell = cellAt(state.board, pos);
      if (!screen) {
        // 炮架:第一个有棋的格位(翻开或暗格都算)
        if (cell.kind === 'facedown' || cell.pieces.length > 0) screen = true;
      } else if (cell.kind === 'facedown') {
        break; // 炮架后遇暗格:第二个棋,且暗格不可作目标
      } else if (cell.pieces.length > 0) {
        if (canCapture(state, from, pos)) {
          out.push(pos); // 炮架后紧邻(中间无其他棋)的第一个棋子为目标
        }
        break;
      }
      pos = { x: pos.x + d.x, y: pos.y + d.y };
    }
  }
  return out;
}

/** 某叠层(按顶层棋种类)的全部合法移动目标 */
export function targetsFor(state: GameState, from: Pos): Pos[] {
  const top = topOf(cellAt(state.board, from));
  if (!top) return [];
  if (top.type === '车') return rookTargets(state, from);
  if (top.type === '马') return horseTargets(state, from);
  if (top.type === '炮') {
    return [...cannonSlideTargets(state, from), ...cannonCaptureTargets(state, from)];
  }
  if (isPawnLike(top.type)) return pawnTargets(state, from);
  return [];
}

/** 走法范围内所有格(忽略层数限制,用于"子力不足"等提示)。空格与有棋格都含,暗格不含。 */
export function targetsInRange(state: GameState, from: Pos): Pos[] {
  const top = topOf(cellAt(state.board, from));
  if (!top) return [];
  if (top.type === '车') {
    return extend(state, from, STEP4, () => true);
  }
  if (top.type === '马') {
    return STEP_DIAG.filter((d) => {
      const to = { x: from.x + d.x, y: from.y + d.y };
      return inBoard(to) && cellAt(state.board, to).kind === 'open';
    }).map((d) => ({ x: from.x + d.x, y: from.y + d.y }));
  }
  if (top.type === '炮') {
    return [...cannonSlideTargets(state, from), ...cannonCaptureRange(state, from)];
  }
  return STEP4.filter((d) => {
    const to = { x: from.x + d.x, y: from.y + d.y };
    return inBoard(to) && cellAt(state.board, to).kind === 'open';
  }).map((d) => ({ x: from.x + d.x, y: from.y + d.y }));
}

/** 炮打吃的走法范围:炮架后第一个棋子(忽略层数,供子力不足提示) */
function cannonCaptureRange(state: GameState, from: Pos): Pos[] {
  const out: Pos[] = [];
  for (const d of STEP4) {
    let pos = { x: from.x + d.x, y: from.y + d.y };
    let screen = false;
    while (inBoard(pos)) {
      const cell = cellAt(state.board, pos);
      if (!screen) {
        if (cell.kind === 'facedown' || cell.pieces.length > 0) screen = true;
      } else if (cell.kind === 'facedown') {
        break;
      } else if (cell.pieces.length > 0) {
        out.push(pos); // 不管层数,均在打吃范围内
        break;
      }
      pos = { x: pos.x + d.x, y: pos.y + d.y };
    }
  }
  return out;
}

/** 库存中当前玩家可用于放置/叠层的棋子(去重)。
 * 默认规则:仅己方色;可选规则A:含对方色(棋子保留其实际颜色) */
function usablePieces(state: GameState, player: number): Piece[] {
  const color = state.players[player]!.color;
  if (color === null) return [];
  const seen = new Set<string>();
  const out: Piece[] = [];
  for (const p of state.players[player]!.inventory) {
    if (p.color === color || state.options.useEnemyForPlace) {
      const key = `${p.type}:${p.color}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(p);
      }
    }
  }
  return out;
}

function inventoryCount(
  state: GameState,
  player: number,
  piece: Piece,
): number {
  return state.players[player]!.inventory.filter(
    (p) => p.type === piece.type && p.color === piece.color,
  ).length;
}

/** 空格列表 */
function emptyCells(state: GameState): Pos[] {
  const out: Pos[] = [];
  for (let y = 0; y < BOARD_H; y++) {
    for (let x = 0; x < BOARD_W; x++) {
      if (cellAt(state.board, { x, y }).kind === 'open') {
        const c = state.board[y]?.[x];
        if (c?.kind === 'open' && c.pieces.length === 0) out.push({ x, y });
      }
    }
  }
  return out;
}

/** 全量合法操作枚举(胜利条件B依赖:为空即无合法操作)。叠层/取层含全部 count 变体 */
export function legalMoves(state: GameState, player: number): Move[] {
  if (state.winner !== null || state.draw) return [];
  const moves: Move[] = [];

  // 翻棋:任意暗格
  for (let y = 0; y < BOARD_H; y++) {
    for (let x = 0; x < BOARD_W; x++) {
      if (cellAt(state.board, { x, y }).kind === 'facedown') {
        moves.push({ kind: 'flip', pos: { x, y } });
      }
    }
  }

  const color = state.players[player]!.color;
  if (color === null) return moves; // 阵营未定:只能翻棋

  // 移动:己方叠层按顶层棋走法
  for (let y = 0; y < BOARD_H; y++) {
    for (let x = 0; x < BOARD_W; x++) {
      const from = { x, y };
      if (!isOwnPile(state, from, player)) continue;
      for (const to of targetsFor(state, from)) {
        moves.push({ kind: 'move', from, to });
      }
    }
  }

  // 放置:库存棋 → 任意空格
  for (const p of usablePieces(state, player)) {
    for (const to of emptyCells(state)) {
      moves.push({ kind: 'place', piece: p, to });
    }
  }

  // 叠层:库存棋 → 同类己方叠层顶(ADR-0004:仅限己方叠层),一次可叠多枚
  for (const p of usablePieces(state, player)) {
    for (let y = 0; y < BOARD_H; y++) {
      for (let x = 0; x < BOARD_W; x++) {
        const to = { x, y };
        if (!isOwnPile(state, to, player)) continue; // 目标顶层须为己方色
        const cell = cellAt(state.board, to);
        if (cell.kind !== 'open' || cell.pieces.length === 0) continue;
        if (topOf(cell)!.type !== p.type) continue;
        const n = inventoryCount(state, player, p);
        for (let count = 1; count <= n; count++) {
          moves.push({ kind: 'stack', piece: p, to, count });
        }
      }
    }
  }

  // 取层:己方叠层层数 >= 2,取 1..n-1 枚(ADR-0001:仅己方叠层)
  for (let y = 0; y < BOARD_H; y++) {
    for (let x = 0; x < BOARD_W; x++) {
      const from = { x, y };
      const cell = cellAt(state.board, from);
      if (cell.kind !== 'open' || cell.pieces.length < 2) continue;
      if (!isOwnPile(state, from, player)) continue;
      for (let count = 1; count < cell.pieces.length; count++) {
        moves.push({ kind: 'peel', from, count });
      }
    }
  }

  return moves;
}

/** 精确校验单步操作是否合法(UI 构造带 count 的操作时使用) */
export function isLegalMove(state: GameState, move: Move): boolean {
  const player = state.current;
  return legalMoves(state, player).some((m) => movesEqual(m, move));
}

function movesEqual(a: Move, b: Move): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'flip':
      return a.pos.x === (b as typeof a).pos.x && a.pos.y === (b as typeof a).pos.y;
    case 'move':
      return (
        a.from.x === (b as typeof a).from.x &&
        a.from.y === (b as typeof a).from.y &&
        a.to.x === (b as typeof a).to.x &&
        a.to.y === (b as typeof a).to.y
      );
    case 'place':
      return (
        a.piece.type === (b as typeof a).piece.type &&
        a.piece.color === (b as typeof a).piece.color &&
        a.to.x === (b as typeof a).to.x &&
        a.to.y === (b as typeof a).to.y
      );
    case 'stack':
      return (
        a.piece.type === (b as typeof a).piece.type &&
        a.piece.color === (b as typeof a).piece.color &&
        a.to.x === (b as typeof a).to.x &&
        a.to.y === (b as typeof a).to.y &&
        a.count === (b as typeof a).count
      );
    case 'peel':
      return (
        a.from.x === (b as typeof a).from.x &&
        a.from.y === (b as typeof a).from.y &&
        a.count === (b as typeof a).count
      );
  }
}
