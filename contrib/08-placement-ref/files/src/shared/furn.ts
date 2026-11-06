/**
 * 家具目录与摆放规则（客户端与服务器共用）。
 *
 * - `FURN_SHOP`：能买的家具（价格、分类、占地）。名字/分类和 tools/art/furniture-home.ts 的 HOME_INFO 对应。
 * - `DORM_STATIC`：宿舍里"本来就有"的家具（床/桌/柜/宝箱/浴缸…），摆新东西时要把它们算成已占用。
 *   这份表必须和 data/interiors/dorm.json 一致（有测试盯着）。
 * - 占地只用 fw×fh；旋转后的宽高互换由 `furnMeta` 合成，不依赖 furniture-meta.json（服务器不需要读资源文件）。
 */
import type { Rot } from './interior';
import type { FurnMeta } from './place';

/** 家具分类（商店里的分组顺序） */
export const FURN_CATS = ['坐具', '桌柜', '家电', '灯具', '地毯', '墙面', '绿植', '其他'] as const;
export type FurnCat = (typeof FURN_CATS)[number];

export interface FurnDef {
  k: string;
  name: string;
  /** 校园币；0 = 不卖（宿舍自带的） */
  price: number;
  cat: FurnCat;
  fw: number;
  fh: number;
  /** 摆在桌面上的小件：不占地 */
  top?: boolean;
  /** 平铺在地上不挡路（地毯） */
  flat?: boolean;
  /** 墙面挂件（fh = 0，挂在北墙，不占地面） */
  wall?: boolean;
  note: string;
}

/** 能买的家具：价格按"校园币"定档，便宜 60~150、常用 200~400、讲究 500~900 */
export const FURN_SHOP: readonly FurnDef[] = [
  { k: 'splant', name: '小盆栽', price: 60, cat: '绿植', fw: 1, fh: 1, top: true, note: '摆在桌上的小绿植' },
  { k: 'desklamp', name: '台灯', price: 80, cat: '灯具', fw: 1, fh: 1, top: true, note: '桌上的小台灯，晚上屋里更暖' },
  { k: 'shoe', name: '鞋架', price: 90, cat: '桌柜', fw: 1, fh: 1, note: '两层，能放两双鞋' },
  { k: 'poster', name: '风景海报', price: 110, cat: '墙面', fw: 1, fh: 0, wall: true, note: '挂在北墙上的小画' },
  { k: 'armchair', name: '单人扶手椅', price: 120, cat: '坐具', fw: 1, fh: 1, note: '一个人窝着刚好' },
  { k: 'potplant', name: '大盆栽', price: 130, cat: '绿植', fw: 1, fh: 1, note: '角落里的绿意' },
  { k: 'catbed', name: '猫窝', price: 140, cat: '其他', fw: 1, fh: 1, note: '垫子软，猫会想躺' },
  { k: 'wallclock', name: '挂钟', price: 150, cat: '墙面', fw: 1, fh: 0, wall: true, note: '挂在墙上，指针会走' },
  { k: 'coffee', name: '木茶几', price: 160, cat: '桌柜', fw: 2, fh: 1, note: '矮茶几，上面放了杂志和杯子' },
  { k: 'floorlamp', name: '落地灯', price: 200, cat: '灯具', fw: 1, fh: 1, note: '站着的一盏灯，罩里透暖光' },
  { k: 'rug', name: '花纹地毯', price: 240, cat: '地毯', fw: 3, fh: 2, flat: true, note: '3×2，铺在地上不挡路' },
  { k: 'couch', name: '青绿沙发', price: 380, cat: '坐具', fw: 3, fh: 1, note: '三人座，两个坐垫' },
  { k: 'mirror', name: '穿衣镜', price: 320, cat: '其他', fw: 1, fh: 1, note: '木框立镜，能照全身' },
  { k: 'washer', name: '洗衣机', price: 460, cat: '家电', fw: 1, fh: 1, note: '滚筒的，门上有一圈玻璃' },
  { k: 'tvset', name: '电视柜+电视', price: 520, cat: '桌柜', fw: 2, fh: 1, note: '柜子两门，屏幕上带冷光' },
  { k: 'aquarium', name: '鱼缸', price: 680, cat: '绿植', fw: 2, fh: 1, note: '2 格宽，有水和两条小鱼' },
  { k: 'fireplace', name: '壁炉', price: 900, cat: '其他', fw: 2, fh: 1, note: '砖砌的，里面有柴火和火光' },
];

