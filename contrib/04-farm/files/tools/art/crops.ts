/**
 * 作物美术：3 种作物 × 4 个生长阶段，每张 16×16，脚点在底部正中（8,15）。
 *
 * 约定：
 *   key = `${作物id}@${阶段}`，阶段 0 刚播种（只看得见土里冒头）、1 幼苗、2 长大、3 成熟。
 *   成熟期要一眼能认出是什么——这是玩家每天回来收东西时唯一的信息来源，
 *   所以形状差异做得比写实更夸张：白菜是圆球、土豆是立着的复叶+白花、南瓜是橙色扁球。
 */
import { Img, hex, type RGBA } from './px.ts';
import { PAL } from './palette.ts';

const OUT = PAL.outline, L = PAL.leaf, D = PAL.dirt;

/** 刚播种：土里冒出的三点小芽（三种作物共用，反正这时看不出区别） */
function sproutBase(img: Img) {
  img.set(6, 14, D[0]); img.set(9, 13, D[0]); img.set(11, 14, D[0]);
  img.rect(7, 13, 1, 1, L[2]); img.rect(9, 12, 1, 1, L[3]);
}

/* ------------------------------------------------------------------ 小白菜 */
function cabbage(stage: number): Img {
  const img = new Img(16, 16);
  if (stage === 0) { sproutBase(img); return img.outlined(OUT); }
  if (stage === 1) {
    // 两片小圆叶，贴地
    img.ellipse(6.5, 12.5, 2.6, 1.7, L[2]);
    img.ellipse(9.5, 12, 2.6, 1.7, L[3]);
    img.rect(7, 13, 2, 1, L[1]);
    return img.outlined(OUT);
  }
  if (stage === 2) {
    // 叶簇：外圈深、内圈浅，能看出是"一丛菜"
    img.ellipse(4.5, 11, 3, 2.4, L[1]);
    img.ellipse(11.5, 11, 3, 2.4, L[1]);
    img.ellipse(8, 9.5, 4.2, 3.4, L[2]);
    img.ellipse(8, 10.5, 3.1, 2.4, L[3]);
    img.ellipse(8, 11.4, 1.8, 1.3, L[4]);
    return img.outlined(OUT);
  }
  // 成熟：整颗白菜，外层叶张开、内层菜心卷起（圆球状最容易被认出来）
  img.ellipse(8, 10.5, 6.2, 4.6, L[1]);
  img.ellipse(4.6, 11.6, 3.2, 2.6, L[2]);
  img.ellipse(11.4, 11.6, 3.2, 2.6, L[2]);
  img.ellipse(8, 9.6, 4.6, 3.8, L[3]);
  img.ellipse(8, 10.4, 3.2, 2.7, L[4]);
  img.rect(7, 9, 2, 5, hex('#eaf7d8'));            // 菜心（竖着的一条浅色）
  img.hline(6, 13, 4, L[2]);
  return img.outlined(OUT);
}

/* -------------------------------------------------------------------- 土豆 */
function potato(stage: number): Img {
  const img = new Img(16, 16);
  if (stage === 0) { sproutBase(img); return img.outlined(OUT); }
  if (stage === 1) {
    img.rect(7, 9, 2, 5, L[1]);                     // 短茎
    img.ellipse(6, 9, 2, 1.4, L[3]);
    img.ellipse(10, 9.6, 2, 1.4, L[2]);
    return img.outlined(OUT);
  }
  if (stage === 2) {
    img.rect(7, 5, 2, 9, L[1]);                     // 立着的茎
    for (const y of [6, 9, 12]) {                   // 三对对生的复叶
      img.ellipse(5.2, y + 1, 2.6, 1.5, L[3]);
      img.ellipse(10.8, y + 1, 2.6, 1.5, L[2]);
    }
    img.ellipse(8, 5, 1.8, 1.4, L[4]);
    return img.outlined(OUT);
  }
  // 成熟：茎顶开小白花 + 地面露出土黄色的块茎
  img.rect(7, 4, 2, 9, L[1]);
  for (const y of [5, 8, 11]) { img.ellipse(5.2, y + 1, 2.4, 1.4, L[2]); img.ellipse(10.8, y + 1, 2.4, 1.4, L[3]); }
  img.ellipse(8, 3.6, 2.6, 2.2, hex('#f4f1e6'));    // 花
  img.set(8, 3, hex('#e6c64a'));
  img.ellipse(8, 13.4, 4, 2, hex('#c69a5e'));       // 露出的块茎
  img.ellipse(6, 13.6, 1.6, 1.1, hex('#dcb97f'));
  img.set(7, 12, hex('#9a7442')); img.set(10, 14, hex('#9a7442'));
  return img.outlined(OUT);
}

