/**
 * 宿舍/家居家具（第二批）：沙发、茶几、电视、灯、地毯、挂钟、海报、绿植、鱼缸、壁炉、鞋架、衣帽架、洗衣机、猫窝…
 * 参照星露谷的家具目录分类，风格跟着 furniture.ts / furniture-dorm.ts 走：16px 格、统一色板、深色描边。
 *
 * 约定（和 furniture.ts 完全一致）：
 *   - 脚印 fw×fh（格），精灵宽度 = fw*16，精灵底边 = 脚印底边；
 *   - 精灵可以向上超出脚印（灯、衣帽架这类"高的"东西），超出的部分不占地；
 *   - fh = 0 表示墙面挂件（挂在北墙上，不占地面格，也不能旋转）；
 *   - flat = true 表示"平铺在地上、不挡路"（地毯）。
 */
import { Img, hex, type RGBA } from './px.ts';
import { PAL } from './palette.ts';
import type { Furn } from './furniture.ts';

const OUT = PAL.outline, W = PAL.wood, M = PAL.metal, L = PAL.leaf;
const f = (img: Img, fw: number, fh: number, extra: Partial<Furn> = {}): Furn => ({ img: img.outlined(OUT), fw, fh, ...extra });

const TEAL: RGBA[] = ['#245e5c', '#2f7a72', '#3f9690', '#5cb3a8', '#7fc9bd'].map((c) => hex(c)); // 青绿布艺
const WARM: RGBA[] = ['#a8483a', '#c25c44', '#d97a58', '#e89a78'].map((c) => hex(c));           // 暖橘布艺
const CREAM: RGBA[] = ['#cfc7b2', '#e4ddc9', '#f4efe0'].map((c) => hex(c));                     // 米白
const BRICK: RGBA[] = ['#7a3a30', '#97483a', '#b25a44'].map((c) => hex(c));
const GLASS: RGBA[] = ['#2c5486', '#3f73ab', '#5f98cc', '#8fc3ea'].map((c) => hex(c));
const GOLD = hex('#e0b44a');

/** 一块布面：底色 + 上沿高光 + 下沿暗边 + 两侧暗边 */
function cloth(img: Img, x: number, y: number, w: number, h: number, c: RGBA[], bottom = 1) {
  img.rect(x, y, w, h, c[2]);
  img.hline(x, y, w, c[3]);
  img.rect(x, y + h - bottom, w, bottom, c[1]);
  img.vline(x, y, h, c[1]);
  img.vline(x + w - 1, y, h, c[1]);
}

/* ────────────────────────── 坐具 ────────────────────────── */

/** 沙发（3×1 格）：靠背 + 两个坐垫 + 扶手，木脚 */
export function couch(): Furn {
  const img = new Img(48, 30);
  cloth(img, 2, 0, 44, 11, TEAL);                   // 靠背
  img.rect(3, 2, 42, 4, TEAL[3]);                   // 靠背受光面
  img.rect(2, 10, 44, 2, TEAL[0]);                  // 靠背与坐垫的分界
  cloth(img, 0, 8, 6, 19, TEAL);                    // 左扶手
  cloth(img, 42, 8, 6, 19, TEAL);                   // 右扶手
  img.hline(1, 8, 4, TEAL[4]); img.hline(43, 8, 4, TEAL[4]);
  cloth(img, 6, 12, 17, 12, TEAL, 2);               // 坐垫 1
  cloth(img, 25, 12, 17, 12, TEAL, 2);
  img.rect(6, 12, 17, 1, TEAL[4]); img.rect(25, 12, 17, 1, TEAL[4]);
  img.rect(23, 13, 2, 11, TEAL[0]);                 // 两块坐垫之间的缝
  img.rect(2, 25, 44, 3, TEAL[0]);                  // 座箱下沿
  img.rect(3, 27, 3, 3, W[1]); img.rect(42, 27, 3, 3, W[1]); // 木脚
  return f(img, 3, 1);
}

