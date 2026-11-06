/**
 * 校园彩票（客户端与服务器共用）：奖池、价格、开奖。
 *
 * 设计原则（主人的要求）：**玩家整体是亏的，但偶尔大赚，让人忍不住再买一张**。
 *  - 单价 300 校园币；
 *  - 每张的期望回报约 199 币（≈ 66%），也就是长期下来玩家净亏约 1/3；
 *  - 中奖率 30%（三张里差不多一张有奖），头奖 20000 币概率 0.3%（约 1/333）；
 *  - 大头奖（≥3000）会在公屏广播，看到别人中奖是最强的"再来一张"动力。
 *
 * 概率都写成"万分比"（权重加起来 10000），改数值不用改逻辑；服务器用 crypto.randomInt 开奖，客户端拿不到任何随机源。
 */
export const LOTTERY_PRICE = 300;
export const LOTTERY_MAX_BATCH = 10;      // 一次最多刮 10 张（防连点）
export const LOTTERY_BIG_WIN = 3000;      // 中到多少以上要在公屏广播
export const LOTTERY_TICKET = 'lottery';  // 物品 id（背包里的一张票）
/** 保底：连续这么多张都没中，下一张必给 200（"再差也差不到哪去"，最容易让人接着刮） */
export const LOTTERY_PITY = 5;
export const LOTTERY_PITY_PRIZE = 200;

export interface LotteryPrize { prize: number; w: number; label: string }
/** 权重是万分比，加起来必须 = 10000（tests/lottery.test.ts 会检查） */
export const LOTTERY_PRIZES: readonly LotteryPrize[] = [
  { prize: 0, w: 7000, label: '谢谢参与' },
  { prize: 200, w: 1600, label: '200 校园币' },
  { prize: 400, w: 900, label: '400 校园币' },
  { prize: 1000, w: 350, label: '1000 校园币' },
  { prize: 3000, w: 120, label: '3000 校园币 🎉' },
  { prize: 20000, w: 30, label: '20000 校园币 🏆头奖' },
];

/** 一张票的期望回报（校园币）。写在这里是给测试和主人看账的，不参与开奖 */
export const LOTTERY_EV = LOTTERY_PRIZES.reduce((s, p) => s + p.prize * p.w, 0) / 10000;
/** 中奖概率（0..1） */
export const LOTTERY_HIT_RATE = LOTTERY_PRIZES.filter((p) => p.prize > 0).reduce((s, p) => s + p.w, 0) / 10000;

/** 开一张：rnd 返回 [0,1)（服务器传 crypto.randomInt(10000) / 10000） */
export function drawLottery(rnd: () => number): LotteryPrize {
  let r = Math.floor(rnd() * 10000);
  if (!Number.isFinite(r) || r < 0) r = 0;
  if (r >= 10000) r = 9999;
  for (const p of LOTTERY_PRIZES) { if (r < p.w) return p; r -= p.w; }
  return LOTTERY_PRIZES[0];
}

/**
 * 带保底的开奖（状态由服务器保存：dry = 连续几张没中）。
 * 连续 LOTTERY_PITY 张白板后，这一张如果还是白板，就换成 LOTTERY_PITY_PRIZE。
 */
export function drawLotteryWithPity(dry: number, rnd: () => number): { prize: LotteryPrize; dry: number } {
  const base = drawLottery(rnd);
  if (base.prize === 0 && dry >= LOTTERY_PITY) return { prize: { prize: LOTTERY_PITY_PRIZE, w: 0, label: `${LOTTERY_PITY_PRIZE} 校园币（保底）` }, dry: 0 };
  return { prize: base, dry: base.prize > 0 ? 0 : dry + 1 };
}
