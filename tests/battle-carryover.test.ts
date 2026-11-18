/**
 * 2026-11 玩家反馈：「增益 / 减益会传给下一只吗？对面换了精灵，血条停在 0 还能打？」的回归测试。
 * 引擎侧：能力等级 / 状态按「精灵 id」记，倒下就清掉，对手换上来的是一只全新的精灵（满血、没有增益 / 减益）；
 * 以及这次一起改的：训练家 / PvP 里逃跑一定成功，PvP 换人事件按视角分发。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeContent, makeRng, maxHp, newMon, type Content, type ElementPack, type Species } from '@/shared/mons';
import { applyStatus, bumpStage, foeOf, startBattle, startTrainerBattle, stagesOf, statusOf, step, zeroStages } from '@/shared/battle';
import { fullSquad, pvpStep, startPvp, submit } from '@/shared/pvp';

const f = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const OPEN = JSON.parse(readFileSync(f('../data/mons/packs/open/elements.json'), 'utf8')) as ElementPack;
const sp = (id: string, spe: number): Species => ({ id, no: 1, name: id, types: ['一般'], base: [100, 100, 100, 100, 100, spe], catch: 0.3, learnset: [{ lv: 1, id: '一般:p50' }] });
const CT: Content = makeContent(OPEN, [sp('me', 200), sp('foe', 1)]); // 我方快、对手慢：我先手
const mon = (id: string, s: string, lv = 20) => newMon(CT, s, lv, () => 0.5, id, 0);

describe('对手换精灵：增益 / 减益 / 血量都不传给下一只', () => {
  it('训练家的第一只被打倒后，换上来的第二只是满血、没有能力等级和状态；第一只的记录被清掉', () => {
    const me = mon('m1', 'me'), f1 = mon('f1', 'foe'), f2 = mon('f2', 'foe');
    const b = startTrainerBattle('b', [f1, f2], [me]);
    bumpStage(b, f1, 'atk', 2); bumpStage(b, f1, 'def', -1); applyStatus(b, f1, 'poison', makeRng(1));
    expect(stagesOf(b, f1).atk).toBe(2); expect(statusOf(b, f1).length).toBe(1);
    f1.hp = 1;
    const r = step(CT, b, { t: 'move', i: 0 }, makeRng(3));
    expect(r.ok).toBe(true);
    expect(r.ev.some((e) => e.t === 'foeswap')).toBe(true);
    expect(foeOf(b)).toBe(f2);
    // 倒下的第一只：能力等级 / 状态都清了
    expect(b.stages.has('f1')).toBe(false); expect(b.status.has('f1')).toBe(false);
    // 第二只：满血、全 0、没有状态
    expect(f2.hp).toBe(maxHp(CT, f2));
    expect(stagesOf(b, f2)).toEqual(zeroStages()); expect(statusOf(b, f2)).toEqual([]);
  });

  it('对手刚倒下的这个回合里，已经倒下的精灵不会再出手（0 血不能打）', () => {
    const me = mon('m1', 'me'), f1 = mon('f1', 'foe'), f2 = mon('f2', 'foe');
    const b = startTrainerBattle('b', [f1, f2], [me]);
    f1.hp = 1;
    const r = step(CT, b, { t: 'move', i: 0 }, makeRng(5));
    const faintAt = r.ev.findIndex((e) => e.t === 'faint' && e.side === 'foe');
    expect(faintAt).toBeGreaterThanOrEqual(0);
    expect(r.ev.slice(faintAt).some((e) => e.t === 'use' && e.side === 'foe')).toBe(false); // 倒下之后没有对手出招
    expect(me.hp).toBe(maxHp(CT, me)); // 我方也没受伤
  });

  it('我方倒下的精灵：状态记录同样清掉；换上来的下一只自己没有增益', () => {
    const m1 = mon('m1', 'me', 5), m2 = mon('m2', 'me', 20), foe = mon('f1', 'foe', 40);
    const b = startBattle('b', foe, [m1, m2]);
    bumpStage(b, m1, 'atk', 3); applyStatus(b, m1, 'burn', makeRng(1));
    m1.hp = 1;
    // 对手 40 级，一下打倒 5 级的 m1（让对手先手：把对手速度调高不方便，直接多回合）
    for (let i = 0; i < 5 && m1.hp > 0; i++) step(CT, b, { t: 'move', i: 0 }, makeRng(i + 7));
    expect(m1.hp).toBe(0);
    expect(b.stages.has('m1')).toBe(false); expect(b.status.has('m1')).toBe(false);
    expect(stagesOf(b, m2)).toEqual(zeroStages()); // 下一只没有继承
  });
});

describe('逃跑', () => {
  it('训练家对战里逃跑一定成功（认输离开）：每个随机数都一样', () => {
    for (const roll of [0, 0.5, 0.999]) {
      const b = startTrainerBattle('b', [mon('f1', 'foe'), mon('f2', 'foe')], [mon('m1', 'me')]);
      const r = step(CT, b, { t: 'run' }, () => roll);
      expect(r.ok).toBe(true); expect(b.phase).toBe('over'); expect(b.result).toBe('fled');
    }
  });
  it('野生精灵战斗里逃跑仍然看运气（运气最差时逃不掉，对手还会出手）', () => {
    const b = startBattle('b', mon('w1', 'foe', 50), [mon('m1', 'me', 5)]);
    const r = step(CT, b, { t: 'run' }, () => 0.9999);
    expect(b.result).not.toBe('fled'); expect(r.ev.some((e) => e.t === 'stuck')).toBe(true); expect(r.ev.some((e) => e.t === 'escape')).toBe(false);
  });
  it('PvP：逃跑一定成功、对方判胜（不再按速度碰运气）', () => {
    for (const roll of [0, 0.999]) {
      const bb = startPvp('pv', { uid: 1, name: 'A', squad: fullSquad(CT, [mon('a1', 'me')]) }, { uid: 2, name: 'B', squad: fullSquad(CT, [mon('b1', 'foe')]) });
      submit(bb, 1, { t: 'run' }); submit(bb, 2, { t: 'move', i: 0 });
      const r = pvpStep(CT, bb, () => roll);
      expect(r.ok).toBe(true); expect(bb.phase).toBe('over'); expect(bb.result).toMatchObject({ winner: 'b', reason: 'fled' });
    }
  });
});

describe('PvP 换人事件按视角分发', () => {
  it('一方被打倒、自动换下一只：自己收到 swap（自己的下标），对方收到 foeswap；不会把对方的换人塞进自己的事件里', () => {
    const a = fullSquad(CT, [mon('a1', 'me'), mon('a2', 'me')]), b = fullSquad(CT, [mon('b1', 'foe'), mon('b2', 'foe')]);
    const bb = startPvp('pv', { uid: 1, name: 'A', squad: a }, { uid: 2, name: 'B', squad: b });
    bb.b.squad[0].hp = 1; // B 的第一只一下就倒（A 速度快先手）
    submit(bb, 1, { t: 'move', i: 0 }); submit(bb, 2, { t: 'move', i: 0 });
    const r = pvpStep(CT, bb, makeRng(2));
    expect(r.ok).toBe(true);
    expect(bb.b.lead).toBe(1);
    expect(r.b.some((e) => e.t === 'swap' && e.i === 1)).toBe(true);   // B 自己：换上了第 1 只
    expect(r.a.some((e) => e.t === 'foeswap' && e.i === 1)).toBe(true); // A 看到：对手派出了第 1 只
    expect(r.a.some((e) => e.t === 'swap')).toBe(false);                // A 自己没换人，不该有 swap
    expect(bb.stages.has('b1')).toBe(false); expect(bb.status.has('b1')).toBe(false);
  });
});
