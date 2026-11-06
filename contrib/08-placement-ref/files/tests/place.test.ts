import { describe, expect, it } from 'vitest';
import { checkPlace, cellsOf, doorCells, footOf, placeArea, snapTile, placeWhyText } from '../src/shared/place';
import type { FurnMeta, Placed } from '../src/shared/place';

/** 宿舍：16×11，门洞在南墙 x=7、宽 2（和 data/interiors/dorm.json 一致） */
const box = { w: 16, h: 11, exit: { x: 7, w: 2 } };
const desk: FurnMeta = { fw: 1, fh: 1 };
const bed: FurnMeta = { fw: 2, fh: 3, rots: { 0: { fw: 2, fh: 3 }, 90: { fw: 3, fh: 2 } } };
const sofa: FurnMeta = { fw: 3, fh: 1 };
const cup: FurnMeta = { fw: 1, fh: 1, top: true };
const carpet: FurnMeta = { fw: 3, fh: 2, flat: true };
const table: Record<string, FurnMeta> = { desk, bed, sofa, cup, carpet };
const ctx = (taken: { p: Placed; m: FurnMeta }[] = [], ignore?: number) => ({ box, meta: (k: string) => table[k], taken, ignore });

const at = (k: string, x: number, y: number, rot: 0 | 90 | 180 | 270 = 0): Placed => ({ k, x, y, rot });

describe('摆放规则', () => {
  it('可摆区域：北墙 3 格、东西南各 1 格都不算', () => {
    expect(placeArea(box)).toEqual({ x0: 1, y0: 3, x1: 14, y1: 9 });
  });

  it('旋转后的占地：床转 90° 宽高互换；没定义的角度不能转', () => {
    expect(footOf(bed, 0)).toEqual({ fw: 2, fh: 3 });
    expect(footOf(bed, 90)).toEqual({ fw: 3, fh: 2 });
    expect(footOf(bed, 180)).toBeNull();
  });

  it('桌面小件不占地，也不参与重叠判断', () => {
    expect(cellsOf(cup, at('cup', 5, 5))).toEqual([]);
    expect(checkPlace(ctx([{ p: at('desk', 5, 5), m: desk }]), at('cup', 5, 5)).ok).toBe(true);
  });

  it('门口两格 + 门前通道都不能压（南墙里面一行算起）', () => {
    const door = doorCells(box);
    expect(door.has('7,9')).toBe(true);
    expect(door.has('8,8')).toBe(true);
    expect(door.has('9,9')).toBe(false);
    // 3 格沙发横着摆在门口 → 挡门
    const r = checkPlace(ctx(), at('sofa', 7, 9));
    expect(r).toEqual({ ok: false, why: 'door' });
  });

  it('超出房间（贴墙 / 出界）要挡住，且理由能翻译成人话', () => {
    expect(checkPlace(ctx(), at('sofa', 13, 5)).why).toBe('out-of-room'); // 13+3-1=15 > 14
    expect(checkPlace(ctx(), at('desk', 0, 5)).why).toBe('out-of-room');  // 压西墙
    expect(checkPlace(ctx(), at('desk', 3, 2)).why).toBe('out-of-room');  // 压北墙
    expect(placeWhyText('out-of-room')).toContain('超出房间');
  });

  it('地毯不挡路：能压在别的东西下面，也能摆在门口', () => {
    expect(cellsOf(carpet, at('carpet', 5, 5))).toEqual([]);
    expect(checkPlace(ctx([{ p: at('desk', 5, 5), m: desk }]), at('carpet', 4, 5)).ok).toBe(true);
    expect(checkPlace(ctx(), at('carpet', 7, 8)).ok).toBe(true);   // 门口那块也能铺
    expect(checkPlace(ctx(), at('carpet', 14, 5)).why).toBe('out-of-room'); // 但不能出界
  });

  it('和已有家具重叠要挡住，并说出撞到谁了', () => {
    const r = checkPlace(ctx([{ p: at('desk', 4, 4), m: desk }]), at('bed', 4, 4));
    expect(r.ok).toBe(false);
    expect(r.why).toBe('overlap');
    expect(r.with).toBe('desk');
  });

  it('移动自己时跳过自身，不然永远和自己重叠', () => {
    const taken = [{ p: at('desk', 4, 4), m: desk }];
    expect(checkPlace(ctx(taken, 0), at('desk', 4, 4)).ok).toBe(true);
    expect(checkPlace(ctx(taken), at('desk', 4, 4)).ok).toBe(false);
  });

  it('鼠标像素 → 格：吸附到左上角那一格', () => {
    expect(snapTile(0, 0)).toEqual({ x: 0, y: 0 });
    expect(snapTile(15, 15)).toEqual({ x: 0, y: 0 });
    expect(snapTile(16, 31)).toEqual({ x: 1, y: 1 });
  });
});
