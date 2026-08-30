/**
 * @vitest-environment happy-dom
 * GUI 烟雾测试:真实装配 main.ts(菜单→开局→翻棋→悔棋→选中),验证装配层
 * 与渲染层联动。交互状态机的分派规则由 interaction.test.ts 覆盖。
 */

import { describe, expect, it } from 'vitest';

document.body.innerHTML = '<div id="app"></div>';
const app = document.getElementById('app')!;
await import('./main');

function text(): string {
  return app.textContent ?? '';
}

function cellEls(): HTMLElement[] {
  return [...app.querySelectorAll('.cell')] as HTMLElement[];
}

function button(label: string): HTMLElement {
  const btn = [...app.querySelectorAll('button')].find(
    (b) => b.textContent === label,
  );
  if (!btn) {
    const have = [...app.querySelectorAll('button')].map((b) => b.textContent).join('/');
    throw new Error(`找不到按钮:${label}(当前:${have})`);
  }
  return btn as HTMLElement;
}

describe('装配烟雾测试', () => {
  it('菜单渲染,选择玩法后开局,32 格全暗', () => {
    expect(text()).toContain('叠叠翻棋');
    button('开始游戏').click();
    button('确认开始').click();
    expect(cellEls()).toHaveLength(32);
    expect(app.querySelectorAll('.cell.facedown')).toHaveLength(32);
    expect(text()).toContain('双方阵营未定');
  });

  it('点暗格翻棋定阵营,悔一步回退', () => {
    cellEls()[0]!.click();
    expect(app.querySelectorAll('.cell.facedown')).toHaveLength(31);
    expect(/红方行动|黑方行动/.test(text())).toBe(true);
    expect(app.querySelector('.hint')!.textContent).toContain('第 1 步');

    button('悔一步').click();
    expect(app.querySelectorAll('.cell.facedown')).toHaveLength(32);
    expect(app.querySelector('.hint')!.textContent).toContain('第 0 步');
    expect(text()).toContain('双方阵营未定');
  });

  it('双方各翻一枚定阵营后,先手可选中自己翻出的棋', () => {
    // 首翻定阵营且行动权换边:刚翻出的棋属于前一个行动者。
    // 两次翻棋后行动权回到玩家 0,其首翻的那枚即己方叠层,可选。
    cellEls()[0]!.click();
    cellEls()[1]!.click();
    expect(/红方行动|黑方行动/.test(text())).toBe(true);
    cellEls()[0]!.click(); // 选中先手翻出的己方棋
    expect(cellEls()[0]!.classList.contains('selected')).toBe(true);
    cellEls()[0]!.click(); // 再点取消
    expect(cellEls()[0]!.classList.contains('selected')).toBe(false);
  });
});
