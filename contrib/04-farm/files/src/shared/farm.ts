/**
 * 实验田：作物表、生长判定、收获结算。
 *
 * 核心规则（刻意做得"不会劝退"）：
 *   - 每次浇水 → 生长进度 +1；同一天只能浇一次（wd 记着最后浇水那一天）。
 *   - 不浇水只是"那天不长"，**永不枯死、永不倒退**。星露谷那种一觉醒来全枯，
 *     放在这种"一天 24 分钟、可能三天不上线"的网页游戏里就是把人赶走。
 *   - 成熟后停在"可收"，不会长老、不会烂。
 *   - 播种时直接扣种子的钱（不搞"种子进背包"，少一层物品系统，点一下就种下去）。
 *
 * 生长进度 g 的单位是"浇过几次水"，不是真实天数——这样完全不用做跨日结算，
 * 也不会因为凌晨 6 点那一刻服务端不在线就算错。
 */

export interface CropDef {
  k: string;
  name: string;
  /** 一格的种子价（校园币） */
  seed: number;
  /** 从播种到能收，要浇几次水 */
  days: number;
  /** 收获数量范围（含两端） */
  yield: [number, number];
  /** 每个卖多少 */
  price: number;
  /** 美术在图集里的前缀（crops 图集：`<art>@<0..3>`） */
  art: string;
  note: string;
}

export const CROPS: readonly CropDef[] = [
  { k: 'cabbage', name: '小白菜', seed: 20, days: 2, yield: [1, 2], price: 35, art: 'cabbage', note: '快，两天就能收，适合先练手' },
  { k: 'potato', name: '土豆', seed: 45, days: 3, yield: [2, 3], price: 60, art: 'potato', note: '稳，三天一收，性价比最高' },
  { k: 'pumpkin', name: '南瓜', seed: 90, days: 4, yield: [1, 2], price: 200, art: 'pumpkin', note: '慢，四天，但一个顶一堆' },
];

export const FARM_PLOTS = 12;

export const cropDef = (k: string): CropDef | undefined => CROPS.find((c) => c.k === k);

/** 一格地：k = 作物，g = 已经浇过几次水，wd = 最后一次浇水是第几个游戏日 */
export interface Plot { k: string; g: number; wd: number }
export type Plots = (Plot | null)[];

/** 生长阶段（0 种子 / 1 幼苗 / 2 长大 / 3 成熟）→ crops 图集的帧号 */
export function stageOf(c: CropDef, g: number): 0 | 1 | 2 | 3 {
  if (g <= 0) return 0;
  if (g >= c.days) return 3;
  return g / c.days < 0.4 ? 1 : 2;
}

export const isRipe = (c: CropDef, p: Plot): boolean => p.g >= c.days;

/** 收获：数量在 yield 区间里随机，卖价 = 数量 × 单价 */
export function harvest(c: CropDef, rnd: () => number): { n: number; coins: number } {
  const [lo, hi] = c.yield;
  const n = lo + Math.min(hi - lo, Math.floor(rnd() * (hi - lo + 1)));
  return { n, coins: n * c.price };
}

/** 把存档里读回来的地块洗干净：长度固定 12，非法条目当空格 */
export function cleanPlots(v: unknown): Plots {
  const out: Plots = Array.from({ length: FARM_PLOTS }, () => null);
  if (!Array.isArray(v)) return out;
  for (let i = 0; i < Math.min(FARM_PLOTS, v.length); i++) {
    const o = v[i];
    if (!o || typeof o !== 'object') continue;
    const r = o as Record<string, unknown>;
    const c = cropDef(String(r.k ?? ''));
    if (!c) continue;
    const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0);
    out[i] = { k: c.k, g: Math.min(c.days, num(r.g)), wd: num(r.wd) };
  }
  return out;
}

/** 有几格能收了 / 有几格今天还没浇水（给上线提醒用） */
export function farmSummary(plots: Plots, day: number) {
  let ripe = 0, thirsty = 0, empty = 0;
  for (const p of plots) {
    if (!p) { empty++; continue; }
    const c = cropDef(p.k);
    if (!c) { empty++; continue; }
    if (isRipe(c, p)) ripe++;
    else if (p.wd !== day) thirsty++;
  }
  return { ripe, thirsty, empty };
}

/** 存档里的农场：只存地块（12 格），没有别的状态 */
export interface FarmSave { p?: (Plot | null)[] }

export function cleanFarmSave(v: unknown): FarmSave | undefined {
  const plots = cleanPlots((v as FarmSave | undefined)?.p);
  return plots.some(Boolean) ? { p: plots } : undefined;
}
