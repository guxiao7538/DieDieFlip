/**
 * 交互状态机:上下文智能分派,无模式按钮。
 * - 点暗格 → 翻棋
 * - 点己方叠层 → 选中(高亮移动目标;层数>=2 时显示取层角标)
 * - 点库存棋 → 选中(高亮空格=放置、同类叠层=叠层)
 * - 点高亮目标 → 执行对应操作;叠层/取层弹数量选择器
 */

import { cellAt, isOwnPile, legalMoves, targetsFor } from '../game/moves';
import { applyMove } from '../game/state';
import type { GameState, Move, Piece, Pos } from '../game/types';

export interface CountDlg {
  kind: 'stack' | 'peel';
  pos: Pos;
  /** stack 时被叠的棋子;peel 时为空 */
  piece: Piece | null;
  min: number;
  max: number;
  value: number;
}

export interface Pending {
  kind: 'drawProposal' | 'surrenderConfirm';
}

export interface UiState {
  selectedPos: Pos | null;
  selectedInv: Piece | null;
  countDlg: CountDlg | null;
  pending: Pending | null;
}

/** 高亮结果:渲染层着色依据 */
export interface Highlights {
  selected: Pos | null;
  invSelected: Piece | null;
  moveTargets: Pos[];
  eatTargets: Pos[];
  placeTargets: Pos[];
  stackTargets: Pos[];
  /** 选中格可执行取层(层数>=2),渲染角标按钮 */
  peelable: Pos | null;
}

export function createUiState(): UiState {
  return { selectedPos: null, selectedInv: null, countDlg: null, pending: null };
}

const samePos = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;

function pushIfNew(list: Pos[], p: Pos): void {
  if (!list.some((q) => samePos(q, p))) list.push(p);
}

/** 库存中某棋的可用数量 */
function invCount(state: GameState, piece: Piece): number {
  return state.players[state.current]!.inventory.filter(
    (p) => p.type === piece.type && p.color === piece.color,
  ).length;
}

/** 依据选中项计算全部合法目标高亮 */
export function computeHighlights(state: GameState, ui: UiState): Highlights {
  const h: Highlights = {
    selected: ui.selectedPos,
    invSelected: ui.selectedInv,
    moveTargets: [],
    eatTargets: [],
    placeTargets: [],
    stackTargets: [],
    peelable: null,
  };
  if (state.winner !== null || state.draw || ui.pending) return h;
  const me = state.current;

  if (ui.selectedInv) {
    for (const m of legalMoves(state, me)) {
      if (m.kind !== 'place' && m.kind !== 'stack') continue;
      if (m.piece.type !== ui.selectedInv.type || m.piece.color !== ui.selectedInv.color) {
        continue;
      }
      if (m.kind === 'place') pushIfNew(h.placeTargets, m.to);
      else pushIfNew(h.stackTargets, m.to);
    }
    return h;
  }

  if (ui.selectedPos && isOwnPile(state, ui.selectedPos, me)) {
    for (const t of targetsFor(state, ui.selectedPos)) {
      const cell = cellAt(state.board, t);
      if (cell.kind === 'open' && cell.pieces.length > 0) {
        h.eatTargets.push(t);
      } else {
        h.moveTargets.push(t);
      }
    }
    const cell = cellAt(state.board, ui.selectedPos);
    if (cell.kind === 'open' && cell.pieces.length >= 2) {
      h.peelable = ui.selectedPos;
    }
  }

  return h;
}

export interface ClickResult {
  state: GameState | null;
  ui: UiState;
}

