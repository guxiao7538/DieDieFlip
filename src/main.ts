/** 入口:装配引擎与 UI,持有对局状态与交互状态,全量渲染 */

import {
  createInitialState,
  markDraw,
  surrender,
  undo,
} from './game/state';
import type { GameState, Pos } from './game/types';
import { renderBoard } from './ui/board';
import {
  computeHighlights,
  confirmCount,
  createUiState,
  handleCellClick,
  handleInvClick,
  handlePeelClick,
} from './ui/interaction';
import type { UiState } from './ui/interaction';
import {
  renderActions,
  renderBanner,
  renderCountDlg,
  renderPending,
  renderPlayer,
  renderStatus,
} from './ui/panels';
import type { Handlers } from './ui/panels';
import './ui/style.css';

let state: GameState = createInitialState();
let ui: UiState = createUiState();

const app = document.getElementById('app')!;

function refresh(): void {
  const hl = computeHighlights(state, ui);
  const h: Handlers = {
    onCell: (pos: Pos) => {
      const r = handleCellClick(state, ui, pos);
      if (r.state) state = r.state;
      ui = r.ui;
      refresh();
    },
    onPeel: (pos: Pos) => {
      const r = handlePeelClick(state, ui);
      ui = r.ui;
      refresh();
    },
    onInv: (piece) => {
      ui = handleInvClick(state, ui, piece);
      refresh();
    },
    onUndo: () => {
      const back = undo(state);
      if (back) {
        state = back;
        ui = createUiState();
        refresh();
      }
    },
    onDrawProposal: () => {
      ui = { ...ui, pending: { kind: 'drawProposal' } };
      refresh();
    },
    onSurrender: () => {
      ui = { ...ui, pending: { kind: 'surrenderConfirm' } };
      refresh();
    },
    onNewGame: () => {
      state = createInitialState();
      ui = createUiState();
      refresh();
    },
    onCount: (delta: number) => {
      if (delta === 0) {
        // 0 = 确认
        const r = confirmCount(state, ui);
        if (r.state) state = r.state;
        ui = r.ui;
      } else if (ui.countDlg) {
        const dlg = ui.countDlg;
        const value = Math.min(dlg.max, Math.max(dlg.min, dlg.value + delta));
        ui = { ...ui, countDlg: { ...dlg, value } };
      }
      refresh();
    },
    onCountCancel: () => {
      ui = { ...ui, countDlg: null };
      refresh();
    },
    onAcceptDraw: () => {
      state = markDraw(state);
      ui = createUiState();
      refresh();
    },
    onRejectDraw: () => {
      ui = { ...ui, pending: null };
      refresh();
    },
    onConfirmSurrender: () => {
      state = surrender(state, state.current);
      ui = createUiState();
      refresh();
    },
    onCancelPending: () => {
      ui = { ...ui, pending: null };
      refresh();
    },
  };

  app.replaceChildren(
    renderStatus(state, ui),
    renderPlayer(state, 0, ui, hl, h.onInv),
    renderPlayer(state, 1, ui, hl, h.onInv),
    renderBoard(state, hl, h.onCell, h.onPeel),
    renderActions(state, h),
  );

  const top = renderBanner(state, h) ?? renderPending(ui, h) ?? renderCountDlg(ui, h);
  if (top) app.appendChild(top);
}

refresh();