/** 单人扶手椅（1×1 格）：靠背略矮，两侧扶手是圆柱 */
export function armchair(): Furn {
  const img = new Img(16, 26);
  cloth(img, 3, 0, 10, 12, WARM);                   // 靠背
  img.rect(4, 1, 8, 3, WARM[3]);
  img.rect(1, 6, 3, 13, WARM[1]); img.hline(1, 6, 3, WARM[3]);   // 左扶手
  img.rect(12, 6, 3, 13, WARM[1]); img.hline(12, 6, 3, WARM[3]); // 右扶手
  cloth(img, 4, 11, 8, 9, WARM, 2);                 // 坐垫
  img.rect(4, 11, 8, 1, WARM[3]);
  img.rect(2, 19, 12, 3, WARM[0]);                  // 前缘
  img.rect(2, 21, 2, 3, W[1]); img.rect(12, 21, 2, 3, W[1]);
  return f(img, 1, 1);
}

/* ────────────────────────── 桌与箱柜 ────────────────────────── */

/** 茶几（2×1 格）：矮、台面薄、四条腿，上面放一本杂志和一只杯子 */
export function coffee(): Furn {
  const img = new Img(32, 22);
  img.rect(2, 12, 2, 8, W[1]); img.rect(28, 12, 2, 8, W[1]);   // 四条腿
  img.rect(2, 12, 1, 8, W[0]); img.rect(29, 12, 1, 8, W[0]);
  img.rect(3, 15, 26, 2, W[1]); img.hline(3, 15, 26, W[2]);    // 下层板
  img.rect(0, 8, 32, 4, W[2]);                                 // 台面
  img.rect(0, 8, 32, 1, W[4]);
  img.rect(1, 9, 30, 1, W[3]);
  img.rect(0, 11, 32, 1, W[0]);
  // 桌面杂物：杂志 + 杯子
  img.rect(4, 4, 9, 4, hex('#f4efe0')); img.rect(4, 4, 9, 1, hex('#c4503c'));
  img.rect(5, 6, 7, 1, hex('#b2b8c6'));
  img.rect(20, 4, 4, 4, CREAM[1]); img.rect(20, 4, 4, 1, CREAM[2]); img.rect(23, 6, 1, 2, CREAM[0]);
  img.rect(19, 8, 6, 1, CREAM[0]);
  return f(img, 2, 1);
}

/** 电视柜 + 电视（2×1 格）：柜体两门，屏幕上有一点冷光 */
export function tvset(): Furn {
  const img = new Img(32, 34);
  img.rect(3, 0, 26, 17, M[0]);                     // 机身
  img.rect(4, 1, 24, 14, M[1]);
  img.rect(5, 2, 22, 12, hex('#20303f'));           // 屏幕
  img.rect(6, 3, 20, 4, hex('#2f4b60'));
  img.rect(8, 4, 6, 2, hex('#7fc4d8'));             // 反光
  img.rect(14, 16, 4, 4, M[1]);                     // 支架
  img.rect(2, 19, 28, 11, W[1]);                    // 柜体
  img.rect(2, 19, 28, 3, W[3]); img.hline(2, 19, 28, W[4]);
  img.rect(4, 23, 11, 6, W[2]); img.rect(17, 23, 11, 6, W[2]);
  img.hline(8, 25, 3, M[3]); img.hline(21, 25, 3, M[3]); // 拉手
  return f(img, 2, 1);
}

/** 鞋架（1×1 格）：两层，摆两双鞋 */
export function shoe(): Furn {
  const img = new Img(16, 24);
  img.rect(0, 4, 16, 2, W[2]); img.rect(0, 13, 16, 2, W[2]);
  img.hline(0, 4, 16, W[3]); img.hline(0, 13, 16, W[3]);
  img.rect(0, 4, 2, 18, W[2]); img.rect(14, 4, 2, 18, W[2]);
  img.vline(1, 4, 18, W[3]);
  for (const x of [2, 9]) {                          // 上层：运动鞋
    img.rect(x, 8, 5, 3, hex('#e8e4da')); img.rect(x, 10, 5, 2, hex('#cfc7b2'));
    img.rect(x, 10, 5, 1, hex('#8b8890')); img.rect(x + 1, 8, 3, 2, hex('#3f73ab'));
  }
  for (const x of [2, 9]) {                          // 下层：布鞋
    img.rect(x, 17, 5, 3, WARM[1]); img.rect(x, 19, 5, 2, WARM[0]);
    img.rect(x + 1, 17, 3, 1, WARM[3]);
  }
  return f(img, 1, 1);
}

