/**
 * 面板渲染:状态栏、双方库存(圆形棋子)、操作栏、终局横幅、数量选择器。
 */

import { countPieces } from '../game/state';
import type { GameState, Piece, PieceType, Pos } from '../game/types';
import { glyphOf } from './glyph';
import type { Highlights, UiState } from './interaction';

const TYPE_ORDER: PieceType[] = ['帅', '士', '象', '车', '马', '炮', '兵'];

export interface Handlers {
  onCell: (pos: Pos) => void;
  onInv: (piece: Piece) => void;
  onUndo: () => void;
  onDrawProposal: () => void;
  onSurrender: () => void;
  onNewGame: () => void;
  onMenu: () => void;
  onCount: (value: number) => void;
  onCountCancel: () => void;
  onAcceptDraw: () => void;
  onRejectDraw: () => void;
  onConfirmSurrender: () => void;
  onCancelPending: () => void;
}

// ---------- 状态栏 ----------

export function renderStatus(state: GameState, ui: UiState): HTMLElement {
  const el = document.createElement('div');
  el.className = 'status';

  const turn = document.createElement('span');
  const color = state.players[state.current]?.color;
  if (color === null) {
    turn.textContent = '双方阵营未定';
    turn.className = 'turn';
  } else {
    turn.textContent = color === 'red' ? '红方行动' : '黑方行动';
    turn.className = `turn ${color === 'red' ? 'turn-red' : 'turn-black'}`;
  }
  el.appendChild(turn);

  const round = document.createElement('span');
  round.className = 'hint';
  round.textContent = `第 ${state.history.length} 步`;
  el.appendChild(round);

  const hint = document.createElement('span');
  hint.className = 'hint';
  if (state.winner !== null) {
    const w = state.players[state.winner]?.color;
    hint.textContent = w === 'red' ? '红方胜利!' : '黑方胜利!';
  } else if (state.draw) {
    hint.textContent = '和局';
  } else if (color === null) {
    hint.textContent = '翻第一枚棋定阵营';
  } else if (ui.selectedInv) {
    hint.textContent = '点空格放置,或点同类叠层';
  } else if (ui.selectedPos) {
    hint.textContent = '点目标移动吃子,或用底部取层条';
  } else {
    hint.textContent = '点暗格翻棋,点己方棋移动';
  }
  el.appendChild(hint);

  return el;
}

// ---------- 库存面板 ----------

function inventoryGroups(inventory: Piece[], ownColor: Piece['color']) {
  const own = new Map<PieceType, number>();
  const stuck = new Map<PieceType, number>();
  for (const p of inventory) {
    const m = p.color === ownColor ? own : stuck;
    m.set(p.type, (m.get(p.type) ?? 0) + 1);
  }
  return { own, stuck };
}

export function renderPlayer(
  state: GameState,
  player: number,
  ui: UiState,
  hl: Highlights,
  onInv: (piece: Piece) => void,
): HTMLElement {
  const me = state.players[player]!;
  const el = document.createElement('div');
  el.className = `player-panel p${player} ${state.current === player ? 'active' : ''}`;

  const title = document.createElement('div');
  title.className = 'p-title';
  const name = document.createElement('span');
  name.className = `name ${me.color === 'red' ? 'pname-red' : 'pname-black'}`;
  name.textContent = me.color ? `${me.color === 'red' ? '红方' : '黑方'} 库存` : '库存';
  title.appendChild(name);
  const count = document.createElement('span');
  count.textContent = `${countPieces(state, player)} 棋`;
  title.appendChild(count);
  el.appendChild(title);

  const row = document.createElement('div');
  row.className = 'inv-row';

  const { own, stuck } = inventoryGroups(me.inventory, me.color ?? 'red');
  const mine = state.current === player; // 仅当前玩家可操作自己库存
  for (const type of TYPE_ORDER) {
    const n = own.get(type);
    if (n && n > 0) {
      row.appendChild(
        invPiece(state, player, { type, color: me.color! }, n, ui, hl, onInv, !mine),
      );
    }
  }
  for (const type of TYPE_ORDER) {
    const n = stuck.get(type);
    if (n && n > 0) {
      row.appendChild(
        invPiece(state, player, { type, color: me.color === 'red' ? 'black' : 'red' }, n, ui, hl, onInv, true),
      );
    }
  }
  if (me.inventory.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'inv-empty';
    empty.textContent = '空';
    row.appendChild(empty);
  }
  el.appendChild(row);
  return el;
}

/** 库存圆形棋子(己方色可点选,敌方色滞留置灰) */
function invPiece(
  state: GameState,
  player: number,
  piece: Piece,
  n: number,
  ui: UiState,
  hl: Highlights,
  onInv: (piece: Piece) => void,
  stuck: boolean,
): HTMLElement {
  const el = document.createElement('span');
  el.className = `inv-piece ${piece.color === 'red' ? 'piece-red' : 'piece-black'}`;
  if (stuck) el.classList.add('stuck');

  const disc = document.createElement('span');
  disc.className = 'inv-disc';
  disc.textContent = glyphOf(piece);
  el.appendChild(disc);

  if (n > 1) {
    const badge = document.createElement('span');
    badge.className = 'inv-count';
    badge.textContent = `×${n}`;
    el.appendChild(badge);
  }

  if (!stuck) {
    if (
      hl.invSelected &&
      hl.invSelected.type === piece.type &&
      hl.invSelected.color === piece.color
    ) {
      el.classList.add('selected');
    }
    el.addEventListener('click', () => onInv(piece));
    el.title = '点击选中:点空格放置,或点同类叠层';
  } else {
    el.title = '不可用棋子(对方颜色的滞留棋,或对方库存)';
  }
  return el;
}

// ---------- 操作栏 ----------

