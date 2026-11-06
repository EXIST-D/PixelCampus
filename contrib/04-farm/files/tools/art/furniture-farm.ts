/**
 * 实验田里的东西：种植床（干/湿两种）、稻草人、水桶、工具架、木牌。
 * 风格跟 furniture-home.ts 一致：16px 格、统一色板、深色描边、精灵底边 = 占地底边。
 */
import { Img, hex } from './px.ts';
import { PAL } from './palette.ts';
import type { Furn } from './furniture.ts';

const OUT = PAL.outline, W = PAL.wood, L = PAL.leaf;
const f = (img: Img, fw: number, fh: number): Furn => ({ img: img.outlined(OUT), fw, fh });

/** 耕好的种植床（1×1）：深棕土 + 一道垄沟。干的时候土偏亮 */
export function plot(): Furn {
  const img = new Img(16, 16);
  img.rect(0, 0, 16, 16, hex('#5c4632'));
  img.rect(1, 1, 14, 14, hex('#6b5238'));
  // 两道横向垄沟
  for (const y of [4, 10]) {
    img.hline(1, y, 14, hex('#4a3626'));
    img.hline(1, y + 1, 14, hex('#2e2016'));
    img.hline(1, y - 1, 14, hex('#7d6144'));
  }
  // 土粒
  for (const [x, y] of [[3, 2], [11, 2], [6, 7], [13, 7], [4, 13], [9, 14]] as const) img.set(x, y, hex('#422f20'));
  return f(img, 1, 1);
}

/** 浇过水的种植床：颜色明显更深、带一点反光（一眼看出"今天浇过了"） */
export function plotWet(): Furn {
  const img = new Img(16, 16);
  img.rect(0, 0, 16, 16, hex('#3b2b1c'));
  img.rect(1, 1, 14, 14, hex('#463322'));
  for (const y of [4, 10]) {
    img.hline(1, y, 14, hex('#2a1d12'));
    img.hline(1, y + 1, 14, hex('#1d130b'));
    img.hline(1, y - 1, 14, hex('#5a4530'));
  }
  // 水光：斜着两点亮
  for (const [x, y] of [[4, 3], [5, 3], [9, 9], [10, 9], [12, 5]] as const) img.set(x, y, hex('#5f6f63'));
  return f(img, 1, 1);
}

/** 稻草人（1×1）：木十字架 + 稻草身子 + 草帽，占地上方多出一截 */
export function scarecrow(): Furn {
  const img = new Img(16, 32);
  img.rect(7, 12, 2, 18, W[2]);                    // 主杆
  img.vline(7, 12, 18, W[3]);
  img.rect(2, 14, 12, 2, W[2]);                    // 横杆
  img.rect(1, 13, 2, 3, W[3]); img.rect(13, 13, 2, 3, W[3]);
  // 稻草身子
  img.rect(4, 17, 8, 9, hex('#d8b45e'));
  img.rect(5, 17, 6, 8, hex('#e8c874'));
  for (let y = 18; y < 26; y += 2) { img.set(4, y, hex('#b8943c')); img.set(11, y, hex('#b8943c')); }
  img.rect(3, 25, 10, 2, hex('#b8943c'));          // 下摆的草
  // 布头
  img.ellipse(8, 10, 4.4, 3.6, hex('#e8e2d0'));
  img.set(6, 10, hex('#2a2a33')); img.set(10, 10, hex('#2a2a33'));
  img.hline(7, 12, 3, hex('#8a3a2a'));
  // 草帽
  img.ellipse(8, 6.4, 7, 1.8, hex('#c99a52'));
  img.rect(5, 2, 6, 5, hex('#d8ab5e'));
  img.hline(5, 2, 6, hex('#f0cc84'));
  img.rect(5, 5, 6, 1, hex('#a8402f'));
  return f(img, 1, 1);
}

/** 浇水用的木桶（1×1）：木箍 + 水面 */
export function waterButt(): Furn {
  const img = new Img(16, 22);
  img.ellipse(8, 20, 6.4, 1.8, [0, 0, 0, 0]);      // 占位（保证底边对齐，不画）
  img.rect(2, 8, 12, 13, W[2]);
  img.rect(3, 8, 10, 13, W[3]);
  for (const x of [3, 6, 9, 12]) img.vline(x, 8, 13, W[2]);
  for (const y of [10, 16]) { img.hline(2, y, 12, PAL.metal[2]); img.hline(2, y + 1, 12, PAL.metal[1]); }
  img.ellipse(8, 8, 6, 2.4, W[4]);                 // 桶口
  img.ellipse(8, 8, 5, 1.8, hex('#2f7a96'));       // 水面
  img.ellipse(6.5, 7.6, 1.8, 0.8, hex('#66b4c0'));
  return f(img, 1, 1);
}

/** 工具架（2×1）：横板 + 锄头、铲子 */
export function toolRack(): Furn {
  const img = new Img(32, 26);
  img.rect(2, 20, 28, 3, W[1]);                    // 落地脚
  img.rect(3, 4, 26, 2, W[2]);                     // 挂板
  img.rect(3, 4, 26, 1, W[4]);
  for (const x of [4, 27]) { img.rect(x, 4, 2, 17, W[2]); img.vline(x, 4, 17, W[3]); }
  // 锄头
  img.rect(8, 6, 1, 14, W[3]);
  img.rect(7, 5, 5, 2, PAL.metal[2]);
  // 铲子
  img.rect(16, 6, 1, 12, W[3]);
  img.ellipse(16.5, 20, 2, 2.4, PAL.metal[2]);
  // 水壶
  img.rect(21, 10, 6, 7, PAL.metal[2]);
  img.rect(22, 11, 4, 5, PAL.metal[3]);
  img.rect(20, 9, 2, 2, PAL.metal[1]);
  img.rect(26, 9, 3, 1, PAL.metal[1]);
  return f(img, 2, 1);
}

/** 门口的小木牌（挂在墙上，fh = 0）：牌面画三片叶子 */
export function farmSign(): Furn {
  const img = new Img(16, 12);
  img.rect(2, 1, 12, 9, hex('#dcb884'));
  img.hline(2, 1, 12, hex('#f2d6a8'));
  img.hline(2, 9, 12, W[1]);
  for (const [dx, c] of [[4, L[2]], [8, L[3]], [12, L[1]]] as const) {
    img.ellipse(dx, 4.5, 1.5, 1.2, c);
    img.set(dx, 6, L[0]);
  }
  return f(img, 1, 0);
}

/** 实验田里的全部家具（interiors.ts 和测试都从这里取，别在两处各写一份） */
export const FARM_FURNITURE = { plot, plotWet, scarecrow, waterButt, toolRack, farmSign };

/** 家具目录里的名字/分类（进 meta 用；种植床不卖，所以没有价格） */
export const FARM_INFO: Record<string, { name: string; cat: string }> = {
  plot: { name: '种植床', cat: '实验田' },
  plotWet: { name: '种植床(已浇水)', cat: '实验田' },
  scarecrow: { name: '稻草人', cat: '实验田' },
  waterButt: { name: '水桶', cat: '实验田' },
  toolRack: { name: '工具架', cat: '实验田' },
  farmSign: { name: '田牌', cat: '实验田' },
};