/** 洗衣机（1×1 格）：上面板 + 圆形玻璃门 */
export function washer(): Furn {
  const img = new Img(16, 24);
  img.rect(0, 2, 16, 22, PAL.white[2]);
  img.rect(0, 2, 16, 3, PAL.white[4]);
  img.hline(0, 4, 16, PAL.white[1]);
  img.rect(2, 6, 12, 4, PAL.white[3]);              // 控制面板
  img.rect(3, 7, 2, 2, hex('#c4503c')); img.rect(6, 7, 2, 2, hex('#3f9a58'));
  img.ellipse(8, 16, 4.5, 4.5, M[2]);               // 门框
  img.ellipse(8, 16, 3.5, 3.5, GLASS[1]);
  img.ellipse(7, 15, 1.5, 1.5, GLASS[3]);
  return f(img, 1, 1);
}

/* ────────────────────────── 灯 ────────────────────────── */

/** 落地灯（1×1 格）：梯形灯罩 + 细杆 + 圆盘底座 */
export function floorlamp(): Furn {
  const img = new Img(16, 36);
  for (let i = 0; i < 9; i++) {                      // 灯罩：上窄下宽
    const inset = Math.max(0, 4 - Math.floor(i * 0.45));
    img.rect(inset, 2 + i, 16 - inset * 2, 1, i < 7 ? CREAM[1] : CREAM[0]);
  }
  img.hline(4, 2, 8, CREAM[2]);
  for (let i = 0; i < 9; i++) { const inset = Math.max(0, 4 - Math.floor(i * 0.45)); img.set(inset, 2 + i, CREAM[0]); img.set(15 - inset, 2 + i, CREAM[0]); }
  img.rect(5, 4, 6, 5, PAL.lampGlow);                // 罩里的暖光
  img.rect(6, 4, 4, 3, hex('#fff6d0'));
  img.ellipse(8, 11.5, 5, 1.2, PAL.lampGlow);        // 罩下漏光
  img.rect(7, 12, 2, 19, M[1]);                      // 杆
  img.vline(7, 12, 19, M[3]);
  img.ellipse(8, 32, 5, 2, M[2]);                    // 底座
  img.ellipse(8, 31.5, 4, 1.2, M[3]);
  return f(img, 1, 1);
}

/** 台灯（摆桌面上的小件，不占地）：小梯形灯罩 + 底座 */
export function desklamp(): Furn {
  const img = new Img(11, 14);
  img.rect(3, 11, 5, 1, M[1]); img.ellipse(5, 11, 3, 1, M[2]);
  img.rect(5, 7, 1, 4, M[1]);
  for (let i = 0; i < 5; i++) { const inset = Math.max(0, 2 - Math.floor(i * 0.5)); img.rect(1 + inset, 2 + i, 9 - inset * 2, 1, CREAM[1]); }
  img.rect(2, 2, 7, 1, CREAM[2]);
  img.rect(3, 3, 5, 3, PAL.lampGlow);
  img.rect(4, 3, 3, 2, hex('#fff6d0'));
  return f(img, 1, 1);   // 桌面小件：top 标记在 HOME_INFO 里
}

/* ────────────────────────── 地毯（不挡路） ────────────────────────── */

