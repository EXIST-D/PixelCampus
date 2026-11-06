/**
 * 室内摆放规则（纯函数，服务器与客户端共用）。
 *
 * 家具的占地/锚点来自 `public/assets/generated/furniture-meta.json`（由 tools/world/interiors.ts 生成），
 * 这里只管"能不能摆"：网格吸附、旋转后的占地、边界、重叠、门前通道。
 * 服务端用它做校验（不信任客户端），客户端用它做落点预览（红/绿）。
 *
 * 还没管的：墙面挂件（fh=0 的字画/横幅/门牌）——它们挂在北墙上、不占地面格，
 * 以后要让玩家挂东西时再单独加一条 `isWall(m)` 分支，别直接塞进这里的边界判断。
 */
import type { Rot } from './interior';

/** 家具目录里一件家具的元数据（furniture-meta.json 的条目，只要用得到的字段） */
export interface FurnMeta {
  fw: number;
  fh: number;
  w?: number;
  h?: number;
  top?: boolean;
  /** 平铺在地上、不挡路（地毯） */
  flat?: boolean;
  /** 墙面挂件（fh = 0）：挂在北墙，格子只算一排 */
  wall?: boolean;
  rots?: Partial<Record<Rot, { fw: number; fh: number; w?: number; h?: number; mx?: number; my?: number }>>;
}

/** 一件摆好的家具（存档里就存这几个字段） */
export interface Placed { k: string; x: number; y: number; rot: Rot }

/** 一间房：格数 + 南墙门洞（和 src/shared/interior.ts 的 InteriorSpec 对齐） */
export interface RoomBox { w: number; h: number; exit: { x: number; w: number } }

export const WALL_N = 3;   // 北墙占上面 3 格（给"墙面挂件"留位置）
export const WALL = 1;     // 东西南各 1 格
export const DOOR_CLEAR = 2; // 门前留 2 格空，别把出口堵成"墙"

/** 旋转后的占地（格）。rots 里没有这个角度 = 这件家具不能转 */
export function footOf(m: FurnMeta, rot: Rot): { fw: number; fh: number } | null {
  if (!rot) return { fw: m.fw, fh: m.fh };
  const r = m.rots?.[rot];
  if (!r) return null;
  return { fw: r.fw, fh: r.fh };
}

/** 可以摆的格子区间（含端点），给 UI 画网格用 */
export function placeArea(box: RoomBox) {
  return { x0: WALL, y0: WALL_N, x1: box.w - WALL - 1, y1: box.h - WALL - 1 };
}

/** 门洞 + 门前的通道（任何家具都不能压这几格） */
export function doorCells(box: RoomBox): Set<string> {
  const out = new Set<string>();
  const y0 = box.h - WALL - 1;                       // 南墙里面那一行
  for (let y = Math.max(WALL_N, y0 - (DOOR_CLEAR - 1)); y <= y0; y++) {
    for (let x = box.exit.x; x < box.exit.x + box.exit.w; x++) out.add(`${x},${y}`);
  }
  return out;
}

/** 墙面挂件：fh = 0，只能挂在北墙那几行 */
export const isWall = (m: FurnMeta): boolean => m.fh === 0 || !!m.wall;

/** 一件家具占的格子（top 小件摆桌面、flat 地毯平铺：都不算占地；墙面挂件只算一排） */
export function cellsOf(m: FurnMeta, p: Placed): string[] {
  if (m.top || m.flat) return [];
  const f = footOf(m, p.rot);
  if (!f) return [];
  const out: string[] = [];
  if (isWall(m)) { for (let i = 0; i < f.fw; i++) out.push(`${p.x + i},${p.y}`); return out; }
  for (let j = 0; j < f.fh; j++) for (let i = 0; i < f.fw; i++) out.push(`${p.x + i},${p.y + j}`);
  return out;
}

/** 像素坐标 → 格（拖拽时把鼠标位置换成分格） */
export const snapTile = (px: number, py: number, tile = 16) => ({ x: Math.floor(px / tile), y: Math.floor(py / tile) });

export type PlaceWhy = 'bad-rot' | 'out-of-room' | 'door' | 'overlap' | 'unknown';

export interface PlaceCheck { ok: boolean; why?: PlaceWhy; with?: string }

export interface PlaceContext {
  box: RoomBox;
  /** 家具 key → 元数据（未知 key 直接拒） */
  meta: (k: string) => FurnMeta | undefined;
  /** 已经占着的家具（房间自带的 + 玩家摆的其他件） */
  taken: { p: Placed; m: FurnMeta }[];
  /** 正在移动的那一件的下标：校验时跳过它自己，不然永远和自己重叠 */
  ignore?: number;
}

/**
 * 能不能把 k 摆在 (x,y) 且转到 rot。
 * 顺序就是玩家最容易踩的顺序：能不能转 → 在不在屋里 → 压没压门 → 撞没撞别的。
 */
export function checkPlace(ctx: PlaceContext, p: Placed): PlaceCheck {
  const m = ctx.meta(p.k);
  if (!m) return { ok: false, why: 'unknown' };
  if (!footOf(m, p.rot)) return { ok: false, why: 'bad-rot' };
  if (m.top) return { ok: true };                     // 桌面小件不占地，随便摆（重叠由上层按桌面判断）

  const f = footOf(m, p.rot)!;
  if (isWall(m)) {                                    // 挂在北墙：横向不超出房间、纵向在墙里
    if (p.x < 0 || p.x + f.fw - 1 > ctx.box.w - 1 || p.y < 0 || p.y > WALL_N - 1) return { ok: false, why: 'out-of-room' };
    const mineW = cellsOf(m, p);
    for (let i = 0; i < ctx.taken.length; i++) {
      if (i === ctx.ignore) continue;
      const o = ctx.taken[i], theirs = cellsOf(o.m, o.p);
      for (const c of mineW) if (theirs.includes(c)) return { ok: false, why: 'overlap', with: o.p.k };
    }
    return { ok: true };
  }
  const a = placeArea(ctx.box);
  if (p.x < a.x0 || p.y < a.y0 || p.x + f.fw - 1 > a.x1 || p.y + f.fh - 1 > a.y1) return { ok: false, why: 'out-of-room' };

  if (m.flat) return { ok: true };                    // 地毯：只要求不出界，谁都能踩上去

  const mine = cellsOf(m, p);
  const door = doorCells(ctx.box);
  for (const c of mine) if (door.has(c)) return { ok: false, why: 'door' };

  for (let i = 0; i < ctx.taken.length; i++) {
    if (i === ctx.ignore) continue;
    const o = ctx.taken[i];
    const theirs = cellsOf(o.m, o.p);
    for (const c of mine) if (theirs.includes(c)) return { ok: false, why: 'overlap', with: o.p.k };
  }
  return { ok: true };
}

/** 玩家看到的话（服务端原样回给客户端，不用客户端自己编） */
export function placeWhyText(why: PlaceWhy | undefined): string {
  switch (why) {
    case 'bad-rot': return '这件家具不能转成这个方向';
    case 'out-of-room': return '放不下：超出房间了（别贴着墙）';
    case 'door': return '挡到门口了，往里挪一点';
    case 'overlap': return '和别的东西叠在一起了';
    case 'unknown': return '没有这件家具';
    default: return '摆不了';
  }
}