/* -------------------------------------------------------------------- 南瓜 */
function pumpkin(stage: number): Img {
  const img = new Img(16, 16);
  if (stage === 0) { sproutBase(img); return img.outlined(OUT); }
  if (stage === 1) {
    img.rect(7, 11, 1, 3, L[1]);
    img.ellipse(6, 10.5, 2.4, 1.8, L[3]);
    img.ellipse(10, 11, 2.2, 1.6, L[2]);
    return img.outlined(OUT);
  }
  if (stage === 2) {
    img.rect(3, 12, 3, 1, L[1]);                    // 爬开的藤
    img.rect(10, 13, 3, 1, L[1]);
    img.ellipse(4, 10, 3.4, 2.6, L[2]);             // 两片大叶
    img.ellipse(11.5, 10.6, 3.2, 2.4, L[3]);
    img.rect(5, 9, 1, 3, L[1]); img.rect(12, 9.6, 1, 3, L[1]);
    img.ellipse(8, 12, 1.6, 1.2, L[2]);             // 长出的小瓜
    return img.outlined(OUT);
  }
  // 成熟：橙色扁球，带竖棱和瓜蒂
  img.ellipse(8, 11, 6.4, 4.4, hex('#d97d2a'));
  img.ellipse(8, 10.4, 5.6, 3.8, hex('#e8973c'));
  img.vline(5, 8, 6, hex('#b8621f'));               // 竖棱
  img.vline(8, 7, 8, hex('#b8621f'));
  img.vline(11, 8, 6, hex('#b8621f'));
  img.ellipse(6, 9.4, 2, 1.2, hex('#f2b264'));      // 高光
  img.rect(7, 5, 2, 3, hex('#6b4d33'));             // 瓜蒂
  img.rect(7, 4, 2, 1, hex('#8a6a45'));
  return img.outlined(OUT);
}

/** 作物 id → 三个阶段画法（0 用通用小芽） */
const PAINTERS: Record<string, (s: number) => Img> = { cabbage, potato, pumpkin };

/** 全部作物精灵：[key, img]，key = `${id}@${stage}` */
export function cropSprites(): { key: string; img: Img }[] {
  const out: { key: string; img: Img }[] = [];
  for (const [id, paint] of Object.entries(PAINTERS)) {
    for (let s = 0; s < 4; s++) out.push({ key: `${id}@${s}`, img: paint(s) });
  }
  return out;
}

/**
 * 世界地图上的"实验田"入口（4 格宽 × 3 格高）：木栅栏围住的 4×3 田垄，
 * 南边正中留一格门洞 + 一块歪挂着的小木牌。真正的种地在另一个场景里，这里只是入口。
 * 不做碰撞——玩家可以直接走到门口按 E，别让栅栏把人卡在路边。
 */
