/**
 * 宿舍「布置」条：底部一条横栏，左边是家具仓库（点一下拿起来），右边是已经摆出来的（点一下收回去）。
 * 只管界面，摆到哪一格、能不能摆由 InteriorScene + 服务器决定。
 */
import { FURN_SHOP, furnDef, ownedTotal } from '@/shared/furn';
import type { PlacedFurn } from '@/shared/furn';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export interface PlaceHooks {
  pick(k: string): void;
  take(i: number): void;
  /** 把屋里摆着的全收回仓库 */
  takeAll(): void;
  rotate(): void;
  close(): void;
}

export class PlaceBar {
  private root = el('div', 'place-bar hidden');   // 注意：挂在 #hud 里，而 #hud 是 pointer-events:none，所以要自己打开
  private left = el('div', 'place-list');
  private right = el('div', 'place-list');
  private tip = el('div', 'place-tip', '');
  private rotBtn = el('button', 'btn', '↻ 旋转');
  private takeAllBtn = el('button', 'btn', '↩ 全部收回');
  private closeBtn = el('button', 'btn', '✕ 收起面板');
  private own: Record<string, number> = {};
  private placed: PlacedFurn[] = [];

  constructor(private hooks: PlaceHooks) {
    const head = el('div', 'place-head');
    head.append(el('span', 'place-title', '🛋 布置宿舍'), this.tip);
    const body = el('div', 'place-cols');
    const l = el('div', 'place-col'), r = el('div', 'place-col');
    l.append(el('div', 'place-sub', '家具仓库（点一下拿起来）'), this.left);
    r.append(el('div', 'place-sub', '已经摆着的（点一下收回）'), this.right);
    body.append(l, r);
    const foot = el('div', 'place-foot');
    this.rotBtn.type = 'button'; this.closeBtn.type = 'button'; this.takeAllBtn.type = 'button';
    this.rotBtn.addEventListener('click', () => this.hooks.rotate());
    this.takeAllBtn.addEventListener('click', () => this.hooks.takeAll());
    this.closeBtn.addEventListener('click', () => this.hooks.close());
    foot.append(this.rotBtn, this.takeAllBtn, this.closeBtn);
    this.root.append(head, body, foot);
    this.root.style.pointerEvents = 'auto';   // 双保险：样式表没生效也点得到
    document.querySelectorAll('.place-bar').forEach((n) => n.remove()); // 重进场景时不留旧条
    this.root.style.pointerEvents = 'auto';   // 双保险：样式表没生效也点得到
    document.querySelectorAll('.place-bar').forEach((n) => n.remove()); // 重进场景时不留旧条
    (document.getElementById('hud') ?? document.body).append(this.root);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.isOpen) { e.stopPropagation(); this.hooks.close(); } });
  }

  get isOpen() { return !this.root.classList.contains('hidden'); }
  open() { this.root.classList.remove('hidden'); }
  close() { this.root.classList.add('hidden'); }
  say(text: string, ok = true) { this.tip.textContent = text; this.tip.classList.toggle('bad', !ok); }

  set(own: Record<string, number>, placed: PlacedFurn[]): void {
    this.own = own; this.placed = placed;
    if (!this.isOpen) return;
    this.render();
  }

  render(): void {
    this.left.replaceChildren();
    const keys = FURN_SHOP.map((f) => f.k).filter((k) => (this.own[k] ?? 0) > 0);
    if (!keys.length) this.left.append(el('div', 'place-empty', '仓库是空的：先去商店买几件家具'));
    for (const k of keys) {
      const b = el('button', 'place-chip', `${furnDef(k)?.name ?? k} ×${this.own[k]}`);
      b.type = 'button';
      b.addEventListener('click', () => this.hooks.pick(k));
      this.left.append(b);
    }
    this.right.replaceChildren();
    if (!this.placed.length) this.right.append(el('div', 'place-empty', '还没摆东西'));
    this.placed.forEach((f, i) => {
      const b = el('button', 'place-chip remove', `✕ ${furnDef(f.k)?.name ?? f.k}（${f.x},${f.y}${f.rot ? ` ${f.rot}°` : ''}）`);
      b.type = 'button';
      b.title = '点一下收回家具仓库';
      b.addEventListener('click', () => this.hooks.take(i));
      this.right.append(b);
    });
    const n = ownedTotal(this.own);
    this.tip.textContent = `仓库 ${n} 件 · 屋里 ${this.placed.length} 件（点「✕」收回）`;
    this.takeAllBtn.disabled = this.placed.length === 0;
  }
}