/** 大地毯（3×2 格）：平铺在地上、不挡路。故意不加描边——加了就像挂了一幅画 */
export function rug(): Furn {
  const img = new Img(48, 32);
  img.rect(0, 0, 48, 32, WARM[2]);                   // 底色
  img.rect(0, 0, 48, 1, WARM[1]); img.rect(0, 31, 48, 1, WARM[1]);
  img.rect(0, 0, 1, 32, WARM[1]); img.rect(47, 0, 1, 32, WARM[1]);
  img.rect(2, 2, 44, 28, WARM[3]);                   // 内圈亮边
  img.rect(3, 3, 42, 26, WARM[2]);
  img.rect(3, 3, 42, 1, WARM[1]); img.rect(3, 28, 42, 1, WARM[1]);
  for (const cx of [13, 24, 35]) {                   // 三个菱形花纹
    for (let dy = -4; dy <= 4; dy++) {
      const w = 9 - Math.abs(dy) * 2;
      img.hline(cx - Math.floor(w / 2), 16 + dy, w, WARM[3]);
    }
    for (let dy = -2; dy <= 2; dy++) {
      const w = 5 - Math.abs(dy) * 2;
      img.hline(cx - Math.floor(w / 2), 16 + dy, w, WARM[1]);
    }
    img.rect(cx, 16, 1, 1, GOLD);
  }
  for (let y = 3; y < 30; y += 3) { img.rect(0, y, 1, 2, CREAM[1]); img.rect(47, y, 1, 2, CREAM[1]); } // 两端流苏
  return { img, fw: 3, fh: 2, flat: true };          // 不 outlined()
}

/* ────────────────────────── 墙上的 ────────────────────────── */

/** 挂钟（墙面挂件）：木框 + 表盘 + 指针 */
export function wallclock(): Furn {
  const img = new Img(16, 16);
  img.ellipse(7.5, 7.5, 7, 7, W[2]);
  img.ellipse(7.5, 7.5, 6, 6, CREAM[2]);
  img.ellipse(7.5, 7.5, 5, 5, hex('#fbf8ee'));
  img.rect(7, 3, 1, 5, OUT); img.rect(7, 7, 4, 1, OUT);  // 指针
  img.rect(7, 7, 1, 1, hex('#c4503c'));
  for (let a = 0; a < 12; a++) {                     // 刻度
    const ang = (a / 12) * Math.PI * 2, x = 7.5 + Math.cos(ang) * 4.2, y = 7.5 + Math.sin(ang) * 4.2;
    img.set(Math.round(x), Math.round(y), a % 3 === 0 ? OUT : W[2]);
  }
  return f(img, 1, 0);
}

/** 海报（墙面挂件）：竖排的风景小画 */
export function poster(): Furn {
  const img = new Img(14, 18);
  img.rect(0, 0, 14, 18, W[3]);
  img.rect(2, 2, 10, 14, hex('#f2e7c8'));
  img.rect(3, 3, 8, 7, hex('#8fc3ea'));              // 天
  img.rect(3, 8, 8, 4, hex('#52973f'));              // 地
  img.rect(3, 7, 8, 1, hex('#3f7a4f'));
  img.rect(5, 5, 3, 3, hex('#f6e05a'));              // 太阳
  img.rect(4, 12, 6, 1, hex('#7a5233'));
  img.rect(4, 14, 4, 1, hex('#7a5233'));
  return f(img, 1, 0);
}

/* ────────────────────────── 绿植 / 水族 ────────────────────────── */

/** 大盆栽（1×1 格）：陶盆 + 五片分开的叶子（每片单独压暗，避免糊成一团） */
export function potplant(): Furn {
  const img = new Img(16, 34);
  img.rect(4, 26, 8, 8, hex('#b06a44'));             // 陶盆
  img.rect(3, 26, 10, 2, hex('#c47c50'));
  img.rect(5, 33, 6, 1, hex('#93512f'));
  img.vline(4, 27, 6, hex('#93512f'));
  const leaf = (cx: number, cy: number, rx: number, ry: number) => {
    img.ellipse(cx, cy, rx, ry, L[1]);
    img.ellipse(cx - 0.5, cy - 0.6, rx - 0.8, ry - 0.8, L[2]);
    img.ellipse(cx - 1, cy - 1.2, rx - 2, ry - 2, L[3]);
  };
  leaf(8, 5, 4, 5);       // 顶
  leaf(4.5, 12, 3.6, 5);  // 左
  leaf(11.5, 12, 3.6, 5); // 右
  leaf(6.5, 19, 3.2, 4.5); // 左下
  leaf(9.5, 19, 3.2, 4.5); // 右下
  img.rect(7, 20, 1, 7, L[0]);                        // 主干
  img.rect(6, 24, 2, 2, L[1]);
  return f(img, 1, 1);
}

