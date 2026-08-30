/**
 * 随机自对弈模糊测试:引擎自我对弈,每步断言核心不变式。
 * - 棋子总数守恒(32 枚不灭:吃子/取层进库存,叠层/移动只在盘面转移)
 * - moveLog 与 history 同步增减
 * - undo 返回前态引用(history 存快照)
 * - 非终局时行动方必有合法操作(与胜利条件 B 自洽)
 * 参考 doggy8088/chinese-chess 的 fuzz 思路;种子固定,失败可复现。
 */

import { describe, expect, it } from 'vitest';
import { legalMoves } from './moves';
import { applyMove, createInitialState, DEFAULT_OPTIONS, undo } from './state';
import type { GameState } from './types';

/** 可复现伪随机数(mulberry32) */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function totalPieces(s: GameState): number {
  let n = s.players[0]!.inventory.length + s.players[1]!.inventory.length;
  for (const row of s.board) {
    for (const c of row) n += c.kind === 'facedown' ? 1 : c.pieces.length;
  }
  return n;
}

describe('随机自对弈', () => {
  it('40 局不变式守恒(棋子总数/历史同步/undo 前态)', () => {
    for (let g = 0; g < 40; g++) {
      const rand = mulberry32(g * 7919 + 1);
      let s = createInitialState({
        ...DEFAULT_OPTIONS,
        useEnemyForPlace: g % 2 === 0,
        allowLowCapture: g % 3 !== 0,
      });
      let prev: GameState | null = null;
      for (
        let step = 0;
        step < 250 && s.winner === null && !s.draw;
        step++
      ) {
        const moves = legalMoves(s, s.current);
        expect(moves.length).toBeGreaterThan(0);
        prev = s;
        s = applyMove(s, moves[Math.floor(rand() * moves.length)]!);
        expect(totalPieces(s)).toBe(32);
        expect(s.moveLog.length).toBe(s.history.length);
        expect(undo(s)).toBe(prev);
      }
    }
  });
});
