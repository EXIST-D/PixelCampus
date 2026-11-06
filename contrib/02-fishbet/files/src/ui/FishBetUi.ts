import { BET, RARITY_CN, betPrize, canBet, oddsText } from '@/shared/fishbet';
import { FISH, fishDef } from '@/shared/fishing';
import { sellPrice } from '@/shared/economy';
import type { NetClient } from '@/net/client';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** 一局比赛的一条泳道（服务器按名次给过来的） */
interface Lane { id: string; name: string; rarity: string; mine: boolean; price: number }

/**
 * 鱼力全开·赌鱼铺（精工湖南岸的摊位）。
 * 押注和开赛都在服务器：这里只负责“把背包里的鱼列出来、把名次播成一段赛跑”。
 * 动画不是随机的——终点名次严格按服务器给的顺序，所以不会出现“动画第一、结算第三”。
 */
export class FishBetUi {
  private root = el('div', 'screen hidden');
  private body = el('div', 'bet-body');
  private msg = el('div', 'board-msg');
  private head = el('div', 'bet-title');
  private listBox = el('div', 'bet-list');
  private trackBox = el('div', 'bet-track-box');
  private inv: Record<string, number> = {};
  /** 名次顺序的泳道（跑到一半时用来画） */
  private lanes: Lane[] = [];
  private prize = 0;
  private busy = false;
  /** 冷却到什么时候（毫秒时间戳） */
  private until = 0;
  private timer = 0;
  private raf = 0;

  constructor(private net: NetClient) {
    const panel = el('div', 'box bet');
    const head = el('div', 'board-head');
    const close = el('button', 'btn', '✕'); close.type = 'button'; close.setAttribute('aria-label', '离开赌鱼铺');
    close.addEventListener('click', () => this.close());
    head.append(el('div', 'board-title', '🐟 鱼力全开'), close);
    const sub = el('div', 'create-sub', `押一条鱼，跟三条陪跑鱼比一场。赢了得「今日收购价 × ${oddsText('rare')} 左右」的币，输了这条鱼就归铺子了。`);
    panel.append(head, sub, this.head, this.msg, this.trackBox, this.listBox);
    this.root.append(panel);
    this.root.addEventListener('mousedown', (e) => { if (e.target === this.root) this.close(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.isOpen) this.close(); });
    (document.getElementById('hud') ?? document.body).append(this.root);

    // 故意不放进 ☰ 菜单：这是个"走到湖边才玩得了"的摊位，只从摊子前按 E 打开（服务器也会校验位置）

    // 背包变了就重画鱼单（chain：不能顶掉背包/商店已经挂好的回调）
    net.chain('inv', (items) => { this.inv = items; this.renderList(); });
    net.chain('fishBetResult', (m) => this.onResult(m));
  }

  get isOpen() { return !this.root.classList.contains('hidden'); }
  open() {
    this.root.classList.remove('hidden');
    this.msg.textContent = '挑一条鱼押上去（只有背包里的鱼能押）';
    this.msg.className = 'board-msg';
    this.net.getInv();
    this.renderList();
    // 切场景重开时可能残留上一局的动画
    if (!this.busy) this.trackBox.replaceChildren();
  }
  close() {
    this.root.classList.add('hidden');
    this.stopAnim();
  }
  toggle() { if (this.isOpen) this.close(); else this.open(); }

  /** 现在能不能押（服务器还会再判一次，这里只是别让玩家白点） */
  private get cooling() { return Date.now() < this.until; }

  private renderList() {
    this.listBox.replaceChildren();
    const rows = FISH.filter((f) => canBet(f.id) && (this.inv[f.id] ?? 0) > 0).map((f) => ({ f, n: this.inv[f.id] }));
    if (!rows.length) {
      this.listBox.append(el('div', 'bet-empty', '背包里还没有能押的鱼：先去湖里钓几条（杂物不收）。'));
      return;
    }
    // 稀有度高的排前面：那才是玩家想押的
    rows.sort((a, b) => (BET.ODDS[b.f.rarity] ?? 0) - (BET.ODDS[a.f.rarity] ?? 0));
    for (const { f, n } of rows) {
      const price = sellPrice(f.id, this.today());
      const prize = betPrize(price, f.rarity);
      const row = el('div', 'bet-row');
      const info = el('div', 'bet-info');
      const name = el('div', 'bet-name');
      name.append(el('span', `bet-rar r-${f.rarity}`, RARITY_CN[f.rarity]), document.createTextNode(` ${f.name} ×${n}`));
      info.append(name, el('div', 'bet-note', `今日收购价 ${price} · 赔率 ${oddsText(f.rarity)} · 赢了得 ${prize} 币`));
      const go = el('button', 'btn' + (this.cooling || this.busy ? '' : ' primary'), '押这条');
      go.type = 'button';
      go.disabled = this.cooling || this.busy;
      go.addEventListener('click', () => {
        this.busy = true; this.prize = 0;
        this.renderList();
        this.msg.className = 'board-msg';
        this.msg.textContent = '下注了：等老板把鱼倒进池子…';
        this.net.fishBet(f.id);
      });
      row.append(info, go);
      this.listBox.append(row);
    }
    if (this.cooling) this.listBox.append(el('div', 'bet-empty', `老板还在收拾鱼盆：${Math.ceil((this.until - Date.now()) / 1000)} 秒`));
  }

