/**
 * 实验田的底部操作条：显示 12 格的状态，点格子后在这里选操作。
 * 只管界面；能不能种、浇、收全由服务器判（客户端只负责发消息和显示）。
 */
import { CROPS, cropDef, isRipe, type Plots } from '@/shared/farm';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export interface FarmHooks {
  plant(i: number, k: string): void;
  water(i: number): void;
  harvest(i: number): void;
  waterAll(): void;
  close(): void;
}

export class FarmBar {
  private root = el('div', 'farm-bar hidden');
  private tip = el('div', 'farm-tip', '');
  private act = el('div', 'farm-act');          // 当前选中格的操作
  private pick = el('div', 'farm-pick hidden'); // 选种子
  private plot: Plots = [];
  private day = 0;
  private sel = -1;

  constructor(private hooks: FarmHooks) {
    this.root.style.pointerEvents = 'auto';     // #hud 是 pointer-events:none，浮层要自己打开
    const head = el('div', 'farm-head');
    head.append(el('span', 'farm-title', '🌱 我的实验田'), this.tip);
    const allBtn = el('button', 'btn', '💧 一键浇水');
    allBtn.type = 'button';
    allBtn.addEventListener('click', () => this.hooks.waterAll());
    const closeBtn = el('button', 'btn', '🚪 出去');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', () => this.hooks.close());
    head.append(allBtn, closeBtn);
    const body = el('div', 'farm-body');
    body.append(this.act, this.pick);
    this.root.append(head, body);
  }

  get isOpen() { return !this.root.classList.contains('hidden'); }

  open() {
    document.querySelectorAll('.farm-bar').forEach((n) => n.remove());
    (document.getElementById('hud') ?? document.body).append(this.root);
    this.root.classList.remove('hidden');
  }
  close() { this.root.classList.add('hidden'); this.sel = -1; }

  /** 服务器推来的新状态 */
  set(plots: Plots, day: number) {
    this.plot = plots; this.day = day;
    const ripe = plots.filter((p) => p && cropDef(p.k) && isRipe(cropDef(p.k)!, p)).length;
    const thirsty = plots.filter((p) => p && cropDef(p.k) && !isRipe(cropDef(p.k)!, p) && p.wd !== day).length;
    const empty = plots.filter((p) => !p).length;
    this.tip.textContent = `能收 ${ripe} 格 · 该浇 ${thirsty} 格 · 空地 ${empty} 格`;
    if (this.sel >= 0) this.renderSel();
  }

  /** 玩家点了第 i 格 */
  select(i: number) {
    if (i < 0 || i >= this.plot.length) return;
    this.sel = i;
    this.renderSel();
  }

  say(msg: string, ok = true) {
    this.tip.textContent = msg;
    this.tip.classList.toggle('bad', !ok);
    if (!ok) return;
    // 成功提示 4 秒后回到状态行
    window.setTimeout(() => { if (this.isOpen && this.sel >= 0) this.renderSel(); }, 4000);
  }

  private renderSel() {
    this.act.replaceChildren();
    this.pick.replaceChildren();
    this.pick.classList.add('hidden');
    if (this.sel < 0) { this.act.append(el('div', 'farm-hint', '点一下地里的格子：空地选种子，种了东西就浇水，熟了就能收')); return; }
    const cell = this.plot[this.sel];
    const no = el('span', 'farm-no', `第 ${this.sel + 1} 格`);
    if (!cell) {
      this.act.append(no, el('span', 'farm-hint', '空地 · 种点什么？'));
      this.pick.classList.remove('hidden');
      for (const c of CROPS) {
        const b = el('button', 'btn farm-seed', `${c.name} · ${c.seed} 币 / ${c.days} 天`);
        b.type = 'button';
        b.title = c.note;
        b.addEventListener('click', () => this.hooks.plant(this.sel, c.k));
        this.pick.append(b);
      }
      return;
    }
    const c = cropDef(cell.k);
    if (!c) { this.act.append(no, el('span', 'farm-hint', '这格里的作物不认识')); return; }
    if (isRipe(c, cell)) {
      const b = el('button', 'btn primary', `🧺 收${c.name}`);
      b.type = 'button';
      b.addEventListener('click', () => this.hooks.harvest(this.sel));
      this.act.append(no, el('span', 'farm-hint', `${c.name}熟了（每个卖 ${c.price}）`), b);
      return;
    }
    const left = c.days - cell.g;
    if (cell.wd === this.day) {
      this.act.append(no, el('span', 'farm-hint', `${c.name} · 今天浇过了，还要浇 ${left} 次`));
      return;
    }
    const b = el('button', 'btn primary', '💧 浇水');
    b.type = 'button';
    b.addEventListener('click', () => this.hooks.water(this.sel));
    this.act.append(no, el('span', 'farm-hint', `${c.name} · 还要浇 ${left} 次`), b);
  }
}
