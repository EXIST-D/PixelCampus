/**
 * 精工湖的小木船（划艇）：浅棕色平底木船，船头翘起、舷边一道浅色木沿，船里横着一块坐板，
 * 两支桨搭在舷上。划起来会轻轻晃（两帧水波），停在岸边时是空船。
 *
 * 画布统一 38×22（描边后 40×24，再加一行水面投影 → 40×25），脚点 = 船心 (20, 21)。
 * 帧名：
 *   boat_{dir}_{帧}    船身（人物身后的一层，4 个方向 × 2 帧）
 *   boatf_down_{帧}    朝下时船头那一半（盖在人物身前，人才像"坐在船里"）
 *   boat_parked_r|l    空船（停在岸边；朝左是镜像）
 */
import { Img, hex, type RGBA } from './px.ts';

export type BoatDir = 'down' | 'up' | 'left' | 'right';
export const BOAT_W = 40, BOAT_H = 25, BOAT_AX = 20, BOAT_AY = 21;
/** 描边前的画布（所有帧一致，脚点才对得齐） */
const CW = 38, CH = 22;
/** 舷边（船沿）在画布上的高度：人和桨都贴着这条线 */
const RIM = 7;

const HULL = hex('#8a5a32'), HULL_L = hex('#b9834a'), HULL_D = hex('#5e3a1e');
const DECK = hex('#d9a86a'), DECK_L = hex('#efc994'), DECK_D = hex('#a87a44');
const DARK = hex('#3a2414'), INNER = hex('#57381e'), FOAM = hex('#6ab0c4'), SEAT = hex('#c08a52');
const OAR = hex('#c9a068'), BLADE = hex('#e4c48e');

function line(img: Img, x0: number, y0: number, x1: number, y1: number, c: RGBA) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    img.set(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/**
 * 侧视（朝右）：略俯视的角度 —— 上面一条「远端船沿」的弧线，中间是船舱（深色），
 * 下面一条「近端船沿」+ 船壳（浅棕，带木缝），船底贴着水花。船头（右）微微翘起。
 * bob 0/1 = 整体上下 1px、桨换个位置，看着像浮在水上轻轻晃。
 */
function side(bob: number, o: { rowing: boolean; moored?: boolean }): Img {
  const img = new Img(CW, CH);
  const lift = bob ? 1 : 0;
  const farY = (t: number) => 5 + lift - Math.round(Math.sin(Math.PI * t) * 1.2);
  const nearY = (t: number) => 11 + lift - Math.round(Math.sin(Math.PI * t) * 1.6);
  const botY = (t: number) => nearY(t) + 3 + Math.round(Math.sin(Math.PI * Math.min(1, t * 1.02)) ** 0.8 * 4);
  for (let x = 2; x <= 35; x++) {
    const t = (x - 2) / 33;
    const bow = t > 0.9 ? Math.round((t - 0.9) * 20) : 0; // 船头翘起来
    const fY = farY(t) - bow, nY = nearY(t) - bow, bY = botY(t) - bow;
    // 远端船沿（浅色木边）
    img.set(x, fY, DECK_L); img.set(x, fY + 1, DECK_D);
    // 船舱（深色），两端收窄变浅
    for (let y = fY + 2; y < nY; y++) img.set(x, y, DARK);
    // 近端船沿
    img.set(x, nY, DECK_L); img.set(x, nY + 1, DECK);
    // 船壳
    for (let y = nY + 2; y <= bY; y++) img.set(x, y, y >= bY ? HULL_D : HULL);
    if (bY - nY > 3) img.set(x, nY + 3, HULL_D); // 船壳上一道木缝
  }
  // 船尾（左）的方尾 + 船头（右）的木头尖
  img.rect(1, 7 + lift, 1, 6, HULL_D); img.set(2, 6 + lift, DECK_D);
  img.rect(35, 4 + lift, 2, 4, HULL_L); img.set(37, 3 + lift, DECK);
  // 坐板：横在船舱里的一块浅色板子
  img.rect(14, 8 + lift, 8, 2, SEAT);
  // 水线：贴着船底的一圈浪花
  for (let x = 5; x <= 32; x++) { const t = (x - 2) / 33; if ((x + bob * 2) % 6 !== 0) img.set(x, botY(t) - (t > 0.9 ? Math.round((t - 0.9) * 20) : 0) + 1, FOAM); }
  // 两支桨：一支伸出船外点水，一支斜搭在舷上
  if (o.rowing) {
    const bx = 27 + bob, by = 17 + lift - bob;
    line(img, 17, 9 + lift, 22, 13 + lift, OAR); line(img, 22, 13 + lift, bx, by, OAR);
    img.rect(bx - 1, by, 3, 2, BLADE);
    line(img, 19, 8 + lift, 26, 11 + lift, OAR); img.rect(25, 11 + lift, 2, 1, BLADE);
  } else {
    line(img, 16, 9 + lift, 29, 12 + lift, OAR); img.rect(28, 12 + lift, 3, 1, BLADE);
    line(img, 14, 10 + lift, 24, 14 + lift, OAR); img.rect(23, 14 + lift, 2, 1, BLADE);
  }
  // 系船桩（停在岸边时）
  if (o.moored) { img.rect(4, 5 + lift, 1, 6, HULL_D); img.set(4, 4 + lift, DECK); }
  return img;
}

/**
 * 正/背视（俯视多一点）：一圈浅色船沿包着深色船舱，中间横一块坐板；船头那一端收窄。
 * bowDown = 船头朝画面下方。返回 [船身, 船头那一半]（后者只在朝下时盖到人物前面）。
 */
function front(bob: number, bowDown: boolean): [Img, Img] {
  const back = new Img(CW, CH), fr = new Img(CW, CH);
  const cx = 19, top = 6 + (bob ? 0 : 1), hh = 12;
  const halfAt = (y: number) => {
    const t = y / (hh - 1);                                  // 0 = 船尾，1 = 船头
    const oval = Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.92)) ** 0.6;
    const taper = bowDown ? 1 - 0.42 * t ** 1.7 : 0.62 + 0.38 * t ** 1.7;
    return Math.max(2, Math.round(15 * oval * taper));
  };
  for (let y = 0; y < hh; y++) {
    const half = halfAt(y), yy = top + y;
    back.rect(cx - half, yy, half * 2 + 1, 1, DECK_L);        // 船沿（浅色木边）
    if (half > 3) {
      back.set(cx - half, yy, DECK_D); back.set(cx + half, yy, DECK_D);
      back.hline(cx - half + 2, yy, (half - 1) * 2, INNER);   // 船舱（木色，不是黑洞）
      back.set(cx - half + 1, yy, DECK);                      // 船沿内侧一点亮
      back.set(cx + half - 1, yy, DECK);
    }
  }
  // 坐板
  back.rect(cx - 7, top + 7, 15, 2, SEAT); back.hline(cx - 7, top + 7, 15, DECK_L);
  // 船头/船尾的水花
  for (let x = cx - 10; x <= cx + 10; x++) if ((x + bob * 2) % 5 !== 0) back.set(x, top + hh, FOAM);
  // 靠近观者的那一段船壳（盖在人物身前，人才像坐在船里）：朝下是船头、朝上是船尾
  if (true) {
    for (let y = 10; y < hh; y++) {
      const half = halfAt(y), yy = top + y;
      fr.rect(cx - half, yy, half * 2 + 1, 1, DECK_L);
      if (half > 3) { fr.set(cx - half, yy, DECK_D); fr.set(cx + half, yy, DECK_D); fr.hline(cx - half + 2, yy, (half - 1) * 2, INNER); }
    }
  }
  return [back, fr];
}

