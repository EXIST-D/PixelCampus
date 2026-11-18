// @vitest-environment happy-dom
/** 玩家对战（PvP）和世界 BOSS 的「逃跑」：任何时候都能点（包括等对方 / 队友出招时），先确认；确认才离开，取消什么都不变。 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('@/audio/sfx', () => ({ sfx: vi.fn() }));
import type { NetClient } from '@/net/client';
import type { ServerMsg } from '@/shared/protocol';
import { PvpUi } from '@/ui/PvpUi';
import { BossUi } from '@/ui/BossUi';

type PvpSt = Extract<ServerMsg, { t: 'pvp_state' }>;
type BossSt = Extract<ServerMsg, { t: 'boss_state' }>;

class FakeNet {
  handlers: Record<string, ((...a: any[]) => void) | undefined> = {};
  selfUid = 1;
  pvpLeave = vi.fn(); pvpAct = vi.fn(); pvpReply = vi.fn();
  bossLeave = vi.fn(); bossAct = vi.fn(); bossReply = vi.fn();
}
const flush = async () => { await vi.runAllTimersAsync(); await Promise.resolve(); };
let net: FakeNet;
beforeEach(() => {
  vi.useFakeTimers(); document.body.replaceChildren();
  const hud = document.createElement('div'); hud.id = 'hud'; document.body.append(hud);
  net = new FakeNet();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const menuButtons = () => [...document.querySelectorAll('.bt-menu button')] as HTMLButtonElement[];
const byText = (t: string) => menuButtons().find((b) => b.textContent === t);

const side = (uid: number, name: string, hp = 30) => ({ uid, name, lead: 0, squad: [{ sp: 'o01', lv: 20, hp, max: 30 }] });
const pvp = (over: Partial<PvpSt> = {}): PvpSt => ({ t: 'pvp_state', bid: 'pv1', turn: 1, phase: 'choose', me: side(1, '我'), foe: side(2, '对手'), ev: [], ...over });

describe('PvP：逃跑', () => {
  it('主菜单里有「逃跑」；取消确认什么都不变，确认后告诉服务器离开（认输）并关掉界面', async () => {
    const ui = new PvpUi(net as unknown as NetClient);
    net.handlers.pvpState?.(pvp()); await flush();
    expect(ui.isOpen).toBe(true);
    const flee = byText('逃跑'); expect(flee).toBeTruthy();
    vi.stubGlobal('confirm', vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true));
    flee!.click();
    expect(net.pvpLeave).not.toHaveBeenCalled(); expect(ui.isOpen).toBe(true);
    byText('逃跑')!.click();
    expect(net.pvpLeave).toHaveBeenCalledTimes(1); expect(ui.isOpen).toBe(false);
  });
  it('战斗结束后只剩「离开」，没有「逃跑」', async () => {
    new PvpUi(net as unknown as NetClient);
    net.handlers.pvpState?.(pvp({ phase: 'over', result: { winner: 'a', reason: 'win' } })); await flush();
    expect(byText('逃跑')).toBeUndefined(); expect(byText('离开')).toBeTruthy();
  });
});

const boss = (me: Partial<BossSt['players'][number]> = {}, over: Partial<BossSt> = {}): BossSt => ({
  t: 'boss_state', bid: 'bs1', turn: 1, phase: 'choose', boss: { name: '精工湖·青鳞', sp: 'o09', lv: 30, hp: 500, max: 700, stage: 0 },
  players: [{ uid: 1, name: '我', lead: 0, down: false, ready: false, squad: [{ sp: 'o01', lv: 20, hp: 30, max: 30, mv: [{ id: '一般:p50', pp: 10 }] }], ...me }, { uid: 2, name: '队友', lead: 0, down: false, ready: false, squad: [{ sp: 'o01', lv: 20, hp: 30, max: 30 }] }],
  ev: [], ...over,
});

describe('世界 BOSS：逃跑', () => {
  it('主菜单里有「逃跑」；确认后告诉服务器离开（这场不再算你）并关掉界面；取消不变', async () => {
    const ui = new BossUi(net as unknown as NetClient);
    net.handlers.bossState?.(boss()); await flush();
    expect(ui.isOpen).toBe(true);
    vi.stubGlobal('confirm', vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true));
    byText('逃跑')!.click();
    expect(net.bossLeave).not.toHaveBeenCalled(); expect(ui.isOpen).toBe(true);
    byText('逃跑')!.click();
    expect(net.bossLeave).toHaveBeenCalledTimes(1); expect(ui.isOpen).toBe(false);
  });
  it('已经出招、在等队友时也能逃跑（以前这时候一个按钮都没有，只能干等）', async () => {
    new BossUi(net as unknown as NetClient);
    net.handlers.bossState?.(boss({ ready: true })); await flush();
    expect(document.querySelector('.bt-menu')?.textContent).toContain('等队友');
    expect(byText('逃跑')).toBeTruthy();
  });
  it('自己的精灵都倒下了：可以直接「离开」', async () => {
    new BossUi(net as unknown as NetClient);
    net.handlers.bossState?.(boss({ down: true })); await flush();
    expect(byText('离开')).toBeTruthy();
  });
});