/** 棋盘格点击:上下文分派 */
export function handleCellClick(state: GameState, ui: UiState, pos: Pos): ClickResult {
  if (state.winner !== null || state.draw || ui.pending) {
    return { state: null, ui };
  }
  // 数量操作条打开时点棋盘:清除条,按正常规则处理本次点击(移动/放置/叠层/取消)
  if (ui.countDlg) {
    return handleCellClick(state, { ...ui, countDlg: null }, pos);
  }

  const cell = cellAt(state.board, pos);
  const me = state.current;

  // 已选中库存棋:点目标执行放置/叠层
  if (ui.selectedInv) {
    if (cell.kind === 'open' && cell.pieces.length === 0) {
      const ok = legalMoves(state, me).some(
        (m) =>
          m.kind === 'place' &&
          m.piece.type === ui.selectedInv!.type &&
          m.piece.color === ui.selectedInv!.color &&
          samePos(m.to, pos),
      );
      if (ok) {
        return {
          state: apply(state, { kind: 'place', piece: ui.selectedInv, to: pos }),
          ui: resetSel(ui),
        };
      }
    }
    if (cell.kind === 'open' && cell.pieces.length > 0) {
      const ok = legalMoves(state, me).some(
        (m) =>
          m.kind === 'stack' &&
          m.piece.type === ui.selectedInv!.type &&
          m.piece.color === ui.selectedInv!.color &&
          samePos(m.to, pos),
      );
      if (ok) {
        const n = invCount(state, ui.selectedInv);
        return {
          state: null,
          ui: {
            ...ui,
            countDlg: {
              kind: 'stack',
              pos,
              piece: ui.selectedInv,
              min: 1,
              max: n,
              value: 1,
            },
          },
        };
      }
    }
    // 其余格:取消库存选中
    return { state: null, ui: { ...ui, selectedInv: null } };
  }

  // 暗格:直接翻棋
  if (cell.kind === 'facedown') {
    return { state: apply(state, { kind: 'flip', pos }), ui: resetSel(ui) };
  }

  // 已选中棋盘叠层:点目标执行移动(含吃己方棋的目标格),点非目标己方叠层切换选中
  if (ui.selectedPos) {
    if (samePos(ui.selectedPos, pos)) {
      return { state: null, ui: { ...ui, selectedPos: null } }; // 再点取消
    }
    const targets = targetsFor(state, ui.selectedPos);
    if (targets.some((t) => samePos(t, pos))) {
      return {
        state: apply(state, { kind: 'move', from: ui.selectedPos, to: pos }),
        ui: resetSel(ui),
      };
    }
    if (isOwnPile(state, pos, me)) {
      return { state: null, ui: { ...ui, selectedPos: pos } }; // 切换选中
    }
    return { state: null, ui: { ...ui, selectedPos: null } };
  }

  // 未选中:点己方叠层选中;层数>=2 时自动打开取层操作条(与移动高亮共存)
  if (isOwnPile(state, pos, me)) {
    const cell = cellAt(state.board, pos);
    const countDlg =
      cell.kind === 'open' && cell.pieces.length >= 2
        ? {
            kind: 'peel' as const,
            pos,
            piece: null,
            min: 1,
            max: cell.pieces.length - 1,
            value: 1,
          }
        : null;
    return { state: null, ui: { ...ui, selectedPos: pos, countDlg } };
  }
  return { state: null, ui };
}

/** 库存棋点击:选中/取消(数量条打开时先关闭再选中) */
export function handleInvClick(state: GameState, ui: UiState, piece: Piece): UiState {
  if (state.winner !== null || state.draw || ui.pending) return ui;
  const base = ui.countDlg ? { ...ui, countDlg: null } : ui;
  const selected =
    base.selectedInv &&
    base.selectedInv.type === piece.type &&
    base.selectedInv.color === piece.color
      ? null
      : piece;
  return { ...base, selectedInv: selected, selectedPos: null };
}

/** 数量选择器确认 */
export function confirmCount(state: GameState, ui: UiState): ClickResult {
  const dlg = ui.countDlg;
  if (!dlg) return { state: null, ui };
  let move: Move;
  if (dlg.kind === 'stack') {
    move = { kind: 'stack', piece: dlg.piece!, to: dlg.pos, count: dlg.value };
  } else {
    move = { kind: 'peel', from: dlg.pos, count: dlg.value };
  }
  return { state: apply(state, move), ui: resetSel(ui) };
}

/** 应用操作(带防御,非法时原样返回) */
function apply(state: GameState, move: Move): GameState {
  try {
    return applyMove(state, move);
  } catch {
    return state;
  }
}

function resetSel(ui: UiState): UiState {
  return { ...ui, selectedPos: null, selectedInv: null, countDlg: null };
}
