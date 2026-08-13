/** 棋盘渲染:四边刻度 + 4×8 网格,暗格圆片/叠层/高亮/层数徽标/取层角标 */

import type { GameState, Pos } from '../game/types';
import { BOARD_H, BOARD_W } from '../game/types';
import { glyphOf } from './glyph';
import type { Highlights } from './interaction';

const samePos = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;

/** 刻度条:四边标注双方视角坐标,与记谱文本一致(上/右=黑方,下/左=红方) */
function edge(className: string, label: string, nums: number[]): HTMLElement {
  const el = document.createElement('div');
  el.className = `edge ${className}`;
  el.setAttribute('aria-label', label);
  for (const n of nums) {
    const s = document.createElement('span');
    s.className = 'edge-num';
    s.textContent = String(n);
    el.appendChild(s);
  }
  return el;
}

export function renderBoard(
  state: GameState,
  hl: Highlights,
  onCell: (pos: Pos) => void,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'board-wrap';

  // 上=黑方列(黑视角右→左,即物理左→右 1-4);下=红方列(红视角右→左,即物理左→右 4-1)
  const top = edge('edge-top', '黑方列', [1, 2, 3, 4]);
  const bottom = edge('edge-bottom', '红方列', [4, 3, 2, 1]);
  // 左=红方行(红底线在上方视角为 8→1);右=黑方行(黑底线起 1→8)
  const left = edge('edge-left', '红方行', [8, 7, 6, 5, 4, 3, 2, 1]);
  const right = edge('edge-right', '黑方行', [1, 2, 3, 4, 5, 6, 7, 8]);

  const board = document.createElement('div');
  board.className = 'board';

  for (let y = 0; y < BOARD_H; y++) {
    for (let x = 0; x < BOARD_W; x++) {
      const pos: Pos = { x, y };
      const cell = state.board[y]![x]!;
      const el = document.createElement('div');
      el.className = 'cell';

      if (cell.kind === 'facedown') {
        el.classList.add('facedown');
      } else {
        el.classList.add('open');
        if (cell.pieces.length > 0) {
          const top = cell.pieces[cell.pieces.length - 1]!;
          const piece = document.createElement('div');
          piece.className = `piece ${top.color === 'red' ? 'piece-red' : 'piece-black'}`;
          piece.textContent = glyphOf(top);
          el.appendChild(piece);
          if (cell.pieces.length > 1) {
            const ply = document.createElement('span');
            ply.className = 'ply';
            ply.textContent = String(cell.pieces.length);
            el.appendChild(ply);
          }
        }
      }

      if (hl.selected && samePos(hl.selected, pos)) el.classList.add('selected');
      if (hl.moveTargets.some((p) => samePos(p, pos))) el.classList.add('target-move');
      if (hl.eatTargets.some((p) => samePos(p, pos))) el.classList.add('target-eat');
      if (hl.placeTargets.some((p) => samePos(p, pos))) el.classList.add('target-place');
      if (hl.stackTargets.some((p) => samePos(p, pos))) el.classList.add('target-stack');
      if (hl.weakTargets.some((p) => samePos(p, pos))) el.classList.add('target-weak');

      el.addEventListener('click', () => onCell(pos));
      board.appendChild(el);
    }
  }

  wrap.append(top, left, board, right, bottom);
  return wrap;
}