/** 宿舍自带的东西（不卖，但摆新家具时要算占用）。和 data/interiors/dorm.json 对应 */
export const DORM_STATIC: readonly { k: string; x: number; y: number }[] = [
  { k: 'dsign', x: 1, y: 2 },       // 门牌（墙面，不占地）
  { k: 'ac', x: 9, y: 1 },          // 空调（墙面）
  { k: 'poster', x: 11, y: 2 },     // 海报（墙面）
  { k: 'dbed', x: 1, y: 3 },
  { k: 'deskpc', x: 6, y: 3 },
  { k: 'chairup', x: 6, y: 4 },
  { k: 'dwardrobe', x: 12, y: 3 },
  { k: 'dchest', x: 14, y: 3 },
  { k: 'dtub', x: 13, y: 6 },
  { k: 'potplant', x: 2, y: 7 },
  { k: 'catbed', x: 13, y: 8 },
  { k: 'bin', x: 1, y: 8 },
  { k: 'plant', x: 14, y: 9 },
];

/** 不卖的（宿舍自带）家具占地：名字只是提示用 */
const STATIC_FOOT: Record<string, { name: string; fw: number; fh: number; top?: boolean }> = {
  dbed: { name: '单人床', fw: 2, fh: 3 },
  deskpc: { name: '木桌+电脑', fw: 2, fh: 1 },
  chairup: { name: '木椅', fw: 1, fh: 1 },
  dwardrobe: { name: '衣柜', fw: 2, fh: 1 },
  dchest: { name: '宝箱', fw: 1, fh: 1 },
  dtub: { name: '浴缸', fw: 2, fh: 2 },
  plant: { name: '绿植', fw: 1, fh: 1 },
  bin: { name: '垃圾桶', fw: 1, fh: 1 },
  dsign: { name: '门牌', fw: 5, fh: 0 },
  ac: { name: '空调', fw: 2, fh: 0 },
};

/** 一间宿舍最多摆几件（再多屋里就转不开身了） */
export const DORM_PLACED_MAX = 24;
/** 同一种家具最多存几件 */
export const DORM_OWN_MAX = 20;

export const FURN_BY_K: ReadonlyMap<string, FurnDef> = new Map(FURN_SHOP.map((f) => [f.k, f]));
export const furnDef = (k: unknown): FurnDef | undefined => (typeof k === 'string' ? FURN_BY_K.get(k) : undefined);
/** 这件东西能不能摆（买的 + 宿舍自带的都算，自带的不许玩家摆） */
export const isPlaceable = (k: string): boolean => FURN_BY_K.has(k);

/** 给 place.ts 用的元数据：占地 + 四个朝向（旋转就是宽高互换） */
export function furnMeta(k: string): FurnMeta | undefined {
  const d = FURN_BY_K.get(k);
  const fw = d?.fw ?? STATIC_FOOT[k]?.fw, fh = d?.fh ?? STATIC_FOOT[k]?.fh;
  if (fw === undefined || fh === undefined) return undefined;
  const r = (w: number, h: number) => ({ fw: w, fh: h });
  return {
    fw, fh, top: !!d?.top, flat: !!d?.flat,
    rots: { 0: r(fw, fh), 90: r(fh, fw), 180: r(fw, fh), 270: r(fh, fw) },
  };
}

export interface PlacedFurn { k: string; x: number; y: number; rot: Rot }

const ROTS: Rot[] = [0, 90, 180, 270];
const isRot = (v: unknown): v is Rot => ROTS.includes(v as Rot);

/** 从存档/网络来的已摆家具：丢掉不认识的、越界坐标、非整数；最多 DORM_PLACED_MAX 件 */
export function cleanPlaced(raw: unknown): PlacedFurn[] {
  if (!Array.isArray(raw)) return [];
  const out: PlacedFurn[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    if (!isPlaceable(String(o.k))) continue;
    const x = Number(o.x), y = Number(o.y);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > 48 || y > 40) continue;
    out.push({ k: String(o.k), x, y, rot: isRot(o.rot) ? o.rot : 0 });
    if (out.length >= DORM_PLACED_MAX) break;
  }
  return out;
}

/** 家具仓库（k → 件数）：只留认识的 key，每件 1~DORM_OWN_MAX */
export function cleanOwned(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isPlaceable(k)) continue;
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n <= 0) continue;
    out[k] = Math.min(n, DORM_OWN_MAX);
  }
  return out;
}

/** 仓库里一共有几件（界面上显示"家具仓库 8 件"） */
export const ownedTotal = (own: Record<string, number>): number => Object.values(own).reduce((a, b) => a + b, 0);

/** 商店里按分类分组，空分类不出现 */
export function shopByCat(): { cat: FurnCat; items: FurnDef[] }[] {
  return FURN_CATS.map((cat) => ({ cat, items: FURN_SHOP.filter((f) => f.cat === cat) })).filter((g) => g.items.length > 0);
}
