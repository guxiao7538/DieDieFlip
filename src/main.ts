/** 入口:装配引擎与 UI,持有对局状态与交互状态,全量渲染 */

import {
  createInitialState,
  DEFAULT_OPTIONS,
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
  renderMoveLog,
  renderPending,
  renderPlayer,
  renderStatus,
} from './ui/panels';
import type { Handlers } from './ui/panels';
import './ui/style.css';

let state: GameState = createInitialState();
let ui: UiState = createUiState();
let view: 'menu' | 'game' = 'menu';
// 低吃高玩法默认开启(规则七)
let menuUi: MenuUi = {
  rulesOpen: false,
  optionsOpen: false,
  allowLowCapture: true,
};

const app = document.getElementById('app')!;

function startGame(): void {
  state = createInitialState({
    ...DEFAULT_OPTIONS,
    allowLowCapture: menuUi.allowLowCapture,
  });
  ui = createUiState();
  view = 'game';
  refresh();
}

let toastTimer: number | undefined;

function showToast(text: string): void {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  app.appendChild(t);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.remove(), 1200);
}

function refresh(): void {
  if (view === 'menu') {
    app.replaceChildren(
      renderMenu(menuUi, {
        onOpenOptions: () => {
          menuUi = { ...menuUi, optionsOpen: true };
          refresh();
        },
        onConfirmStart: startGame,
        onCancelOptions: () => {
          menuUi = { ...menuUi, optionsOpen: false };
          refresh();
        },
        onToggleLowCapture: () => {
          menuUi = { ...menuUi, allowLowCapture: !menuUi.allowLowCapture };
          refresh();
        },
        onToggleRules: () => {
          menuUi = { ...menuUi, rulesOpen: !menuUi.rulesOpen };
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
      if (r.toast) showToast(r.toast); // 必须在 refresh 之后,否则被 replaceChildren 清掉
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
      state = createInitialState(state.options);
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
    onToggleLog: () => {
      ui = { ...ui, logOpen: !ui.logOpen };
      refresh();
    },
  };

  const players = document.createElement('div');
  players.className = 'players';
  // 右侧栏:黑方库存在上,记谱面板在下(宽屏);竖屏记谱面板由浮层提供
  const sideRight = document.createElement('div');
  sideRight.className = 'side-right';
  sideRight.append(renderPlayer(state, 1, ui, hl, h.onInv), renderMoveLog(state));
  players.append(renderPlayer(state, 0, ui, hl, h.onInv), sideRight);

  app.replaceChildren(
    renderStatus(state, ui),
    players,
    renderBoard(state, hl, h.onCell),
    renderActions(state, h),
  );

  const top = renderBanner(state, h) ?? renderPending(ui, h) ?? renderCountBar(ui, h);
  if (top) app.appendChild(top);

  // 竖屏记谱入口:悬浮「谱」按钮 + 浮层(宽屏由 CSS 隐藏)
  const fab = document.createElement('button');
  fab.className = 'log-fab';
  fab.textContent = '棋谱';
  fab.addEventListener('click', h.onToggleLog);
  app.appendChild(fab);

  if (ui.logOpen) {
    const overlay = document.createElement('div');
    overlay.className = 'log-overlay';
    const card = document.createElement('div');
    card.className = 'log-card';
    const head = document.createElement('div');
    head.className = 'log-head';
    const close = document.createElement('button');
    close.className = 'btn ghost';
    close.textContent = '关闭';
    close.addEventListener('click', h.onToggleLog);
    head.appendChild(close);
    card.append(head, renderMoveLog(state));
    overlay.appendChild(card);
    app.appendChild(overlay);
  }

  // 记谱列表滚到底(需在插入 DOM 后生效)
  requestAnimationFrame(() => {
    document.querySelectorAll('.move-log-list').forEach((l) => {
      l.scrollTop = l.scrollHeight;
    });
  });
}

refresh();
