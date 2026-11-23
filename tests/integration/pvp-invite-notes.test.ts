// @vitest-environment happy-dom
/** 对战邀请的提示：邀请方点「对战」后屏幕上要有东西（等待条 / 被拒 / 超时 / 不能对战的原因），对战开始后收起；邀请弹窗不和野生遭遇提示叠在一起。 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('@/audio/sfx', () => ({ sfx: vi.fn() }));
import type { NetClient } from '@/net/client';
import type { ServerMsg } from '@/shared/protocol';
import { PvpUi } from '@/ui/PvpUi';

type PvpSt = Extract<ServerMsg, { t: 'pvp_state' }>;
class FakeNet {
  handlers: Record<string, ((...a: any[]) => void) | undefined> = {};
  status = 'online'; pvpInvite = vi.fn(); pvpReply = vi.fn(); pvpLeave = vi.fn(); pvpAct = vi.fn();
}
let net: FakeNet;
beforeEach(() => { vi.useFakeTimers(); document.body.replaceChildren(); const hud = document.createElement('div'); hud.id = 'hud'; document.body.append(hud); net = new FakeNet(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const bar = () => document.querySelector('.pvp-wait') as HTMLElement;
const shown = () => !bar().classList.contains('hidden');
const side = (uid: number, name: string) => ({ uid, name, lead: 0, squad: [{ sp: 'o01', lv: 20, hp: 30, max: 30 }] });
const state = (): PvpSt => ({ t: 'pvp_state', bid: 'pv1', turn: 1, phase: 'choose', me: side(1, '我'), foe: side(2, '对手'), ev: [] });

describe('PvP 邀请提示', () => {
  it('点「对战」：立刻发邀请并显示「正在发出」；服务器回「已发出」就换成等待条（带倒计时）', () => {
    const ui = new PvpUi(net as unknown as NetClient); ui.invite(7);
    expect(net.pvpInvite).toHaveBeenCalledWith(7); expect(shown()).toBe(true); expect(bar().textContent).toContain('正在发出');
    net.handlers.pvpNote?.({ t: 'pvp_note', ok: true, msg: '已向 乙 发出对战邀请，等 TA 回应（30 秒内）', end: false });
    expect(bar().textContent).toContain('等 TA 回应'); expect(bar().querySelector('.mon-enc-timer')).toBeTruthy(); expect(bar().classList.contains('bad')).toBe(false);
    vi.advanceTimersByTime(60000); expect(shown()).toBe(true); // 等待条一直留着，等服务器的结果
  });

  it('被拒 / 超时 / 不能对战：显示原因（红色），几秒后自己收起', () => {
    const ui = new PvpUi(net as unknown as NetClient); ui.invite(7);
    net.handlers.pvpNote?.({ t: 'pvp_note', ok: false, msg: '离 乙 太远了，走近一点再邀请（要在 37 格以内）', end: true });
    expect(shown()).toBe(true); expect(bar().textContent).toContain('太远'); expect(bar().classList.contains('bad')).toBe(true);
    vi.advanceTimersByTime(6100); expect(shown()).toBe(false);
  });

  it('服务器 5 秒没回应：也要说一声，不让玩家对着空屏幕', () => {
    const ui = new PvpUi(net as unknown as NetClient); ui.invite(7);
    vi.advanceTimersByTime(5100); expect(bar().textContent).toContain('没有收到服务器的回应');
  });

  it('没联网 / 已经在对战中：不发邀请，直接说明', () => {
    const ui = new PvpUi(net as unknown as NetClient);
    net.status = 'offline'; ui.invite(7); expect(net.pvpInvite).not.toHaveBeenCalled(); expect(bar().textContent).toContain('连上服务器');
    net.status = 'online'; net.handlers.pvpState?.(state()); ui.invite(7); expect(net.pvpInvite).not.toHaveBeenCalled(); expect(bar().textContent).toContain('正在对战');
  });

  it('对战开始（服务器说「开始了」或对战状态到了）：等待条和邀请弹窗都收起', async () => {
    const ui = new PvpUi(net as unknown as NetClient); ui.invite(7);
    net.handlers.pvpNote?.({ t: 'pvp_note', ok: true, msg: '已发出', end: false }); expect(shown()).toBe(true);
    net.handlers.pvpNote?.({ t: 'pvp_note', ok: true, msg: '和 乙 的对战开始了', end: true }); expect(shown()).toBe(false);
    net.handlers.pvpInvite?.({ t: 'pvp_invite', uid: 2, name: '甲', ms: 30000 });
    const prompt = document.querySelector('.mon-enc.pvp-top:not(.pvp-wait)') as HTMLElement; expect(prompt.classList.contains('hidden')).toBe(false);
    net.handlers.pvpState?.(state()); await vi.runAllTimersAsync();
    expect(prompt.classList.contains('hidden')).toBe(true); expect(ui.isOpen).toBe(true);
  });

  it('邀请弹窗和等待条都带 pvp-top（比野生遭遇提示低一截），不会叠在一起', () => {
    new PvpUi(net as unknown as NetClient);
    expect(document.querySelectorAll('.mon-enc.pvp-top').length).toBe(2);
  });
});
