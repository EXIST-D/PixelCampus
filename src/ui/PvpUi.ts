import type { NetClient } from '@/net/client';
import type { ServerMsg } from '@/shared/protocol';
import type { BEvent } from '@/shared/battle';
import { CONTENT, monArt, speciesOf } from '@/shared/mons-content';
import { learnLogText, moveView, stageBadges, stageLog, hpText } from './monBattleHelpers';
import { elementName, maxHp, type Mon, type StatusKind } from '@/shared/mons';
import { sfx } from '@/audio/sfx';

/** 邀请有效期（和服务器 server/pvp.ts 的 PVP.INVITE_MS 一致）：等待条的倒计时用 */
const PVP_WAIT_MS = 30000;

type PvpInvite = Extract<ServerMsg, { t: 'pvp_invite' }>;
type PvpState = Extract<ServerMsg, { t: 'pvp_state' }>;
type PvpEnd = Extract<ServerMsg, { t: 'pvp_end' }>;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const COLOR = new Map(CONTENT.elements.elements.map((e) => [e.id, e.color]));
const badge = (id: string) => { const b = el('span', 'mon-type', elementName(CONTENT.elements, id)); b.style.background = COLOR.get(id) ?? '#aaa'; return b; };
const nameOf = (m: { sp: string; nick?: string } | undefined) => m?.nick || (m ? speciesOf(m.sp)?.name ?? m.sp : '未知精灵');
const bar = (frac: number) => { const b = el('div', 'mon-bar hp'), f = el('div', 'mon-bar-fill'); f.style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`; if (frac < 0.25) f.style.background = '#c0392b'; else if (frac < 0.5) f.style.background = '#e0a020'; else f.style.background = '#6aa84f'; b.append(f); return b; };

/**
 * PvP 界面：邀请条 + 对战全屏。
 * 所有结算在服务器：这里只发行动，按 `pvp_state.ev` 播放，播完对齐权威状态。
 */
export class PvpUi {
  private root = el('div', 'screen battle hidden');
  private prompt = el('div', 'mon-enc pvp-top hidden');
  /** 邀请方的状态条：「已发出邀请，等 TA 回应」→ 被拒 / 超时 / 不能对战的原因（以前这些只发到精灵面板里，邀请方屏幕上什么都看不到） */
  private wait = el('div', 'mon-enc pvp-top pvp-wait hidden');
  private waitTimer = 0;
  private foeCard = el('div', 'bt-card foe');
  private meCard = el('div', 'bt-card me');
  private foeImg = el('img', 'bt-img foe');
  private meImg = el('img', 'bt-img me');
  private log = el('div', 'bt-log');
  private menu = el('div', 'bt-menu');
  private st: PvpState | null = null;
  private busy = false;
  /** 已经提交这一回合（服务器要等对方，期间界面上显示「等对方」） */
  private submitted = false;
  private mode: 'main' | 'moves' | 'swap' = 'main';
  private promptTimer = 0;
  /** 战斗开始时调用（收起其它面板） */
  onOpen: (() => void) | null = null;
  /** 战斗结束（离开）后调用 */
  onClose: (() => void) | null = null;

  constructor(private net: NetClient) {
    const stage = el('div', 'bt-stage'); stage.append(this.foeCard, this.foeImg, this.meImg, this.meCard);
    const panel = el('div', 'box bt'); panel.append(stage, this.log, this.menu);
    this.root.append(panel);
    (document.getElementById('hud') ?? document.body).append(this.root, this.prompt, this.wait);
    for (const i of [this.foeImg, this.meImg]) { i.draggable = false; i.alt = ''; }
    net.handlers.pvpInvite = (m) => this.onInvite(m);
    net.handlers.pvpNote = (m) => this.onNote(m);
    net.handlers.pvpState = (m) => void this.onState(m);
    net.handlers.pvpEnd = (m) => this.onEnd(m);
  }

  get isOpen() { return !this.root.classList.contains('hidden'); }

  // ------------------------------------------------------------ 邀请
  /** 点「对战」：发邀请；发不出去 / 已经在对战就当场说明原因 */
  invite(uid: number) {
    if (this.net.status !== 'online') { this.showNote(false, '要连上服务器才能对战（单机模式没有玩家对战）', 4000); return; }
    if (this.isOpen) { this.showNote(false, '你正在对战中', 3000); return; }
    this.net.pvpInvite(uid);
    this.showNote(true, '正在发出对战邀请……', 0); // 服务器的回话一到就换成正式的提示；5 秒没回应也要说一声
    window.clearTimeout(this.waitTimer);
    this.waitTimer = window.setTimeout(() => this.showNote(false, '没有收到服务器的回应，请稍后再试', 4000), 5000);
  }
  private onNote(m: { ok: boolean; msg: string; end?: boolean }) {
    window.clearTimeout(this.waitTimer);
    if (m.ok && m.end !== false) { this.hideNote(); return; } // 对战开始了：战斗界面会接手
    this.showNote(m.ok, m.msg, m.ok ? 0 : 6000, m.ok ? PVP_WAIT_MS : 0);
    if (!m.ok) sfx('notify');
  }
  /** ms = 多久后自动收起（0 = 一直留着，等下一条）；timerMs = 画一根倒计时条 */
  private showNote(ok: boolean, text: string, ms: number, timerMs = 0) {
    window.clearTimeout(this.waitTimer);
    const t = el('div', 'mon-sub', text);
    this.wait.replaceChildren(el('div', 'mon-enc-row', ''));
    (this.wait.firstChild as HTMLElement).append(el('span', 'pvp-wait-ico', ok ? '⚔️' : '⚠️'), t);
    if (timerMs > 0) { const bar = el('div', 'mon-enc-timer'); bar.style.animationDuration = `${timerMs}ms`; this.wait.append(bar); }
    this.wait.classList.toggle('bad', !ok); this.wait.classList.remove('hidden');
    if (ms > 0) this.waitTimer = window.setTimeout(() => this.hideNote(), ms);
  }
  private hideNote() { window.clearTimeout(this.waitTimer); this.wait.classList.add('hidden'); }

  private onInvite(m: PvpInvite) {
    sfx('notify');
    this.prompt.replaceChildren();
    const text = el('div', 'mon-enc-text');
    text.append(el('div', 'mon-name', '对战邀请'), el('div', 'mon-sub', `${m.name} 想和你切磋一下！`));
    const yes = el('button', 'btn primary', '接受'); yes.type = 'button'; yes.addEventListener('click', () => { this.net.pvpReply(m.uid, true); this.hidePrompt(); });
    const no = el('button', 'btn', '拒绝'); no.type = 'button'; no.addEventListener('click', () => { this.net.pvpReply(m.uid, false); this.hidePrompt(); });
    const t = el('div', 'mon-enc-timer'); t.style.animationDuration = `${m.ms}ms`;
    const row = el('div', 'mon-enc-row'); row.append(text, yes, no);
    this.prompt.append(row, t); this.prompt.classList.remove('hidden');
    window.clearTimeout(this.promptTimer); this.promptTimer = window.setTimeout(() => this.hidePrompt(), m.ms);
  }
  private hidePrompt() { window.clearTimeout(this.promptTimer); this.prompt.classList.add('hidden'); }

  // ------------------------------------------------------------ 战斗
  private async onState(m: PvpState) {
    const fresh = !this.st || this.st.bid !== m.bid;
    if (fresh) {
      this.st = m; this.busy = false; this.submitted = false; this.mode = 'main';
      this.hideNote(); this.hidePrompt();
      this.root.classList.remove('hidden'); this.onOpen?.();
      this.log.replaceChildren();
      this.say(`和 ${m.foe.name} 的对战开始了！`);
      this.renderStage(); this.renderMenu();
      return;
    }
    this.busy = true; this.renderMenu();
    await this.play(m);
    this.st = m; this.busy = false; this.submitted = false; this.mode = 'main';
    this.renderStage(); this.renderMenu();
  }

  private onEnd(m: PvpEnd) {
    this.say(m.result === 'win' ? '对战胜利！' : m.result === 'lose' ? '对战失败……' : m.result === 'fled' ? '你离开了对战。' : '对战超时了。');
    if (m.msg) this.say(m.msg);
    // 对战已经结束：把界面切成 over，否则「战斗 / 换精灵 / 逃跑」还留在上面，点了只会被服务器拒绝
    this.busy = false; this.submitted = false;
    if (this.st) this.st = { ...this.st, phase: 'over' };
    this.renderMenu();
  }

  private say(text: string) { this.log.append(el('div', undefined, text)); this.log.scrollTop = this.log.scrollHeight; }

  private async play(m: PvpState) {
    for (const e of m.ev as BEvent[]) {
      switch (e.t) {
        case 'use': this.say(`${e.side === 'me' ? nameOf(this.me(m)) : m.foe.name} 使用了${CONTENT.moves.get(e.move)?.name ?? e.move}！`); await sleep(300); break;
        case 'miss': this.say('没有打中！'); await sleep(300); break;
        case 'hit': this.renderStage(); await sleep(320); break;
        case 'faint': this.say(`${e.side === 'me' ? nameOf(this.me(m)) : nameOf(this.foeMon(m))} 倒下了！`); await sleep(500); break;
        case 'swap': this.say(`${e.i === 0 ? '' : ''}${nameOf(m.me.squad[e.i] as unknown as Mon)} 上场了！`); this.renderStage(); await sleep(400); break;
        case 'foeswap': this.say(`${m.foe.name} 派出了 ${nameOf(m.foe.squad[e.i] as unknown as Mon)}！`); this.renderStage(); await sleep(400); break;
        case 'blocked': this.say(`${e.side === 'me' ? '你' : m.foe.name} 无法行动！`); await sleep(350); break;
        case 'stage': this.say(stageLog(e.side === 'me' ? '你' : m.foe.name, e.k, e.d)); this.renderStage(); await sleep(300); break;
        case 'status': this.say(`${e.side === 'me' ? '你' : m.foe.name} 陷入了异常状态！`); this.renderStage(); await sleep(300); break;
        case 'statusdmg': this.renderStage(); await sleep(300); break;
        case 'statusend': this.say('状态解除了。'); await sleep(300); break;
        case 'heal': this.say(`回复了 ${e.gain} 点生命`); this.renderStage(); await sleep(300); break;
        case 'guard': this.say(`${e.side === 'me' ? '你' : m.foe.name} 守住了！`); await sleep(300); break;
        case 'guardfail': this.say('保护失败了……'); await sleep(300); break;
        case 'escape': this.say('成功逃走了！'); await sleep(350); break;
        case 'stuck': this.say('没能逃掉！'); await sleep(300); break;
        case 'learn': this.say(learnLogText(nameOf(this.me(m)), CONTENT.moves.get(e.move)?.name ?? e.move, e.full)); await sleep(400); break;
        default: break;
      }
    }
  }

  private me(m = this.st) { return m ? (m.me.squad[m.me.lead] as unknown as Mon) : undefined; }
  private foeMon(m = this.st) { return m ? (m.foe.squad[m.foe.lead] as unknown as Mon) : undefined; }

  private renderStage() {
    const m = this.st; if (!m) return;
    const meSp = speciesOf(m.me.squad[m.me.lead]?.sp ?? ''), foeSp = speciesOf(m.foe.squad[m.foe.lead]?.sp ?? '');
    const meS = m.me.squad[m.me.lead], foeS = m.foe.squad[m.foe.lead];
    if (foeS) {
      this.foeImg.src = monArt(foeS.sp, 'front', !!foeS.sh);
      const types = el('div', 'mon-types'); types.append(...(foeSp?.types ?? []).map(badge));
      this.foeCard.replaceChildren(el('div', 'mon-name', `${m.foe.name} 的 ${foeSp?.name ?? foeS.sp}  Lv.${foeS.lv}`), bar(foeS.hp / Math.max(1, foeS.max)), el('div', 'mon-sub', hpText(foeS.hp, foeS.max)), types);
      this.renderStages(this.foeCard, m.foe.stages, m.foe.status);
    }
    if (meS) {
      this.meImg.src = monArt(meS.sp, 'back', !!meS.sh);
      const max = meS.max, types = el('div', 'mon-types'); types.append(...(meSp?.types ?? []).map(badge));
      this.meCard.replaceChildren(el('div', 'mon-name', `${nameOf(this.me(m))}  Lv.${meS.lv}`), bar(meS.hp / Math.max(1, max)), el('div', 'mon-sub', hpText(meS.hp, max)), types);
      this.renderStages(this.meCard, m.me.stages, m.me.status);
    }
  }

  private renderStages(card: HTMLElement, s: Record<string, number> | undefined, status: string[] | undefined) {
    const list = stageBadges(s as Record<string, number> | undefined);
    if (!list.length && !status?.length) return;
    const box = el('div', 'bt-stages');
    for (const k of status ?? []) box.append(el('span', `bt-status ${k}`, ({ sleep: '睡眠', freeze: '冰冻', poison: '中毒', burn: '灼伤', paralysis: '麻痹' } as Record<string, string>)[k] ?? k));
    for (const t of list) box.append(el('span', 'bt-stage-tag' + (t.includes('+') ? ' up' : ' down'), t));
    card.append(box);
  }

  private btn(label: string, run: () => void, cls = 'btn') { const b = el('button', cls, label); b.type = 'button'; b.addEventListener('click', run); b.disabled = this.busy; return b; }
  private act(a: { t: 'move'; i: number } | { t: 'swap'; i: number } | { t: 'run' }) {
    if (!this.st || this.busy || this.submitted) return;
    this.busy = true; this.submitted = true; this.renderMenu();
    this.net.pvpAct(this.st.bid, this.st.turn, a);
    // 服务器要等双方都出招才会回 state：先显示「等对方」；8 秒还没动静就放开按钮，免得卡死
    window.setTimeout(() => { if (this.busy && this.isOpen) { this.busy = false; this.submitted = false; this.renderMenu(); } }, 8000);
  }

  private renderMenu() {
    this.menu.replaceChildren();
    const m = this.st; if (!m) return;
    if (m.phase === 'over') { this.menu.append(this.btn('离开', () => this.close(), 'btn primary')); return; }
    // 已经出招、在等对方：明确写一句，别只把按钮灰掉（玩家会以为技能用不了）
    if (this.submitted || this.busy) { this.menu.append(el('div', 'mon-sub', '这一回合已经出招，等对方……'), this.btn('逃跑', () => this.flee())); return; }
    if (this.mode === 'main') {
      this.menu.append(
        this.btn('战斗', () => { this.mode = 'moves'; this.renderMenu(); }, 'btn primary'),
        this.btn('换精灵', () => { this.mode = 'swap'; this.renderMenu(); }),
        this.btn('逃跑', () => this.flee()),
      );
      const swap = this.menu.children[1] as HTMLButtonElement;
      swap.disabled = this.busy || m.me.squad.filter((x, i) => i !== m.me.lead && x.hp > 0).length === 0;
    } else if (this.mode === 'moves') {
      const me = this.me(m); if (!me) return;
      const foeTypes = speciesOf(this.foeMon(m)?.sp ?? '')?.types ?? [];
      me.mv.forEach((x, i) => {
        const d = CONTENT.moves.get(x.id); if (!d) return;
        const v = moveView(CONTENT, d, x.pp, foeTypes);
        const b = el('button', 'btn bt-move'); b.type = 'button';
        b.append(badge(d.type), el('span', 'mon-mname', v.name), el('span', 'bt-mmeta', `${v.cat} 威力${v.power || '—'} 命中${v.acc}%  PP ${v.pp}/${v.maxPp}`));
        if (v.desc) b.append(el('span', 'bt-mmove-desc', v.desc));
        if (v.effect) b.append(el('span', 'bt-eff', v.effect));
        b.disabled = this.busy || (x.pp <= 0 && me.mv.some((y) => y.pp > 0));
        b.addEventListener('click', () => this.act({ t: 'move', i }));
        this.menu.append(b);
      });
      this.menu.append(this.btn('返回', () => { this.mode = 'main'; this.renderMenu(); }));
    } else {
      m.me.squad.forEach((x, i) => {
        const b = this.btn(`${nameOf(x as unknown as Mon)} Lv.${x.lv}  ${x.hp}/${x.max}`, () => this.act({ t: 'swap', i }), 'btn bt-move');
        b.disabled = this.busy || x.hp <= 0 || i === m.me.lead; this.menu.append(b);
      });
      this.menu.append(this.btn('返回', () => { this.mode = 'main'; this.renderMenu(); }));
    }
  }

  /** 逃跑 = 认输离开：一定成功，对方判胜（等对方出招的时候也能点）；先问一句，别误点 */
  private flee() {
    if (!window.confirm('逃跑算认输，对方判胜。确定要离开这场对战吗？')) return;
    this.close();
  }

  close() {
    this.root.classList.add('hidden');
    this.st = null; this.busy = false; this.submitted = false;
    this.net.pvpLeave();
    this.onClose?.();
  }
}