/** 描边 + 船底一圈水面投影（船浮在水上，底下有一点深色水影） */
const finBoat = (raw: Img): Img => {
  const o = raw.outlinedSoft(0.42, [40, 28, 18, 255]);
  const out = new Img(o.w, o.h + 1);
  for (let y = o.h - 4; y < o.h + 1; y++) for (let x = 4; x < o.w - 4; x++) {
    const dx = (x + 0.5 - o.w / 2) / 15, dy = (y + 0.5 - (o.h - 1.4)) / 2.1;
    if (dx * dx + dy * dy <= 1) out.set(x, y, [20, 52, 74, dx * dx + dy * dy > 0.5 ? 28 : 54]);
  }
  out.blit(o, 0, 0);
  return out;
};
const mirror = (r: Img): Img => { const m = new Img(r.w, r.h); for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { const c = r.get(r.w - 1 - x, y); if (c[3]) m.set(x, y, c); } return m; };

export function buildBoats(): Record<string, Img> {
  const frames: Record<string, Img> = {};
  for (let f = 0; f < 2; f++) {
    const r = finBoat(side(f, { rowing: true }));
    frames[`boat_right_${f}`] = r; frames[`boat_left_${f}`] = mirror(r);
    const [b, fr] = front(f, true);
    frames[`boat_down_${f}`] = finBoat(b); frames[`boatf_down_${f}`] = finBoat(fr);
    frames[`boat_up_${f}`] = finBoat(front(f, false)[0]);
    frames[`boatf_up_${f}`] = finBoat(front(f, false)[1]);
  }
  const moored = finBoat(side(0, { rowing: false, moored: true }));
  frames['boat_parked_r'] = moored; frames['boat_parked_l'] = mirror(moored);
  return frames;
}

/**
 * 划船时的骑手摆位：人坐在船中间，只露上半身（腿在船里，不画）。
 * crop = 从头顶往下留多少像素（26 ≈ 头 + 胸），dy = 人物上抬多少像素（负数 = 往下压，让他坐进船里）。
 * 摆位规则：可见的下缘 = 船沿下 5 像素（人"坐"在船舱里，而不是浮在船上方）。
 */
export const BOAT_RIDER = { crop: 30, dy: -6, dx: { right: 1, left: -1, down: 0, up: 0 } };
