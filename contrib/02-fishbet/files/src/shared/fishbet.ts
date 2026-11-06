/**
 * 鱼力全开·赌鱼铺（客户端与服务器共用）——精工湖南岸的摊位，押一条鱼跟三条陪跑鱼比赛。
 *
 * 规则：
 *  - 押注物就是你背包里的**一条鱼**（杂物不能押）。押出去就从背包扣掉：赢了拿币，输了鱼归铺子。
 *  - 一共 4 条泳道：你的鱼 + 服务器抽的 3 条陪跑鱼（尽量挑同稀有度的，场面才公平）。
 *  - 每条鱼掷一个"泳速分" = 基础泳速（看稀有度）× 0.88~1.12 的随机，分最高的那条赢。
 *    所以稀有的鱼**更容易赢**，但赔率更低——押小鱼是搏高倍，押大鱼是求稳。
 *  - 只有第 1 名有奖：奖金 = 这条鱼的今日收购价 × 赔率，取整。
 *    各档的期望都压在 0.87 左右（庄家抽 13%），别指望靠这个发财。
 *
 * 随机数由服务器提供（这里全是纯函数，方便测试）；客户端的赛跑动画只按服务器给的名次播放。
 */
import { FISH, fishDef, type Rarity } from './fishing';

/** 能押的稀有度：杂物（破靴子、水草…）不值钱，不收 */
export const BET_RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const BET = {
  /** 一局几条泳道（1 条自己的 + 3 条陪跑的） */
  LANES: 4,
  /** 两局之间至少隔这么久（服务器判定，防连点刷屏） */
  COOLDOWN_MS: 6000,
  /**
   * 赔率：赢了得「今日收购价 × 赔率」。
   * 这几个数是按模拟出来的胜率倒推的（陪跑鱼取相邻档，30 万局）：
   *   常见 13.7% → ×6.4 ｜ 少见 22.7% → ×3.8 ｜ 稀有 24.2% → ×3.6 ｜ 史诗 23.6% → ×3.7 ｜ 传说 39.7% → ×2.2
   * 各档期望都落在 0.87 左右（庄家抽 13%）。改赔率或改泳速，记得重跑 tests/fishbet.test.ts 里的期望检查。
   */
  ODDS: { common: 6.4, uncommon: 3.8, rare: 3.6, epic: 3.7, legendary: 2.2 } as Record<Rarity, number>,
  /** 基础泳速：稀有的鱼天生快一点（陪跑鱼是全池随机抽的，所以押贵的鱼确实更容易赢） */
  SPEED: { common: 1, uncommon: 1.06, rare: 1.12, epic: 1.18, legendary: 1.26 } as Record<Rarity, number>,
  /** 一条鱼泳速的随机范围（上下浮动） */
  JITTER: 0.12,
  /** 单笔奖金达到这个数就上公屏（不写死数值，按鱼的档次算） */
  BROADCAST_PRIZE: 800,
} as const;

/** 今天这条鱼押中能赢多少（不含大小月行情以外的东西：和卖价同一套算法） */
export function betPrize(price: number, rarity: Rarity): number {
  if (!BET_RARITIES.includes(rarity)) return 0;
  return Math.max(1, Math.round(price * (BET.ODDS[rarity] ?? 1)));
}

/** 这条鱼能不能押（背包里有、且不是杂物） */
export function canBet(id: string): boolean {
  const d = fishDef(id);
  return !!d && BET_RARITIES.includes(d.rarity);
}

/** 能押的鱼（按稀有度从低到高、再按名字排；面板里直接照这个顺序列） */
export function bettableFish(): { id: string; name: string; rarity: Rarity }[] {
  return FISH.filter((f) => BET_RARITIES.includes(f.rarity)).map((f) => ({ id: f.id, name: f.name, rarity: f.rarity }));
}

export interface RaceEntry { id: string; rarity: Rarity }

/**
 * 赛跑判定（纯函数）：按每条鱼掷一个泳速分，返回从第 1 名到最后的 id 顺序。
 * rnd 必须是服务器那边的随机源；客户端不要用它，只用服务器给的结果。
 */
export function raceOrder(entries: readonly RaceEntry[], rnd: () => number): string[] {
  const scored = entries.map((e, i) => {
    const base = BET.SPEED[e.rarity] ?? 1;
    const j = 1 - BET.JITTER + rnd() * BET.JITTER * 2; // 0.88 ~ 1.12
    // 同一分时按原始顺序（稳定排序的兜底，虽然概率极低）
    return { id: e.id, score: base * j, i };
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.map((s) => s.id);
}

/**
 * 抽 3 条陪跑鱼：从**你这条鱼上下各一档**里随机抓（不抽自己）。
 * 押传说鱼 → 陪跑的至少是史诗，赢面大；押常见鱼 → 陪跑的是常见/少见，赢面小但赔率高。
 * 只取相邻档是刻意的：要是全池随机，押常见鱼几乎必输（一池子传说鱼压着你），玩起来就没意思了。
 */
export function pickRivals(betId: string, betRarity: Rarity, rnd: () => number): { id: string; rarity: Rarity }[] {
  const at = BET_RARITIES.indexOf(betRarity);
  const lo = Math.max(0, at - 1), hi = Math.min(BET_RARITIES.length - 1, at + 1);
  const band = BET_RARITIES.slice(lo, hi + 1);
  const pool = FISH.filter((f) => band.includes(f.rarity) && f.id !== betId);
  const out: { id: string; rarity: Rarity }[] = [];
  while (out.length < BET.LANES - 1 && pool.length) {
    const i = Math.min(pool.length - 1, Math.floor(rnd() * pool.length));
    const [pick] = pool.splice(i, 1);
    out.push({ id: pick.id, rarity: pick.rarity });
  }
  return out;
}

/** 赔率文本（面板里显示成「×3.8」） */
export const oddsText = (rarity: Rarity): string => `×${(BET.ODDS[rarity] ?? 0).toFixed(1)}`;

/** 稀有度的中文（面板里标在鱼名后面） */
export const RARITY_CN: Record<Rarity, string> = { common: '常见', uncommon: '少见', rare: '稀有', epic: '史诗', legendary: '传说', junk: '杂物' };
