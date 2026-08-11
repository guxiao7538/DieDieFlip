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
} from './ui/interaction';
import type { UiState } from './ui/interaction';
import { renderMenu } from './ui/menu';
import type { MenuUi } from './ui/menu';
import {
  renderActions,
  renderBanner,
  renderCountBar,
  renderPending,
  renderPlayer,
  renderStatus,
} from './ui/panels';
import type { Handlers } from './ui/panels';
import './ui/style.css';

let state: GameState = createInitialState();
let ui: UiState = createUiState();
let view: 'menu' | 'game' = 'menu';
let menuUi: MenuUi = { rulesOpen: false };

const app = document.getElementById('app')!;

function startGame(): void {
  state = createInitialState();
  ui = createUiState();
  view = 'game';
  refresh();
}

function refresh(): void {
  if (view === 'menu') {
    app.replaceChildren(
      renderMenu(menuUi, {
        onStart: startGame,
        onToggleRules: () => {
          menuUi = { rulesOpen: !menuUi.rulesOpen };
          refresh();
        },
      }),
    );
    return;
  }

  const hl = computeHighlights(state, ui);
  const h: Handlers = {
    onCell: (pos: Pos) => {
      const r = handleCellClick(state, ui, pos);
      if (r.state) state = r.state;
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
    onMenu: () => {
      view = 'menu';
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

  const players = document.createElement('div');
  players.className = 'players';
  players.append(renderPlayer(state, 0, ui, hl, h.onInv), renderPlayer(state, 1, ui, hl, h.onInv));

  app.replaceChildren(
    renderStatus(state, ui),
    players,
    renderBoard(state, hl, h.onCell),
    renderActions(state, h),
  );

  const top = renderBanner(state, h) ?? renderPending(ui, h) ?? renderCountBar(ui, h);
  if (top) app.appendChild(top);
}

refresh();
