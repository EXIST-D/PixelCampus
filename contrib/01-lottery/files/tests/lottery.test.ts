import { describe, it, expect } from 'vitest';
import { LOTTERY_EV, LOTTERY_HIT_RATE, LOTTERY_PITY, LOTTERY_PRICE, LOTTERY_PRIZES, drawLottery, drawLotteryWithPity } from '../src/shared/lottery';

describe('校园彩票奖池', () => {
  it('权重加起来正好 10000（万分比）', () => {
    expect(LOTTERY_PRIZES.reduce((s, p) => s + p.w, 0)).toBe(10000);
  });
  it('长期是亏的：一张期望回报在 190~210 之间，低于售价 300', () => {
    expect(LOTTERY_EV).toBeGreaterThan(190);
    expect(LOTTERY_EV).toBeLessThan(210);
    expect(LOTTERY_EV).toBeLessThan(LOTTERY_PRICE);
  });
  it('中奖率 30%（三成有奖，七成白板）', () => {
    expect(Math.round(LOTTERY_HIT_RATE * 100)).toBe(30);
  });
  it('按权重开奖：rnd=0 出白板、rnd 取 0.9999 出头奖；一万次模拟大致对得上概率', () => {
    expect(drawLottery(() => 0).prize).toBe(0);
    expect(drawLottery(() => 0.9999).prize).toBe(20000);
    let wins = 0, total = 0;
    for (let i = 0; i < 10000; i++) { const p = drawLottery(() => (i * 7919 % 10000) / 10000); if (p.prize > 0) wins++; total += p.prize; }
    expect(wins).toBeGreaterThan(2500); expect(wins).toBeLessThan(3500);      // ≈30%
    expect(total / 10000).toBeGreaterThan(150); expect(total / 10000).toBeLessThan(250); // ≈199
  });
});

describe('保底：连续 5 张白板后第 6 张必给 200', () => {
  it('干到 5 张没中时，白板会被换成 200 保底，并清零计数', () => {
    const r = drawLotteryWithPity(LOTTERY_PITY, () => 0.69); // 这个随机数本来会出白板（<0.70）
    expect(r.prize.prize).toBe(200);
    expect(r.dry).toBe(0);
  });
  it('没到保底线还是照常出白板，计数 +1；中了就清零', () => {
    const a = drawLotteryWithPity(2, () => 0.69);
    expect(a.prize.prize).toBe(0); expect(a.dry).toBe(3);
    const b = drawLotteryWithPity(2, () => 0.75); // 7500 落在 200 币档
    expect(b.prize.prize).toBeGreaterThan(0); expect(b.dry).toBe(0);
  });
  it('加了保底，期望回报还是低于售价 300（长期仍然亏）', () => {
    let dry = 0, total = 0;
    for (let i = 0; i < 30000; i++) { const r = drawLotteryWithPity(dry, () => ((i * 7919) % 10000) / 10000); dry = r.dry; total += r.prize.prize; }
    const ev = total / 30000;
    expect(ev).toBeGreaterThanOrEqual(199);
    expect(ev).toBeLessThan(280);
    expect(ev).toBeLessThan(LOTTERY_PRICE);
  });
});
