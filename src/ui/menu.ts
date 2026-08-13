/** 主界面与规则面板、玩法选择浮层渲染 */

import { APP_VERSION } from './version';

export interface MenuHandlers {
  /** 主界面「开始游戏」:打开玩法选择浮层 */
  onOpenOptions: () => void;
  /** 玩法浮层:确认开局 */
  onConfirmStart: () => void;
  /** 玩法浮层:取消,回主界面 */
  onCancelOptions: () => void;
  /** 玩法浮层:切换低吃高勾选 */
  onToggleLowCapture: () => void;
  onToggleRules: () => void;
}

export interface MenuUi {
  rulesOpen: boolean;
  optionsOpen: boolean;
  /** 可选玩法:低吃高(默认开启) */
  allowLowCapture: boolean;
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
  start.addEventListener('click', h.onOpenOptions);
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
  if (ui.optionsOpen) {
    wrap.appendChild(renderOptions(ui, h));
  }
  return wrap;
}

/** 玩法选择浮层:开局前确认玩法(低吃高默认开启) */
function renderOptions(ui: MenuUi, h: MenuHandlers): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'options-overlay';

  const card = document.createElement('div');
  card.className = 'options-card';

  const title = document.createElement('h2');
  title.textContent = '选择玩法';
  card.appendChild(title);

  const low = document.createElement('label');
  low.className = `option-card${ui.allowLowCapture ? ' checked' : ''}`;
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = ui.allowLowCapture;
  box.addEventListener('change', h.onToggleLowCapture);
  low.appendChild(box);
  const mark = document.createElement('span');
  mark.className = 'option-box';
  mark.textContent = '✓';
  low.appendChild(mark);
  const main = document.createElement('span');
  main.className = 'option-main';
  const nameRow = document.createElement('span');
  nameRow.className = 'option-name';
  nameRow.textContent = '低吃高';
  const def = document.createElement('span');
  def.className = 'option-default';
  def.textContent = '默认';
  nameRow.appendChild(def);
  main.appendChild(nameRow);
  const desc = document.createElement('span');
  desc.className = 'option-desc';
  desc.textContent = '吃己方棋不受层数限制;吃对方仍须层数不低于对方';
  main.appendChild(desc);
  low.appendChild(main);
  card.appendChild(low);

  const row = document.createElement('div');
  row.className = 'row';
  const cancel = document.createElement('button');
  cancel.className = 'btn ghost';
  cancel.textContent = '取消';
  cancel.addEventListener('click', h.onCancelOptions);
  row.appendChild(cancel);
  const confirm = document.createElement('button');
  confirm.className = 'btn primary';
  confirm.textContent = '确认开始';
  confirm.addEventListener('click', h.onConfirmStart);
  row.appendChild(confirm);
  card.appendChild(row);

  overlay.appendChild(card);
  return overlay;
}

const RULES: [string, string][] = [
  ['翻棋揭幕', '翻出第一枚棋的颜色即你的阵营,对方自动归属另一色;翻出的棋归其颜色阵营。翻完即轮到对方。'],
  ['五种操作', '每回合五选一:翻棋、移动、放置、叠层、取层。'],
  ['棋子走法', '车横竖直线;马斜走一格(非日字);炮直线平移,吃子须隔一个棋子(隔山打牛,暗格可作炮架);士/象/帅/兵横竖一格。'],
  ['叠层机制', '同类棋可叠放,一次可叠多枚;叠层按最上层棋走法。吃子不看等级看层数:层数多者吃少者,同层互吃,整叠被吃进库存。'],
  ['低吃高(默认开启)', '吃己方棋不受层数限制,便于回收调度;吃对方棋仍须层数不低于对方。'],
  ['取层', '取走己方叠层的上层棋放入库存,该格保留至少一枚。'],
  ['胜利条件', '吃光对方全部 16 枚(含未翻开的暗格棋、库存),或对方无棋可走;也可协商和局或投降认负。'],
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
