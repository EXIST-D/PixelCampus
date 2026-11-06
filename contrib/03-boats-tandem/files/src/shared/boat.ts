/**
 * 精工湖的小木船（划艇）。它不占背包、也不进存档：每个世界里湖东南岸的水面上停着一条，
 * 本质上是「一条留在水上的车」——谁都能划走，划完停在原地，不会自己消失。
 *
 * 规则：
 *  · 岸边走近按 E 上船；上船后**只能在湖水里走**（划不上岸、也出不了湖），按 E 靠岸下船；
 *  · 比共享单车慢一半（走路的 2.5 倍），急转弯会掉速；
 *  · 在湖心离岸太远时下不了船（要先划回岸边）；
 *  · 船上的位置就是船心，所以别人的画面里看到的是「一个人坐在船里」。
 */

/** 小船的速度：相对共享单车（0.5 = 单车的一半，走路的 2.5 倍） */
export const BOAT_SPEED_MULT = 0.5;
/** 站在岸边多近能上船（像素） */
export const BOAT_REACH = 46;
/** 下船时最多往外找多远能上岸（像素）；超过这个距离说明还在湖心，不让下 */
export const BOAT_LAND_REACH = 58;
/** 每个世界的湖上放几条船：几处停船点散在湖岸，谁都能就近上船（在线人多，4 条不够抢） */
export const BOAT_COUNT = 7;
/**
 * 小船"自己漂回停船点"的时间：船停在谁都能走到的地方时 5 分钟归位；
 * 被丢在湖心（四周 58 像素内没有岸，谁都够不到）时 60 秒就归位。
 * 不做这件事的话，有人划到湖心直接下线/传送，那条船就永远躺在湖中间了。
 */
export const BOAT_HOME_MS = 300_000;
export const BOAT_STRANDED_MS = 60_000;
/** 离停船点多近算"已经停在原位"（不用再挪，只续时间） */
export const BOAT_HOME_PX = 40;
/** 划船时一秒最多上报多少次（和骑行一样按 30 Hz） */
export const BOAT_REPORT_HZ = 30;

/**
 * 在湖边找几个能停船的角落：每个都是"四邻里有一格能站人"的水格，离湖心 6 格到 maxR 的 7 成之间。
 * 选的时候先挑离湖心近的，并且彼此至少隔开 minGap 格（几处停船点散在湖岸上，不会挤成一堆）。
 * 地图换了也能自己找到位置。
 */
export function findMoors(
  isWater: (tx: number, ty: number) => boolean,
  isLand: (tx: number, ty: number) => boolean,
  lake: { x: number; y: number },
  count = 7, tile = 16, maxR = 70, minGap = 14,
): { x: number; y: number }[] {
  const cands: { tx: number; ty: number; score: number }[] = [];
  for (let ty = Math.floor(lake.y - maxR); ty <= lake.y + maxR; ty++) {
    for (let tx = Math.floor(lake.x - maxR); tx <= lake.x + maxR; tx++) {
      if (!isWater(tx, ty)) continue;
      // 旁边得有一格能站人，不然上不了船
      const shore = [[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => isLand(tx + dx, ty + dy));
      if (!shore) continue;
      const d = Math.hypot(tx + 0.5 - lake.x, ty + 0.5 - lake.y);
      if (d < 6 || d > maxR * 0.7) continue;
      cands.push({ tx, ty, score: d - (ty > lake.y ? 0.6 : 0) }); // 同距离优先南岸（人常走的一侧）
    }
  }
  cands.sort((a, b) => a.score - b.score);
  const picked: { tx: number; ty: number }[] = [];
  for (const c of cands) {
    if (picked.length >= count) break;
    if (picked.every((p) => Math.hypot(p.tx - c.tx, p.ty - c.ty) >= minGap)) picked.push({ tx: c.tx, ty: c.ty });
  }
  return picked.map((p) => ({ x: p.tx * tile + tile / 2, y: p.ty * tile + tile / 2 }));
}

/** 只要一处停船点（测试和"找一条船"的地方用） */
export function findMoor(
  isWater: (tx: number, ty: number) => boolean,
  isLand: (tx: number, ty: number) => boolean,
  lake: { x: number; y: number },
  tile = 16, maxR = 70,
): { x: number; y: number } | null {
  return findMoors(isWater, isLand, lake, 1, tile, maxR)[0] ?? null;
}

/**
 * 找一个能上岸的落脚点：从 (x,y) 往外一圈圈试，第一个「不挡」的像素点就是岸边。
 * blocked 由调用方给（客户端用 WorldMap.boxBlocked，服务器用同一张碰撞图）。
 * 船停在湖心（四周全是水）就返回 null —— 调用方据此拒绝下船。
 */
export function landNear(blocked: (x: number, y: number) => boolean, x: number, y: number, reach = BOAT_LAND_REACH): { x: number; y: number } | null {
  if (!blocked(x, y)) return { x: Math.round(x), y: Math.round(y) };
  for (let r = 6; r <= reach; r += 5) {
    const n = Math.max(12, Math.round(r * 1.1));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2; // 从正上方开始转一圈：优先最近的岸
      const px = Math.round(x + Math.cos(a) * r), py = Math.round(y + Math.sin(a) * r);
      if (!blocked(px, py)) return { x: px, y: py };
    }
  }
  return null;
}
