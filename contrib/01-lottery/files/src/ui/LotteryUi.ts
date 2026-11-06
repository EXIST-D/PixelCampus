import { LOTTERY_MAX_BATCH, LOTTERY_PRICE, LOTTERY_PRIZES, LOTTERY_EV, LOTTERY_HIT_RATE } from '@/shared/lottery';
import type { NetClient } from '@/net/client';
import { ui } from './actions';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

/**
 * 校园彩票：买票在商店（300 币一张），这里负责"刮"和"看榜"。
 * 开奖全在服务器（客户端拿不到随机源），这里只显示结果和榜单。
 */
export class LotteryUi {
  private root = el('div', 'screen hidden');
  private body = el('div', 'lot-body');
  private msg = el('div', 'board-msg');
  private left = 0;
  private title = el('div', 'lot-title');
  private me = { n: 0, won: 0, best: 0, hits: 0 };
  /** 我在彩票总榜上的名次（0 = 没上榜） */
  private rank = 0;
  /** 亏钱榜（亏 = 票价×张数 − 中奖） */
  private loss: { uid: number; name: string; loss: number; n: number; won: number }[] = [];
  private myLoss = 0; private lossRank = 0;
  /** 赚钱榜（赚 = 中奖 − 票价×张数） */
  private gain: { uid: number; name: string; gain: number; n: number; won: number }[] = [];
  private myGain = 0; private gainRank = 0;

