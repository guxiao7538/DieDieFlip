/** 主界面与规则面板渲染 */

import { APP_VERSION } from './version';

export interface MenuHandlers {
  onStart: () => void;
  onToggleRules: () => void;
}

export interface MenuUi {
  rulesOpen: boolean;
}

export function renderMenu(ui: MenuUi, h: MenuHandlers): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'menu';

  const decor = document.createElement('div');
  decor.className = 'menu-decor';
  for (const [text, color] of [
    ['帅', 'red'],
    ['将', 'black'],
    ['炮', 'red'],
    ['卒', 'black'],
    ['仕', 'red'],
    ['象', 'black'],
  ] as const) {
    const d = document.createElement('div');
    d.className = `decor-piece piece-${color}`;
    d.textContent = text;
    decor.appendChild(d);
  }
  wrap.appendChild(decor);

  const title = document.createElement('h1');
  title.className = 'menu-title';
  title.textContent = '叠叠翻棋';
  wrap.appendChild(title);

  const sub = document.createElement('p');
  sub.className = 'menu-sub';
  sub.textContent = '双人对弈 · 翻棋变体 · 叠层攻防';
  wrap.appendChild(sub);

  const start = document.createElement('button');
  start.className = 'btn primary menu-btn';
  start.textContent = '开始游戏';
  start.addEventListener('click', h.onStart);
  wrap.appendChild(start);

  const rules = document.createElement('button');
  rules.className = 'btn ghost menu-btn';
  rules.textContent = '玩法规则';
  rules.addEventListener('click', h.onToggleRules);
  wrap.appendChild(rules);

  const ver = document.createElement('div');
  ver.className = 'menu-version';
  ver.textContent = `v${APP_VERSION}`;
  wrap.appendChild(ver);

  if (ui.rulesOpen) {
    wrap.appendChild(renderRules(h));
  }
  return wrap;
}

const RULES: [string, string][] = [
  ['翻棋揭幕', '翻出第一枚棋的颜色即你的阵营,对方自动归属另一色。翻完即轮到对方。'],
  ['五种操作', '每回合五选一:翻棋、移动、放置、叠层、取层。'],
  ['棋子走法', '车横竖直线;马斜走一格(非日字);炮直线平移,吃子须隔一个棋子(隔山打牛);士/象/帅/兵横竖一格。'],
  ['叠层机制', '同类棋可叠放,一次可叠多枚;叠层按最上层棋走法。吃子不看等级看层数:层数多者吃少者,同层互吃,整叠被吃进库存。'],
  ['取层', '取走己方叠层的上层棋放入库存,该格保留至少一枚。'],
  ['胜利条件', '吃光对方全部棋子(含库存),或对方无棋可走;也可协商和局或投降认负。'],
];

function renderRules(h: MenuHandlers): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'rules-overlay';

  const card = document.createElement('div');
  card.className = 'rules-card';

  const title = document.createElement('h2');
  title.textContent = '玩法规则';
  card.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'rules-list';
  for (const [head, body] of RULES) {
    const li = document.createElement('li');
    const b = document.createElement('b');
    b.textContent = head;
    li.appendChild(b);
    li.appendChild(document.createTextNode(' ' + body));
    list.appendChild(li);
  }
  card.appendChild(list);

  const close = document.createElement('button');
  close.className = 'btn primary';
  close.textContent = '知道了';
  close.addEventListener('click', h.onToggleRules);
  card.appendChild(close);

  overlay.appendChild(card);
  return overlay;
}