/** 桌面小盆栽（不占地） */
export function splant(): Furn {
  const img = new Img(9, 12);
  img.rect(2, 8, 5, 3, hex('#b06a44'));
  img.rect(1, 8, 7, 1, hex('#c47c50'));
  img.ellipse(4.5, 5, 3, 2.6, L[1]);
  img.ellipse(4, 4.4, 2.2, 1.9, L[2]);
  img.ellipse(3.6, 4, 1.2, 1, L[3]);
  img.ellipse(6.5, 6, 1.4, 1.2, L[2]);
  return f(img, 1, 1);   // 桌面小件，同上
}

/** 鱼缸（2×1 格）：玻璃缸 + 底砂 + 两条小鱼 + 水草，可以走近看 */
export function aquarium(): Furn {
  const img = new Img(32, 28);
  img.rect(1, 1, 30, 22, GLASS[1]);
  img.rect(2, 2, 28, 20, GLASS[2]);
  img.rect(3, 3, 26, 14, hex('#5fb6c8'));            // 水色
  img.rect(3, 17, 26, 5, hex('#c9b58a'));            // 底砂
  for (let x = 4; x < 28; x += 3) img.set(x, 17, hex('#e0cfa4'));
  img.rect(6, 11, 1, 6, L[2]); img.rect(7, 10, 1, 7, L[3]); img.rect(5, 12, 1, 5, L[1]); // 水草
  img.rect(24, 9, 4, 2, hex('#e0a53a')); img.rect(23, 9, 1, 2, hex('#f2c764'));           // 小鱼1
  img.rect(12, 14, 3, 2, hex('#c4503c')); img.rect(15, 14, 1, 1, hex('#c4503c'));         // 小鱼2
  img.hline(2, 2, 28, GLASS[3]);                     // 水面反光
  img.rect(0, 23, 32, 5, W[1]);                      // 木底座
  img.hline(0, 23, 32, W[3]);
  return f(img, 2, 1);
}

/* ────────────────────────── 其他 ────────────────────────── */

/** 壁炉（2×1 格）：砖砌炉体 + 柴火 + 三层火苗 */
export function fireplace(): Furn {
  const img = new Img(32, 40);
  img.rect(0, 0, 32, 4, hex('#8b8890'));             // 石台面
  img.hline(0, 0, 32, hex('#b9b5b3'));
  img.rect(0, 4, 32, 1, hex('#6a6670'));
  img.rect(2, 5, 28, 27, BRICK[1]);                  // 砖体
  for (let y = 5; y < 32; y += 4) img.hline(2, y, 28, BRICK[0]);
  for (let y = 6; y < 32; y += 8) { img.rect(10, y, 1, 4, BRICK[0]); img.rect(20, y, 1, 4, BRICK[0]); }
  img.rect(6, 11, 20, 21, hex('#241a19'));           // 炉膛
  img.rect(7, 12, 18, 19, hex('#33231f'));
  img.rect(11, 28, 10, 3, hex('#5a3a24')); img.rect(11, 28, 10, 1, hex('#7a5233')); // 柴火
  img.rect(13, 26, 8, 2, hex('#43291a'));
  img.rect(10, 24, 12, 4, hex('#c25c2a'));           // 火苗：底宽上窄
  img.rect(11, 21, 10, 4, hex('#e8923a'));
  img.rect(12, 18, 8, 4, hex('#f6d06a'));
  img.rect(14, 15, 4, 4, hex('#fff0b0'));
  img.rect(15, 12, 2, 4, hex('#fff0b0'));
  img.rect(4, 32, 24, 3, hex('#8b8890'));            // 炉前石板
  img.hline(4, 32, 24, hex('#b9b5b3'));
  return f(img, 2, 1);
}

