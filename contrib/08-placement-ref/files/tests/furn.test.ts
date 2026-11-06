import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DORM_OWN_MAX, DORM_PLACED_MAX, DORM_STATIC, FURN_SHOP, cleanOwned, cleanPlaced, furnDef, furnMeta, ownedTotal, shopByCat } from '../src/shared/furn';
import { checkPlace } from '../src/shared/place';
import { DORM_ROOM } from '../src/shared/dorm';

const GEN = join(__dirname, '..', 'public', 'assets', 'generated');

describe('家具目录', () => {
  it('每件都有名字、分类、正的价格和合理的占地', () => {
    expect(FURN_SHOP.length).toBeGreaterThan(10);
    for (const f of FURN_SHOP) {
      expect(f.name, f.k).toBeTruthy();
      expect(f.price, f.k).toBeGreaterThan(0);
      expect(f.fw, f.k).toBeGreaterThanOrEqual(1);
      expect(f.fh, f.k).toBeGreaterThanOrEqual(0);   // 0 = 墙面挂件
      expect(f.fw * 16, f.k).toBeLessThanOrEqual(64); // 再宽就摆不进宿舍了
    }
    expect(new Set(FURN_SHOP.map((f) => f.k)).size).toBe(FURN_SHOP.length); // 不能重 key
    expect(shopByCat().reduce((n, g) => n + g.items.length, 0)).toBe(FURN_SHOP.length);
  });

  it('占地表要和编译出来的 furniture-meta.json 对得上（防止改了美术忘了改规则）', () => {
    const meta = JSON.parse(readFileSync(join(GEN, 'furniture-meta.json'), 'utf8')) as Record<string, { fw: number; fh: number; top?: boolean; flat?: boolean }>;
    for (const f of FURN_SHOP) {
      const m = meta[f.k];
      expect(m, `${f.k} 不在 furniture-meta.json 里（要先 npm run assets:interiors）`).toBeTruthy();
      expect([m.fw, m.fh], f.k).toEqual([f.fw, f.fh]);
      expect(!!m.top, `${f.k} top`).toBe(!!f.top);
      expect(!!m.flat, `${f.k} flat`).toBe(!!f.flat);
    }
  });

  it('宿舍自带的家具和 data/interiors/dorm.json 一致', () => {
    const dorm = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'interiors', 'dorm.json'), 'utf8')) as { furniture: { k: string; x: number; y: number }[] };
    const mine = DORM_STATIC.map((s) => `${s.k}@${s.x},${s.y}`).sort();
    const theirs = dorm.furniture.map((s) => `${s.k}@${s.x},${s.y}`).sort();
    expect(mine).toEqual(theirs);
    for (const s of DORM_STATIC) expect(furnMeta(s.k), s.k).toBeTruthy(); // 自带家具也要有占地数据
  });

  it('仓库/已摆数据的清洗：丢掉不认识的 key、越界坐标、负数', () => {
    expect(cleanOwned({ couch: 2, 不存在: 3, splant: -1, shoe: 1.7 })).toEqual({ couch: 2, shoe: 1 });
    expect(cleanOwned({ couch: 999 })).toEqual({ couch: DORM_OWN_MAX });
    expect(cleanPlaced([{ k: 'couch', x: 3, y: 7, rot: 90 }, { k: '不存在', x: 1, y: 1 }, { k: 'rug', x: -1, y: 2 }, { k: 'splant', x: 2.5, y: 3 }]))
      .toEqual([{ k: 'couch', x: 3, y: 7, rot: 90 }]);
    expect(cleanPlaced(new Array(DORM_PLACED_MAX + 5).fill({ k: 'splant', x: 2, y: 7, rot: 0 })).length).toBe(DORM_PLACED_MAX);
    expect(ownedTotal({ couch: 2, splant: 3 })).toBe(5);
  });
});

describe('部署到宿舍：规则真的拦得住', () => {
  const box = { w: DORM_ROOM.w, h: DORM_ROOM.h, exit: { x: DORM_ROOM.exitX, w: DORM_ROOM.exitW } };
  const taken = DORM_STATIC.map((s) => ({ p: { k: s.k, x: s.x, y: s.y, rot: 0 as const }, m: furnMeta(s.k)! }));
  const tryAt = (k: string, x: number, y: number, rot: 0 | 90 | 180 | 270 = 0) => checkPlace({ box, meta: furnMeta, taken }, { k, x, y, rot });

  it('空地上能摆', () => {
    expect(tryAt('couch', 3, 7).ok).toBe(true);   // 沙发 3×1，y=7 是空的
    expect(tryAt('rug', 4, 7).ok).toBe(true);
  });

  it('压在床上 / 桌子上要挡住', () => {
    expect(tryAt('couch', 1, 4).why).toBe('overlap');   // 床在 (1,3) 2×3
    expect(tryAt('shoe', 6, 3).why).toBe('overlap');    // 桌子在 (6,3) 2×1
    expect(tryAt('splant', 6, 3).ok).toBe(true);       // 桌面小件不占地，压在桌上也行
  });

  it('堵门口要挡住，地毯除外', () => {
    expect(tryAt('couch', 7, 9).why).toBe('door');
    expect(tryAt('rug', 7, 8).ok).toBe(true);
  });

  it('墙面挂件挂在北墙、按排占格', () => {
    expect(tryAt('poster', 12, 1).ok).toBe(true);
    expect(tryAt('poster', 11, 2).why).toBe('overlap');       // 宿舍自带海报在 (11,2)
    expect(tryAt('poster', 5, 6).why).toBe('out-of-room');    // 挂不到屋子中间
    expect(tryAt('wallclock', 30, 1).why).toBe('out-of-room');
  });

  it('旋转后宽高互换：3×1 的沙发转 90° 就占 3 行', () => {
    expect(furnMeta('couch')!.rots![90]).toMatchObject({ fw: 1, fh: 3 });
    expect(tryAt('couch', 7, 7, 90).why).toBe('door');        // 竖着占 y7~9，正好压住门口的通道
  });
});