export function renderActions(
  state: GameState,
  h: Handlers,
): HTMLElement {
  const el = document.createElement('div');
  el.className = 'actions';

  const undo = document.createElement('button');
  undo.className = 'btn ghost';
  undo.textContent = '悔一步';
  undo.disabled = state.history.length === 0 || state.winner !== null;
  undo.addEventListener('click', h.onUndo);
  el.appendChild(undo);

  const draw = document.createElement('button');
  draw.className = 'btn ghost';
  draw.textContent = '提议和局';
  draw.disabled = state.winner !== null || state.draw;
  draw.addEventListener('click', h.onDrawProposal);
  el.appendChild(draw);

  const sur = document.createElement('button');
  sur.className = 'btn danger';
  sur.textContent = '投降';
  sur.disabled = state.winner !== null || state.draw;
  sur.addEventListener('click', h.onSurrender);
  el.appendChild(sur);

  const restart = document.createElement('button');
  restart.className = 'btn primary';
  restart.textContent = '新局';
  restart.addEventListener('click', h.onNewGame);
  el.appendChild(restart);

  const menu = document.createElement('button');
  menu.className = 'btn ghost';
  menu.textContent = '主菜单';
  menu.addEventListener('click', h.onMenu);
  el.appendChild(menu);

  return el;
}

// ---------- 终局横幅 ----------

export function renderBanner(state: GameState, h: Handlers): HTMLElement | null {
  const overlay = document.createElement('div');
  overlay.className = 'banner';
  const card = document.createElement('div');
  card.className = 'banner-card';

  const title = document.createElement('h2');
  if (state.winner !== null) {
    const w = state.players[state.winner]?.color;
    title.textContent = w === 'red' ? '红方胜' : '黑方胜';
    title.style.color = w === 'red' ? '#e88074' : '#cfcfcf';
  } else if (state.draw) {
    title.textContent = '和局';
    title.style.color = '#d8c49a';
  } else {
    return null;
  }
  card.appendChild(title);

  const sub = document.createElement('div');
  sub.className = 'sub';
  sub.textContent = state.winner !== null ? '条件达成,对局结束' : '双方协商一致';
  card.appendChild(sub);

  const row = document.createElement('div');
  row.className = 'row';
  const again = document.createElement('button');
  again.className = 'btn primary';
  again.textContent = '再来一局';
  again.addEventListener('click', h.onNewGame);
  row.appendChild(again);
  card.appendChild(row);

  overlay.appendChild(card);
  return overlay;
}

// ---------- 数量操作条(底部,不遮挡棋盘) ----------

export function renderCountBar(
  ui: UiState,
  h: Handlers,
): HTMLElement | null {
  const dlg = ui.countDlg;
  if (!dlg) return null;

  const bar = document.createElement('div');
  bar.className = 'count-bar';

  const label = document.createElement('span');
  label.className = 'count-label';
  label.textContent = dlg.kind === 'stack' ? '叠层' : '取层';
  bar.appendChild(label);

  const minus = document.createElement('button');
  minus.className = 'stepper';
  minus.textContent = '−';
  minus.disabled = dlg.value <= dlg.min;
  minus.addEventListener('click', () => h.onCount(-1));
  bar.appendChild(minus);

  const val = document.createElement('span');
  val.className = 'val';
  val.textContent = String(dlg.value);
  bar.appendChild(val);

  const plus = document.createElement('button');
  plus.className = 'stepper';
  plus.textContent = '+';
  plus.disabled = dlg.value >= dlg.max;
  plus.addEventListener('click', () => h.onCount(1));
  bar.appendChild(plus);

  const ok = document.createElement('button');
  ok.className = 'btn primary';
  ok.textContent = '确认';
  ok.addEventListener('click', () => h.onCount(0));
  bar.appendChild(ok);

  const cancel = document.createElement('button');
  cancel.className = 'btn ghost';
  cancel.textContent = '取消';
  cancel.addEventListener('click', h.onCountCancel);
  bar.appendChild(cancel);

  return bar;
}

// ---------- 提议/投降确认横幅 ----------

export function renderPending(ui: UiState, h: Handlers): HTMLElement | null {
  if (!ui.pending) return null;
  const overlay = document.createElement('div');
  overlay.className = 'banner';
  const card = document.createElement('div');
  card.className = 'banner-card';

  const title = document.createElement('h2');
  if (ui.pending.kind === 'drawProposal') {
    title.textContent = '和局提议';
    title.style.color = '#d8c49a';
  } else {
    title.textContent = '确认投降?';
    title.style.color = '#e88074';
  }
  card.appendChild(title);

  const sub = document.createElement('div');
  sub.className = 'sub';
  sub.textContent =
    ui.pending.kind === 'drawProposal' ? '对方提议和局,接受吗?' : '投降将判对方获胜';
  card.appendChild(sub);

  const row = document.createElement('div');
  row.className = 'row';
  if (ui.pending.kind === 'drawProposal') {
    const yes = document.createElement('button');
    yes.className = 'btn primary';
    yes.textContent = '接受';
    yes.addEventListener('click', h.onAcceptDraw);
    row.appendChild(yes);
    const no = document.createElement('button');
    no.className = 'btn ghost';
    no.textContent = '拒绝';
    no.addEventListener('click', h.onRejectDraw);
    row.appendChild(no);
  } else {
    const yes = document.createElement('button');
    yes.className = 'btn danger';
    yes.textContent = '确认';
    yes.addEventListener('click', h.onConfirmSurrender);
    row.appendChild(yes);
    const no = document.createElement('button');
    no.className = 'btn ghost';
    no.textContent = '取消';
    no.addEventListener('click', h.onCancelPending);
    row.appendChild(no);
  }
  card.appendChild(row);

  overlay.appendChild(card);
  return overlay;
}
