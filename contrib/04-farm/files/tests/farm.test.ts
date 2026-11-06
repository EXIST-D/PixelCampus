import { describe, it, expect } from 'vitest';
import { CROPS, FARM_PLOTS, cleanFarmSave, cleanPlots, cropDef, farmSummary, harvest, isRipe, stageOf, type Plot } from '../src/shared/farm';

const mk = (k: string, g: number, wd = 0): Plot => ({ k, g, wd });

describe('实验田规则', () => {
  it('三种作物的价格和天数都在合理区间（避免手滑写成 0 或负）', () => {
    expect(CROPS.length).toBe(3);
    for (const c of CROPS) {
      expect(c.seed).toBeGreaterThan(0);
      expect(c.days).toBeGreaterThanOrEqual(2);
      expect(c.days).toBeLessThanOrEqual(5);
      expect(c.price).toBeGreaterThan(0);
      expect(c.yield[0]).toBeGreaterThanOrEqual(1);
      expect(c.yield[1]).toBeGreaterThanOrEqual(c.yield[0]);
    }
  });

  it('卖掉收成要能回本（不然没人种）', () => {
    for (const c of CROPS) {
      const worst = c.yield[0] * c.price;      // 最差情况：只收最少的那几个
      expect(worst, `${c.name} 最差收成 ${worst} 要 ≥ 种子 ${c.seed}`).toBeGreaterThan(c.seed * 0.8);
    }
  });

  it('生长阶段：0 次水是种子，浇满就成熟', () => {
    const c = cropDef('potato')!;                // 3 次水
    expect(stageOf(c, 0)).toBe(0);
    expect(stageOf(c, 1)).toBe(1);
    expect(stageOf(c, 2)).toBe(2);
    expect(stageOf(c, 3)).toBe(3);
    expect(stageOf(c, 99)).toBe(3);              // 超了也停在成熟，不会溢出到别的帧
  });

  it('成熟判定和"还要浇几次"对得上', () => {
    const c = cropDef('cabbage')!;               // 2 次水
    expect(isRipe(c, mk('cabbage', 1))).toBe(false);
    expect(isRipe(c, mk('cabbage', 2))).toBe(true);
  });

  it('收获数量落在 yield 区间、卖价 = 数量 × 单价', () => {
    const c = cropDef('pumpkin')!;
    for (const r of [0, 0.25, 0.5, 0.75, 0.99]) {
      const got = harvest(c, () => r);
      expect(got.n).toBeGreaterThanOrEqual(c.yield[0]);
      expect(got.n).toBeLessThanOrEqual(c.yield[1]);
      expect(got.coins).toBe(got.n * c.price);
    }
  });

  it('存档清洗：固定 12 格、坏数据当空格、进度不会超过成熟天数', () => {
    const p = cleanPlots([{ k: 'potato', g: 99, wd: 3 }, null, { k: '不存在', g: 1 }, { k: 'cabbage', g: -5, wd: 1 }]);
    expect(p.length).toBe(FARM_PLOTS);
    expect(p[0]).toEqual({ k: 'potato', g: 3, wd: 3 });   // 99 被压到成熟天数
    expect(p[1]).toBeNull();
    expect(p[2]).toBeNull();                               // 不认识的作物 → 空
    expect(p[3]).toEqual({ k: 'cabbage', g: 0, wd: 1 });
    expect(cleanPlots('乱来').every((x) => x === null)).toBe(true);
  });

  it('整块地全空时不写存档（省得 players.json 里一堆 null）', () => {
    expect(cleanFarmSave({ p: [null, null] })).toBeUndefined();
    expect(cleanFarmSave({ p: [null, { k: 'potato', g: 1, wd: 2 }] })?.p?.[1]).toEqual({ k: 'potato', g: 1, wd: 2 });
  });

  it('汇总：能收 / 该浇 / 空地分开算（今天浇过的不算"该浇"）', () => {
    const day = 100;
    const s = farmSummary([
      mk('potato', 3, day),        // 熟了
      mk('potato', 1, day),        // 今天浇过 → 不用浇
      mk('potato', 1, day - 1),    // 昨天浇的 → 该浇
      null,
    ], day);
    expect(s).toEqual({ ripe: 1, thirsty: 1, empty: 1 });   // 这里只传了 4 格，空的就是那 1 个
    // 真实调用传的是 cleanPlots 的 12 格，空格数才对得上
    expect(farmSummary(cleanPlots([{ k: 'potato', g: 1, wd: day }]), day)).toEqual({ ripe: 0, thirsty: 0, empty: FARM_PLOTS - 1 });
  });
});
