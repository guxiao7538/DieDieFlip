/** 棋盘渲染:4×8 网格,暗格圆片/叠层/高亮/层数徽标/取层角标 */

import type { GameState, Pos } from '../game/types';
import { BOARD_H, BOARD_W } from '../game/types';
import { glyphOf } from './glyph';
import type { Highlights } from './interaction';

const samePos = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;

export function renderBoard(
  state: GameState,
  hl: Highlights,
  onCell: (pos: Pos) => void,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'board-wrap';
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

      el.addEventListener('click', () => onCell(pos));
      board.appendChild(el);
    }
  }

  wrap.appendChild(board);
  return wrap;
}