  /** 今日行情（和商店同一套算法：按日期编号 + 物种） */
  private today() { return Math.floor((Date.now() + 8 * 3600e3) / 86400e3); }

  private onResult(m: { ok: boolean; msg: string; lanes: Lane[]; rank: number; prize: number; wait: number }) {
    this.msg.className = 'board-msg' + (m.ok && m.prize > 0 ? '' : ' bad');
    this.msg.textContent = m.msg;
    if (!m.ok) {
      this.busy = false;
      if (m.wait > 0) { this.until = Date.now() + m.wait; this.tickCool(); }
      this.renderList();
      return;
    }
    this.until = Date.now() + m.wait;
    this.lanes = m.lanes;
    this.prize = m.prize;
    this.startAnim();
    this.tickCool();
  }

  /** 冷却是按秒显示的，这里每 400ms 刷一次按钮状态 */
  private tickCool() {
    clearInterval(this.timer);
    this.timer = window.setInterval(() => {
      if (!this.isOpen) { clearInterval(this.timer); return; }
      if (!this.cooling && !this.busy) { clearInterval(this.timer); this.renderList(); return; }
      this.renderList();
    }, 400) as unknown as number;
  }

  private stopAnim() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.busy = false;
  }

  /**
   * 赛跑动画：4 条泳道，按服务器给的名次倒排终点时间（第 1 名先到）。
   * 每条泳道叠一点正弦起伏，看起来像在真游；但最后一个像素一定落在服务器给的名次上。
   */
  private startAnim() {
    this.stopAnim();
    const wrap = el('div', 'bet-race');
    const DUR = 2600, GAP = 420;   // 第一名 2.6 秒到，之后每个名次晚 0.42 秒
    const markers: { box: HTMLElement; fish: HTMLElement; finish: number; phase: number }[] = [];
    this.lanes.forEach((lane, i) => {
      const row = el('div', 'bet-lane' + (lane.mine ? ' mine' : ''));
      const tag = el('span', `bet-rar r-${lane.rarity}`, RARITY_CN[lane.rarity as keyof typeof RARITY_CN] ?? '');
      const name = el('span', 'bet-lane-name', `${lane.name}${lane.mine ? '（你押的）' : ''}`);
      const track = el('div', 'bet-lane-track');
      const fish = el('i', 'bet-fish');
      const rank = el('span', 'bet-rank', '');
      track.append(fish);
      row.append(rank, name, tag, track);
      wrap.append(row);
      markers.push({ box: rank, fish, finish: DUR + i * GAP, phase: i * 1.7 });
    });
    this.trackBox.replaceChildren(wrap);
    const t0 = performance.now();
    const step = () => {
      const t = performance.now() - t0;
      let done = 0;
      markers.forEach((mk, i) => {
        const u = Math.min(1, t / mk.finish);
        // 前 88% 用它自己的速度推进，最后一段收口，保证刚好卡在终点
        const base = u < 0.88 ? (u / 0.88) * 0.9 : 0.9 + (u - 0.88) / 0.12 * 0.1;
        const wob = u >= 1 ? 0 : Math.sin(t / 130 + mk.phase) * 0.035 * (1 - u);
        const p = Math.max(0, Math.min(1, base + wob));
        // 别用裸的 100%：鱼标记本身有宽度，贴到 100% 就被 track 的 overflow 裁掉了（看起来像"鱼不见了"）
        mk.fish.style.left = `calc(${p * 100}% - ${p * 13}px)`;
        if (u >= 1) { done++; mk.box.textContent = `${i + 1}`; mk.box.classList.add('on'); }
      });
      if (done < markers.length && this.isOpen) this.raf = requestAnimationFrame(step);
      else {
        this.raf = 0;
        this.busy = false;
        this.finishAnim();
      }
    };
    this.raf = requestAnimationFrame(step);
  }

  private finishAnim() {
    const won = this.prize > 0;
    const line = el('div', 'bet-result' + (won ? ' win' : ''), won ? `🏆 赢了 ${this.prize} 校园币` : '这条鱼归铺子了');
    this.trackBox.append(line);
    this.renderList();
  }
}
