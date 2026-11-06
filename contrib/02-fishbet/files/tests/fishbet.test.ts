import { describe, it, expect } from 'vitest';
import { FISH } from '../src/shared/fishing';
import { BET, BET_RARITIES, betPrize, bettableFish, canBet, oddsText, pickRivals, raceOrder, RARITY_CN } from '../src/shared/fishbet';

/** 固定种子的线性同余随机（测试要可复现） */
const rngOf = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

describe('赌鱼规则', () => {
  it('杂物不能押，正常鱼都能押', () => {
    expect(canBet('fish_crucian')).toBe(true);
    expect(canBet('boot')).toBe(false);        // 破靴子（杂物）
    expect(canBet('不存在的鱼')).toBe(false);
    expect(bettableFish().length).toBe(FISH.filter((f) => BET_RARITIES.includes(f.rarity)).length);
    expect(bettableFish().every((f) => canBet(f.id))).toBe(true);
  });

  it('奖金 = 今日收购价 × 赔率，取整且至少 1', () => {
    expect(betPrize(45, 'rare')).toBe(Math.round(45 * BET.ODDS.rare));
    expect(betPrize(6, 'common')).toBe(Math.round(6 * BET.ODDS.common));
    expect(betPrize(0, 'rare')).toBe(1);
    expect(betPrize(100, 'junk')).toBe(0);      // 杂物没赔率
    expect(oddsText('legendary')).toBe('×2.2');
    expect(RARITY_CN.epic).toBe('史诗');
  });

  it('赛跑：4 条泳道、名次不重复、不丢鱼，分数高的在前', () => {
    const rnd = rngOf(7);
    const lanes = [
      { id: 'fish_crucian', rarity: 'common' as const },
      { id: 'fish_carp', rarity: 'common' as const },
      { id: 'fish_bream', rarity: 'uncommon' as const },
      { id: 'fish_goldfish', rarity: 'rare' as const },
    ];
    const order = raceOrder(lanes, rnd);
    expect(order).toHaveLength(4);
    expect(new Set(order).size).toBe(4);
    expect([...order].sort()).toEqual([...lanes.map((l) => l.id)].sort());
    // 同样的种子必须给同样的结果（服务器结算、回放都靠这个）
    expect(raceOrder(lanes, rngOf(7))).toEqual(order);
  });

  it('陪跑鱼：3 条、不重复、不含自己、只在上下各一档里挑', () => {
    const rnd = rngOf(11);
    for (const r of BET_RARITIES) {
      const mine = FISH.find((f) => f.rarity === r)!;
      const at = BET_RARITIES.indexOf(r);
      const band = new Set(BET_RARITIES.slice(Math.max(0, at - 1), Math.min(BET_RARITIES.length, at + 2)));
      for (let i = 0; i < 50; i++) {
        const rivals = pickRivals(mine.id, r, rnd);
        expect(rivals).toHaveLength(BET.LANES - 1);
        expect(new Set(rivals.map((x) => x.id)).size).toBe(rivals.length);
        expect(rivals.some((x) => x.id === mine.id)).toBe(false);
        expect(rivals.every((x) => band.has(x.rarity))).toBe(true);
      }
    }
  });

  /**
   * 这张表是"庄家优势"的护栏：任何一档的期望都不能 ≥ 1（不然玩家只押那一档就能无限刷币），
   * 也不能低于 0.7（太黑心，玩家玩两把就不来了）。
   */
  it('各档期望值都在 0.70 ~ 1.00 之间（庄家优势 0~30%）', () => {
    const rnd = rngOf(20261106);
    const N = 60000;
    for (const r of BET_RARITIES) {
      const mine = FISH.find((f) => f.rarity === r)!;
      let win = 0;
      for (let i = 0; i < N; i++) {
        const lanes = [{ id: mine.id, rarity: r }, ...pickRivals(mine.id, r, rnd)];
        if (raceOrder(lanes, rnd)[0] === mine.id) win++;
      }
      const p = win / N, ev = p * BET.ODDS[r];
      expect(ev, `${r} 期望 ${ev.toFixed(3)}`).toBeGreaterThan(0.7);
      expect(ev, `${r} 期望 ${ev.toFixed(3)}`).toBeLessThan(1);
    }
  });

  it('越贵的鱼赢面越大（陪跑鱼在相邻档，档位越高相对越强）', () => {
    const rnd = rngOf(99);
    const N = 40000;
    const winRate = (r: (typeof BET_RARITIES)[number]) => {
      const mine = FISH.find((f) => f.rarity === r)!;
      let w = 0;
      for (let i = 0; i < N; i++) {
        const lanes = [{ id: mine.id, rarity: r }, ...pickRivals(mine.id, r, rnd)];
        if (raceOrder(lanes, rnd)[0] === mine.id) w++;
      }
      return w / N;
    };
    // 常见鱼要和少见鱼赛、传说鱼只和史诗/传说赛 —— 后者赢面明显更高
    expect(winRate('legendary')).toBeGreaterThan(winRate('common') * 1.5);
  });
});