  constructor(private net: NetClient) {
    const panel = el('div', 'box lot');
    const head = el('div', 'board-head');
    const close = el('button', 'btn', '✕'); close.type = 'button'; close.setAttribute('aria-label', '关闭彩票');
    close.addEventListener('click', () => this.close());
    head.append(el('div', 'board-title', '🎟 校园彩票'), close);
    const sub = el('div', 'create-sub', `一张 ${LOTTERY_PRICE} 币 · 中奖率 ${Math.round(LOTTERY_HIT_RATE * 100)}% · 一张平均回 ${Math.round(LOTTERY_EV)} 币（长期是亏的，图个乐）`);
    const bar = el('div', 'lot-bar');
    const one = el('button', 'btn primary', '刮 1 张'); one.type = 'button'; one.addEventListener('click', () => this.draw(1));
    const ten = el('button', 'btn', `刮 ${LOTTERY_MAX_BATCH} 张`); ten.type = 'button'; ten.addEventListener('click', () => this.draw(LOTTERY_MAX_BATCH));
    const buy1 = el('button', 'btn', `买 1 张（${LOTTERY_PRICE} 币）`); buy1.type = 'button'; buy1.addEventListener('click', () => this.net.shopBuy('lottery', 1));
    const buy10 = el('button', 'btn', `买 ${LOTTERY_MAX_BATCH} 张（${LOTTERY_PRICE * LOTTERY_MAX_BATCH} 币）`); buy10.type = 'button'; buy10.addEventListener('click', () => this.net.shopBuy('lottery', LOTTERY_MAX_BATCH));
    const buy = buy1;
    bar.append(one, ten, buy1, buy10);
    panel.append(head, sub, this.title, bar, this.msg, this.body);
    this.root.append(panel);
    this.root.addEventListener('mousedown', (e) => { if (e.target === this.root) this.close(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.isOpen) this.close(); });
    (document.getElementById('hud') ?? document.body).append(this.root);

    ui.add({ id: 'lottery', label: '🎟 彩票', run: () => this.toggle() });

    const h = net.handlers;
    h.lotResult = (prizes, labels, total, left) => {
      this.left = left; this.msg.className = 'board-msg';
      this.msg.textContent = total > 0 ? `这次一共中了 ${total} 币` : '这次全是谢谢参与…再来一张？';
      const box = el('div', 'lot-res');
      prizes.forEach((pz, i) => box.append(el('div', `lot-card${pz > 0 ? ' win' : ''}${pz >= 3000 ? ' big' : ''}`, `${labels[i] ?? (pz > 0 ? `${pz} 币` : '谢谢参与')}`)));
      this.body.prepend(box);
      while (this.body.querySelectorAll('.lot-res').length > 5) this.body.querySelector('.lot-res:last-child')?.remove();
      this.net.lotBook();
      this.renderHeader();
    };
    // 服务端回的彩票榜：自己画两个榜（中奖榜 + 亏钱榜），再广播给名人堂（名人堂在听 pc:lotbook）
    net.chain('lotBook', (me, top, rank, extra) => {
      this.me = me; this.rank = rank ?? 0;
      this.loss = extra?.loss ?? []; this.myLoss = extra?.myLoss ?? 0; this.lossRank = extra?.lossRank ?? 0;
      this.gain = extra?.gain ?? []; this.myGain = extra?.myGain ?? 0; this.gainRank = extra?.gainRank ?? 0;
      this.renderBoard(top); this.renderHeader();
      window.dispatchEvent(new CustomEvent('pc:lotbook', { detail: { me, top, rank } }));
    });
    net.chain('inv', (items) => { this.left = items['lottery'] ?? 0; this.renderHeader(); }); // 买完/刮完立刻更新张数（链式：不覆盖背包/合成台）
  }
  get isOpen() { return !this.root.classList.contains('hidden'); }
  open() { this.root.classList.remove('hidden'); this.renderHeader(); this.net.lotBook(); }
  close() { this.root.classList.add('hidden'); }
  toggle() { if (this.isOpen) this.close(); else this.open(); }
  private draw(n: number) { this.net.lotDraw(n); }
  private renderHeader() {
    this.title.textContent = `手上还有 ${this.left} 张 · 刮过 ${this.me.n} 张 · 累计中 ${this.me.won} 币 · 单张最好 ${this.me.best} 币 · 中奖 ${this.me.hits} 次${this.rank ? ` · 榜上第 ${this.rank} 名` : ''}${this.myGain ? ` · 净赚 ${this.myGain}` : this.myLoss ? ` · 净亏 ${this.myLoss}` : ''}`;
  }
  private renderBoard(top: { uid: number; name: string; won: number; best: number; hits: number }[]) {
    const old = this.body.querySelector('.lot-board'); old?.remove();
    const box = el('div', 'lot-board');
    box.append(el('div', 'board-title', '🏆 彩票榜（累计中奖）'));
    if (!top.length) box.append(el('div', 'create-sub', '还没人上榜：第一个中奖的就是你'));
    top.forEach((r, i) => box.append(el('div', 'lot-row', `${i + 1}. ${r.name}　中 ${r.won} 币　单张最好 ${r.best}　中奖 ${r.hits} 次`)));
    box.append(el('div', 'create-sub', `奖金池：${LOTTERY_PRIZES.map((p) => `${p.prize || '空'}(${(p.w / 100).toFixed(2)}%)`).join(' · ')}`));
    this.body.append(box);

    // 赚钱榜：真的把票价赚回来的（中奖 − 买票）
    const gb = el('div', 'lot-board');
    gb.append(el('div', 'board-title', '💰 赚钱榜（中奖 − 买票）'));
    if (!this.gain.length) gb.append(el('div', 'create-sub', '还没人赚钱：目前全服都在亏，中一次大的就能上来'));
    this.gain.forEach((r, i) => gb.append(el('div', 'lot-row', `${i + 1}. ${r.name}　赚 ${r.gain} 币（刮 ${r.n} 张花 ${r.n * LOTTERY_PRICE}，中回 ${r.won}）`)));
    if (this.myGain) gb.append(el('div', 'create-sub', `我自己：赚 ${this.myGain} 币${this.gainRank ? ` · 赚钱榜第 ${this.gainRank} 名` : ''}`));
    this.body.append(gb);

    // 亏钱榜：图个乐，谁刮得最狠
    const lb = el('div', 'lot-board');
    lb.append(el('div', 'board-title', '💸 亏钱榜（买票 − 中奖）'));
    if (!this.loss.length) lb.append(el('div', 'create-sub', '还没人亏钱：要么一张没刮，要么刚好回本'));
    this.loss.forEach((r, i) => lb.append(el('div', 'lot-row', `${i + 1}. ${r.name}　亏 ${r.loss} 币（刮 ${r.n} 张，中回 ${r.won}）`)));
    if (this.myLoss) lb.append(el('div', 'create-sub', `我自己：亏 ${this.myLoss} 币${this.lossRank ? ` · 亏钱榜第 ${this.lossRank} 名` : ''}`));
    this.body.append(lb);
  }
}