export interface PlotSprite { img: Img; ax: number; ay: number }
export function farmPlot(): PlotSprite {
  const W = 70, H = 66;                      // 4 格宽 × 3 格高（土），上面再留 12px 给北侧栅栏
  const w = PAL.wood;
  const img = new Img(W, H);
  // 土比木栅栏暗得多（冷褐 vs 暖棕）——同一个色系的话整块会糊成一坨，像木箱
  const SOIL = [hex('#2e2016'), hex('#3c2b1d'), hex('#4a3626'), hex('#5c4632')];
  const sx = 2, sy = 14, sw = 64, sh = 48;   // 4×3 格的土块

  // ---- 北侧栅栏（先画，土块会压住它的下缘，看起来是"插在地后面"）
  const post = (x: number, y: number, h: number) => {
    img.rect(x, y, 2, h, w[2]);
    img.vline(x, y, h, w[4]);
    img.vline(x + 1, y, h, w[1]);
    img.rect(x - 1, y, 4, 1, w[3]);                      // 桩头就 1px 一排，别做成柱子
    img.rect(x - 1, y + 1, 1, 1, w[2]); img.rect(x + 2, y + 1, 1, 1, w[2]);
  };
  for (let x = 5; x <= W - 7; x += 15) post(x, 4, 12);
  img.hline(5, 10, W - 12, w[4]);                        // 只画一道亮木横杆，两道会像铁丝网

  // ---- 土块：翻过的地，横着三道垄。垄背是鼓起来的（顶边亮、底边暗），
  //      再用确定性噪点撒一层颗粒——不然整块土会像木地板
  // 这个 hash 不能用简单的线性同余——线性式会让噪点排成一条条斜纹，看着像木纹
  const hash = (x: number, y: number) => {
    let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
    h = Math.imul(h ^ (h >>> 15), 0x2545f491);
    return ((h ^ (h >>> 13)) >>> 0) % 997 / 997;
  };
  img.rect(sx, sy, sw, sh, SOIL[1]);
  for (let r = 0; r < 3; r++) {
    const y0 = sy + 1 + r * 16;
    img.rect(sx, y0, sw, 15, SOIL[2]);                   // 垄背
    img.hline(sx, y0, sw, SOIL[3]);                      // 顶边受光
    img.hline(sx, y0 + 14, sw, SOIL[1]);                 // 底边压暗
    img.hline(sx, y0 + 15, sw, SOIL[0]);                 // 垄沟（1px 深色 + 1px 过渡）
    img.hline(sx, y0 + 16 > sy + sh - 1 ? sy + sh - 1 : y0 + 16, sw, SOIL[2]);
  }
  // 颗粒感：只在地表浅层撒点，深色点子 1px，别连成线
  for (let y = sy; y < sy + sh; y++) for (let x = sx; x < sx + sw; x++) {
    const h = hash(x, y);
    if (h < 0.09) img.set(x, y, SOIL[0]);
    else if (h > 0.95) img.set(x, y, SOIL[3]);
  }
  // 垄上冒头的小苗（一垄 4 株）：两片向上张开的小叶 + 深色根茎
  for (let r = 0; r < 3; r++) {
    const y = sy + 9 + r * 16;
    for (const dx of [9, 23, 37, 51]) {
      img.rect(dx, y, 1, 3, PAL.leaf[1]);
      img.rect(dx - 2, y - 3, 2, 2, PAL.leaf[3]);        // 左叶
      img.rect(dx + 1, y - 4, 2, 2, PAL.leaf[2]);        // 右叶
      img.set(dx - 1, y - 1, PAL.leaf[2]);
    }
  }

  // ---- 西/东两侧栅栏（贴土边，短桩）
  for (const y of [20, 34, 48]) { post(2, y, 12); post(W - 4, y, 12); }
  // ---- 南侧：中间留一个 2 格宽的门洞，两侧各一段栅栏；门洞两侧的柱子比普通桩高 4px，
  //      这样"这里能进去"一眼看得出（这是入口，不是花坛）
  post(2, 54, 12); post(16, 49, 17);                     // 门左
  post(51, 49, 17); post(W - 4, 54, 12);                 // 门右
  img.hline(2, 57, 14, w[4]); img.hline(52, 57, 16, w[4]);
  // 门槛：门洞里一道浅色的踩踏土（玩家站这一格按 E）
  img.rect(19, sh + sy - 3, 31, 3, SOIL[3]);

  // ---- 小木牌：立在门左边的土边上，牌面画三片叶子（字由世界标签负责）
  const bx = 7, by = 41;
  img.rect(bx + 6, by + 9, 1, 8, w[1]);                  // 牌柱
  img.rect(bx, by, 15, 10, hex('#dcb884'));
  img.hline(bx, by, 15, hex('#f2d6a8'));
  img.hline(bx, by + 9, 15, w[1]);
  for (const [dx, c] of [[3, PAL.leaf[2]], [7, PAL.leaf[3]], [11, PAL.leaf[1]]] as const) {
    img.ellipse(bx + dx, by + 4, 1.6, 1.2, c);
    img.set(bx + dx, by + 6, PAL.leaf[0]);
  }

  const out = img.outlined(PAL.outline);
  // 落影
  for (let y = H - 7; y < H - 1; y++) for (let x = 4; x < W - 4; x++) {
    const dx = (x - W / 2) / ((W - 8) / 2), dy = (y - (H - 5)) / 2;
    if (dx * dx + dy * dy <= 1 && out.alpha(x, y) === 0) out.set(x, y, [28, 36, 66, 52] as RGBA);
  }
  return { img: out, ax: W / 2, ay: H - 5 };
}
