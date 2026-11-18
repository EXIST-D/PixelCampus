// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
vi.mock('@/audio/sfx', () => ({ sfx: vi.fn() }));

import type { NetClient } from '@/net/client';
import type { ServerMsg } from '@/shared/protocol';
import type { BEvent } from '@/shared/battle';
import type { Mon } from '@/shared/mons';
import { BattleUi } from '@/ui/BattleUi';

type Bt = Extract<ServerMsg, { t: 'mon_bt' }>;

class FakeNet {
  handlers: Record<string, ((...a: any[]) => void) | undefined> = {};
  monGo = vi.fn();
  monAct = vi.fn();
}

const mon = (): Mon => ({
  id: 'm1', sp: 'o01', lv: 20, xp: 0, hp: 30, iv: [0, 0, 0, 0, 0, 0],
  mv: [{ id: '火:p50', pp: 25 }, { id: '火:s50', pp: 25 }], at: 0,
});
const bt = (over: Partial<Bt> = {}): Bt => ({
  t: 'mon_bt', bid: 'b1', turn: 1, phase: 'choose', lead: 0, sq: [mon()],
  foe: { sp: 'o04', lv: 5, hp: 10, max: 20 }, ev: [], ball: 3, zone: '测试', ...over,
});
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const tick = async () => { await vi.runAllTimersAsync(); await flush(); };

let net: FakeNet;
let ui: BattleUi;
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  document.body.replaceChildren();
  const hud = document.createElement('div'); hud.id = 'hud'; document.body.append(hud);
  net = new FakeNet();
  ui = new BattleUi(net as unknown as NetClient);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const send = async (m: Bt) => { net.handlers.monBt?.(m); await tick(); };

describe('战斗界面 · 能力等级', () => {
  it('P9/N12：能力等级变化后卡片显示文字 + 方向，不只靠颜色', async () => {
    await send(bt());
    await send(bt({ turn: 2, ev: [{ t: 'stage', side: 'foe', k: 'atk', d: -2, v: -2 }] }));
    const foe = document.querySelector('.bt-card.foe')?.textContent ?? '';
    expect(foe).toContain('攻击');
    expect(foe).toContain('−2');
    expect(document.querySelectorAll('.bt-card.foe .bt-stage-tag.down').length).toBe(1);
  });

  it('P9：我方能力等级上升显示 +', async () => {
    await send(bt());
    await send(bt({ turn: 2, ev: [{ t: 'stage', side: 'me', k: 'def', d: 1, v: 1 }] }));
    const me = document.querySelector('.bt-card.me')?.textContent ?? '';
    expect(me).toContain('防御');
    expect(me).toContain('+1');
  });

  it('P10：日志写「提升了 / 降低了」', async () => {
    await send(bt());
    await send(bt({ turn: 2, ev: [{ t: 'stage', side: 'foe', k: 'def', d: -1, v: -1 }] }));
    const log = document.querySelector('.bt-log')?.textContent ?? '';
    expect(log).toContain('防御');
    expect(log).toMatch(/降低了|大幅降低了/);
  });

  it('训练家换上新精灵：新精灵是满血、没有上一只的能力等级 / 状态标签（以前血条停在 0、增益标签也带过来）', async () => {
    await send(bt({ foe: { sp: 'o04', lv: 5, hp: 10, max: 20 } }));
    // 第一只被打得「攻击 −2」，随后倒下，对手换上第二只（服务器给的是这只新精灵的满血状态）
    await send(bt({ turn: 2, ev: [{ t: 'stage', side: 'foe', k: 'atk', d: -2, v: -2 }, { t: 'status', side: 'foe', k: 'poison' }, { t: 'hit', side: 'foe', dmg: 10, hp: 0, mult: 1, crit: false }, { t: 'faint', side: 'foe' }, { t: 'foeswap', i: 1 }], foe: { sp: 'o04', lv: 7, hp: 28, max: 28 }, trainer: { id: 't1', name: '学长', squad: 2 } as never }));
    const foe = document.querySelector('.bt-card.foe')?.textContent ?? '';
    expect(foe).toContain('Lv.7');
    expect(foe).not.toContain('攻击');        // 没有上一只的能力等级
    expect(foe).not.toContain('中毒');        // 没有上一只的状态
    expect(document.querySelectorAll('.bt-card.foe .bt-stage-tag').length).toBe(0);
    expect(document.body.textContent ?? '').toContain('28/28');                 // 血条是新精灵的满血
  });

  it('没有能力等级时不显示这一行', async () => {
    await send(bt());
    expect(document.querySelectorAll('.bt-stages').length).toBe(0);
  });
});
