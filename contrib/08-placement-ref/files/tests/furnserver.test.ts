import { describe, expect, it } from 'vitest';
import { PlayerStore } from '../server/store';
import { Dorms } from '../server/dorm';
import { cleanDorm } from '../src/shared/dorm';
import { validateProfile } from '../src/shared/profile';

const profile = (validateProfile({ name: '测试', gender: 'm', look: 0, college: '机电工程学院', major: '机械设计制造', year: 2025, motto: '', cardNo: '2025000001' }) as { ok: true; profile: ReturnType<typeof validateProfile> extends { ok: true; profile: infer P } ? P : never }).profile;

function setup(coin = 1000) {
  const store = new PlayerStore(null);
  store.set('k1', { profile, x: 0, y: 0, uid: 1, coin } as never);
  const dorms = new Dorms(store, [{ name: '三社区B楼' }]);
  return { store, dorms };
}

describe('买家具 / 摆家具（服务端）', () => {
  it('买：扣校园币、进家具仓库；钱不够就整笔不成交', () => {
    const { store, dorms } = setup(1000);
    const r = dorms.buyFurn('k1', 'couch', 1);
    expect(r.ok).toBe(true);
    expect(store.get('k1')!.coin).toBe(1000 - 380);
    expect(dorms.own('k1')).toEqual({ couch: 1 });

    const poor = dorms.buyFurn('k1', 'fireplace', 1); // 900，只剩 620
    expect(poor.ok).toBe(false);
    expect(poor.msg).toContain('校园币不够');
    expect(store.get('k1')!.coin).toBe(620);            // 失败不扣钱

    expect(dorms.buyFurn('k1', '不存在', 1).ok).toBe(false);
    expect(dorms.buyFurn('k1', 'couch', 0).msg).toBeTruthy(); // n 兜底成 1，但钱不够了
  });

  it('摆：从仓库拿一件放到空地上；占地/门口/重叠都被挡住', () => {
    const { dorms } = setup(2000);
    dorms.buyFurn('k1', 'couch', 1);
    expect(dorms.placeFurn('k1', 'place', { k: 'couch', x: 3, y: 7, rot: 0 })).toEqual({ ok: true, msg: '摆好了：青绿沙发' });
    expect(dorms.own('k1')).toEqual({});                 // 仓库空了
    expect(dorms.placed('k1')).toEqual([{ k: 'couch', x: 3, y: 7, rot: 0 }]);

    expect(dorms.placeFurn('k1', 'place', { k: 'couch', x: 3, y: 8, rot: 0 }).msg).toContain('仓库里没有'); // 只有一件
    dorms.buyFurn('k1', 'couch', 1);
    expect(dorms.placeFurn('k1', 'place', { k: 'couch', x: 1, y: 4, rot: 0 }).msg).toContain('叠在一起');   // 压床
    expect(dorms.placeFurn('k1', 'place', { k: 'couch', x: 7, y: 9, rot: 0 }).msg).toContain('门口');       // 堵门
    expect(dorms.placeFurn('k1', 'place', { k: 'couch', x: 20, y: 7, rot: 0 }).msg).toContain('超出房间');
    expect(dorms.placed('k1').length).toBe(1);           // 都没摆进去
  });

  it('挪和收：挪到别处、收回来又回到仓库（可以再摆）', () => {
    const { dorms } = setup(2000);
    dorms.buyFurn('k1', 'rug', 1);
    dorms.placeFurn('k1', 'place', { k: 'rug', x: 3, y: 7, rot: 0 });
    expect(dorms.placeFurn('k1', 'move', { i: 0, x: 5, y: 7, rot: 90 })).toEqual({ ok: true, msg: '挪好了' });
    expect(dorms.placed('k1')[0]).toEqual({ k: 'rug', x: 5, y: 7, rot: 90 });

    expect(dorms.takeFurn('k1', 0).ok).toBe(true);
    expect(dorms.placed('k1')).toEqual([]);
    expect(dorms.own('k1')).toEqual({ rug: 1 });
    expect(dorms.takeFurn('k1', 0).ok).toBe(false);      // 已经没了
  });

  it('屋里最多摆 24 件：满了就拒绝（不再扣仓库）', () => {
    const { store, dorms } = setup(4000);
    // 直接塞满 24 件（跳过校验，专门测上限）
    store.get('k1')!.dm = { fr: Array.from({ length: 24 }, () => ({ k: 'splant', x: 2, y: 7, rot: 0 })) } as never;
    dorms.buyFurn('k1', 'splant', 1);
    const r = dorms.placeFurn('k1', 'place', { k: 'splant', x: 9, y: 7, rot: 0 });
    expect(r.ok).toBe(false);
    expect(r.msg).toContain('最多摆');
    expect(dorms.own('k1')).toEqual({ splant: 1 });   // 没摆出去，仓库还在
  });

  it('存档：家具字段能原样存回来（重启不丢）', () => {
    const { store, dorms } = setup(2000);
    dorms.buyFurn('k1', 'couch', 1);
    dorms.placeFurn('k1', 'place', { k: 'couch', x: 3, y: 7, rot: 0 });
    const saved = cleanDorm(JSON.parse(JSON.stringify(store.get('k1')!.dm)));
    expect(saved?.fr).toEqual([{ k: 'couch', x: 3, y: 7, rot: 0 }]);
    expect(saved?.fo).toBeUndefined();                    // 空的仓库不落盘
  });

  it('第一次打开宿舍送一套基础家具，只送一次', () => {
    const { store, dorms } = setup(50);
    const v1 = dorms.view('k1', 0);
    expect(Object.keys(v1.own).sort()).toEqual(['poster', 'rug', 'splant']);
    dorms.takeFurn('k1', 0);                       // 用户把送的收掉
    const v2 = dorms.view('k1', 0);
    expect(v2.own).toEqual(v1.own);                 // 不会又送一遍
    expect(store.get('k1')!.dm?.fgf).toBe(1);
  });

  it('dorm_data 里带上仓库和已摆（客户端/访客都用这份）', () => {
    const { dorms } = setup(2000);
    dorms.buyFurn('k1', 'shelf1', 1);                     // 不是家具：应该被拒
    dorms.buyFurn('k1', 'tvset', 1);
    dorms.placeFurn('k1', 'place', { k: 'tvset', x: 4, y: 7, rot: 0 });
    const v = dorms.view('k1', 0);
    expect(v.placed).toEqual([{ k: 'tvset', x: 4, y: 7, rot: 0 }]);
    expect(v.own).toEqual({});
  });
});