/** 穿衣镜（1×1 格）：木框 + 斜向反光的镜面，底下两只小脚 */
export function mirror(): Furn {
  const img = new Img(16, 34);
  img.rect(3, 0, 10, 4, W[2]);                       // 顶部小拱
  img.ellipse(8, 3, 5, 2, W[2]);
  img.rect(2, 3, 12, 28, W[2]);                      // 外框
  img.vline(2, 3, 28, W[3]); img.vline(13, 3, 28, W[1]);
  img.rect(4, 5, 8, 24, GLASS[1]);                   // 镜面
  img.rect(5, 6, 6, 22, GLASS[2]);
  for (let i = 0; i < 2; i++) {                      // 两道斜向反光（柔一点，别像闪电）
    for (let y = 9 + i * 10; y < 17 + i * 10; y++) {
      const x = 6 + Math.floor((y - (9 + i * 10)) * 0.5);
      img.rect(x, y, 2, 1, hex('#a8d8ee'));
    }
  }
  img.rect(3, 29, 3, 3, W[1]); img.rect(10, 29, 3, 3, W[1]);   // 小脚
  return f(img, 1, 1);
}

/** 猫窝（1×1 格）：藤编圆垫 + 蜷着的小猫（头、两只耳朵、尾巴都看得见） */
export function catbed(): Furn {
  const img = new Img(16, 16);
  img.ellipse(8, 9, 7.5, 5.6, WARM[1]);              // 藤编外圈
  img.ellipse(8, 8.6, 6.8, 4.9, WARM[2]);
  img.ellipse(8, 9.6, 5.6, 3.6, CREAM[0]);           // 垫子
  img.ellipse(8, 10.2, 4.8, 2.8, CREAM[1]);
  // 猫身（深一点当轮廓，里面压亮）
  img.ellipse(7, 10, 3.4, 2.2, hex('#a8622f'));
  img.ellipse(7, 9.9, 2.8, 1.7, hex('#d08a4a'));
  // 头枕在右边，两只耳朵 + 一条闭着的眼
  img.ellipse(10.2, 7.6, 2.2, 2, hex('#a8622f'));
  img.ellipse(10.2, 7.5, 1.7, 1.5, hex('#e8a862'));
  img.rect(8, 5, 1, 2, hex('#a8622f')); img.rect(11, 5, 1, 2, hex('#a8622f'));
  img.rect(8, 5, 1, 1, hex('#e8a862')); img.rect(11, 5, 1, 1, hex('#e8a862'));
  img.hline(9, 8, 2, hex('#3b322c'));                // 闭着的眼
  img.set(11, 9, hex('#c08a86'));                    // 鼻尖
  // 尾巴绕着垫子边
  img.rect(2, 11, 1, 2, hex('#a8622f')); img.rect(3, 12, 3, 1, hex('#a8622f'));
  return f(img, 1, 1);
}

/* ────────────────────────── 目录 ────────────────────────── */

export const HOME_FURNITURE: Record<string, () => Furn> = {
  couch, armchair, coffee, tvset, shoe, washer,
  floorlamp, desklamp, rug,
  wallclock, poster,
  potplant, splant, aquarium,
  fireplace, mirror, catbed,
};

/** 中文名 + 分类（编辑器目录用；分类按星露谷那种"按用途"分） */
export const HOME_INFO: Record<string, { name: string; cat: string; top?: boolean }> = {
  couch: { name: '青绿沙发(3格)', cat: '坐具' },
  armchair: { name: '单人扶手椅', cat: '坐具' },
  coffee: { name: '木茶几', cat: '桌柜' },
  tvset: { name: '电视柜+电视', cat: '桌柜' },
  shoe: { name: '鞋架', cat: '桌柜' },
  washer: { name: '洗衣机', cat: '家电' },
  floorlamp: { name: '落地灯', cat: '灯具' },
  desklamp: { name: '台灯', cat: '灯具', top: true },
  rug: { name: '花纹地毯(3×2)', cat: '地毯' },
  wallclock: { name: '挂钟', cat: '墙面' },
  poster: { name: '风景海报', cat: '墙面' },
  potplant: { name: '大盆栽', cat: '绿植' },
  splant: { name: '小盆栽', cat: '绿植', top: true },
  aquarium: { name: '鱼缸', cat: '绿植' },
  fireplace: { name: '壁炉', cat: '其他' },
  mirror: { name: '穿衣镜', cat: '其他' },
  catbed: { name: '猫窝', cat: '其他' },
};
