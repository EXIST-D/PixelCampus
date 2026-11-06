import { describe, it, expect } from 'vitest';
import {
  FISH_TITLE_LADDER, RAINBOW_COLORS, TITLES, fishTitlesFor, titleDef,
} from '../src/shared/titles';
import { REAL_FISH } from '../src/shared/fishing';
import { PlayerStore } from '../server/store';
import { Progress } from '../server/progress';

const key = PlayerStore.key('title0001234567890abcd');

describe('称号：钓鱼等级与颜色', () => {
  it('钓鱼六级按图鉴种类解锁（1/5/10/18/24/27）', () => {
    expect(FISH_TITLE_LADDER.map((s) => s.species)).toEqual([1, 5, 10, 18, 24, 27]);
    expect(FISH_TITLE_LADDER[FISH_TITLE_LADDER.length - 1].species).toBe(REAL_FISH.length); // 最后一级正好是"集齐"
    expect(fishTitlesFor(0)).toEqual([]);
    expect(fishTitlesFor(1)).toEqual(['fish_rookie']);
    expect(fishTitlesFor(4)).toEqual(['fish_rookie']);
    expect(fishTitlesFor(5)).toEqual(['fish_rookie', 'angler']);
    expect(fishTitlesFor(17)).toEqual(['fish_rookie', 'angler', 'fish_ten']);
    expect(fishTitlesFor(24)).toEqual(['fish_rookie', 'angler', 'fish_ten', 'fish_deep', 'fish_scholar']);
    expect(fishTitlesFor(27)).toHaveLength(6);
    expect(fishTitlesFor(99)).toHaveLength(6);   // 超过也不会越界
    expect(fishTitlesFor(NaN)).toEqual([]);
  });

  it('六级称号都在目录里，名字不重复，且每级颜色都不一样', () => {
    const ids = FISH_TITLE_LADDER.map((s) => s.id);
    const defs = ids.map((id) => titleDef(id)!);
    expect(defs.every(Boolean)).toBe(true);
    expect(new Set(defs.map((t) => t.name)).size).toBe(6);
    expect(new Set(defs.map((t) => t.color)).size).toBe(6);
    // 一级一色：色相从头到尾都在往前走（绿→青→蓝→紫→橙），最后一级用彩虹
    expect(defs[5].rainbow).toBe(true);
    expect(defs.slice(0, 5).every((t) => !t.rainbow)).toBe(true);
  });

  it('全目录里每个称号的颜色都不同（不会两个称号撞色）', () => {
    const colors = TITLES.map((t) => t.color.toLowerCase());
    expect(new Set(colors).size).toBe(colors.length);
    // 彩虹只给"钓鱼大师"这一个
    expect(TITLES.filter((t) => t.rainbow).map((t) => t.id)).toEqual(['fish_master']);
    expect(RAINBOW_COLORS.length).toBeGreaterThanOrEqual(5);
  });

  it('登录时按图鉴补发：有多少种鱼就发到哪一级，重复调用不会重复发', () => {
    const store = new PlayerStore(null);
    const prog = new Progress(store, []);
    store.set(key, {
      profile: { v: 1, name: '钓鱼佬', gender: 'm', look: 0, college: '机电学院', major: '机械设计', year: 2024, motto: '', cardNo: '2025000001' } as never,
      seen: Date.now(), uid: 3,
    });
    // 造 10 种鱼的图鉴
    const fd: Record<string, { n: number; best: number; kg: number }> = {};
    for (const f of REAL_FISH.slice(0, 10)) fd[f.id] = { n: 1, best: 20, kg: 1 };
    store.get(key)!.fd = fd;

    expect(prog.species(key)).toBe(10);
    const got = prog.syncTitles(key, Date.now());
    expect(got.sort()).toEqual(['angler', 'fish_rookie', 'fish_ten']);
    expect(Object.keys(prog.titles(key).own).sort()).toEqual(['angler', 'fish_rookie', 'fish_ten']);
    // 第二次登录不会重复发（返回空）
    expect(prog.syncTitles(key, Date.now())).toEqual([]);
    // 又钓到 8 种新的 → 补到"深水行者"
    for (const f of REAL_FISH.slice(10, 18)) store.get(key)!.fd![f.id] = { n: 1, best: 20, kg: 1 };
    expect(prog.syncTitles(key, Date.now())).toEqual(['fish_deep']);
  });
});
