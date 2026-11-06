import { describe, it, expect } from 'vitest';
import { cleanInv, invAdd, invList, invTake, ITEMS, itemDef } from '../src/shared/items';
import { decodeBackup, encodeBackup } from '../src/shared/backup';
import { CAT_COUNT, LEVEL_AT, catLevel, catNext, cleanCats, genCats } from '../src/shared/cats';
import { DAILY_FOOD, Progress, dayNo } from '../server/progress';
import { PlayerStore } from '../server/store';
import { validateProfile } from '../src/shared/profile';

describe('背包', () => {
  it('放入/拿走：受堆叠上限限制，不够就一个也不拿', () => {
    const stack = itemDef('cat_food')!.stack; // 单格上限（现在是 999，只有同类真的堆满了才放不下）
    const inv = {};
    expect(invAdd(inv, 'cat_food', 5)).toBe(5);
    expect(invAdd(inv, 'cat_food', stack + 100)).toBe(stack - 5); // 只放下剩下的空间
    expect(inv).toEqual({ cat_food: stack });
    expect(invTake(inv, 'cat_food', stack + 1)).toBe(false);
    expect(inv).toEqual({ cat_food: stack });
    expect(invTake(inv, 'cat_food', stack)).toBe(true);
    expect(inv).toEqual({}); // 拿空了就从背包里消失
  });
  it('关键物品堆叠上限是 1；不认识的物品、非法数量一律拒绝', () => {
    const inv = {};
    expect(invAdd(inv, 'cat_badge', 3)).toBe(1);
    expect(invAdd(inv, 'cat_badge', 1)).toBe(0);
    expect(invAdd(inv, 'no_such_item', 1)).toBe(0);
    expect(invAdd(inv, 'cat_food', -1)).toBe(0);
    expect(invAdd(inv, 'cat_food', 1.5)).toBe(0);
    expect(invTake(inv, 'cat_food', 0)).toBe(false);
  });
  it('cleanInv 只保留认识的物品并收敛数量', () => {
    expect(cleanInv({ cat_food: 5000, cat_treat: -2, ginkgo_leaf: 3.7, bogus: 9, cat_badge: 'x' })).toEqual({ cat_food: itemDef('cat_food')!.stack, ginkgo_leaf: 3 });
    expect(cleanInv(null)).toEqual({});
    expect(cleanInv([1, 2])).toEqual({});
  });
  it('invList 按目录顺序排', () => {
    const inv = { cat_badge: 1, cat_food: 2 };
    expect(invList(inv).map((x) => x.def.id)).toEqual(['cat_food', 'cat_badge']);
    expect(ITEMS.every((d) => d.name && d.desc && d.stack >= 1)).toBe(true);
  });
});

describe('身份备份码', () => {
  const tok = '0123456789abcdef0123456789abcdef0123456789abcdef';
  it('往返：十六进制 token 与其他合法 token 都能还原', () => {
    const code = encodeBackup(tok)!;
    expect(code).toMatch(/^PX-([0-9A-Z]{5}-){8}[0-9A-Z]{1,5}$/);
    expect(decodeBackup(code)).toBe(tok);
    const other = 'Abc_def-GHI123456789xyz';
    expect(decodeBackup(encodeBackup(other)!)).toBe(other);
  });
  it('大小写、空格、连字符、O/0 I/L/1 混淆都能容忍', () => {
    const code = encodeBackup(tok)!;
    expect(decodeBackup(code.toLowerCase())).toBe(tok);
    expect(decodeBackup(code.replace(/-/g, ' '))).toBe(tok);
    expect(decodeBackup(code.replace(/-/g, ''))).toBe(tok);
    expect(decodeBackup(`  ${code}\n`)).toBe(tok);
    expect(decodeBackup(code.replace(/0/g, 'O').replace(/1/g, 'l'))).toBe(tok);
  });
  it('抄错一个字符、少一段、乱输入都识别不出', () => {
    const code = encodeBackup(tok)!, i = code.indexOf('-') + 3;
    const bad = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
    expect(decodeBackup(bad)).toBeNull();
    expect(decodeBackup(code.slice(0, -6))).toBeNull();
    expect(decodeBackup('')).toBeNull();
    expect(decodeBackup('hello world')).toBeNull();
    expect(decodeBackup('PX-')).toBeNull();
  });
  it('不合法的 token 编不出码；所有随机 token 的码互不相同且能还原', () => {
    expect(encodeBackup('short')).toBeNull();
    const seen = new Set<string>();
    for (let n = 0; n < 200; n++) {
      const t = Array.from({ length: 48 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
      const c = encodeBackup(t)!; seen.add(c);
      expect(decodeBackup(c)).toBe(t);
    }
    expect(seen.size).toBe(200);
  });
});

describe('校园小猫', () => {
  const pts: [number, number][] = Array.from({ length: 640 }, (_, i) => [10 + (i % 32) * 20, 10 + Math.floor(i / 32) * 25]);
  it('同样的出生点永远生成同样的猫（服务器和客户端一致）', () => {
    const a = genCats(pts), b = genCats(pts);
    expect(a).toEqual(b);
    expect(a.length).toBe(CAT_COUNT);
    expect(new Set(a.map((c) => c.name)).size).toBe(a.length); // 名字不重复
  });
  it('猫的家彼此分开，且都在出生点上', () => {
    const cats = genCats(pts);
    const ok = new Set(pts.map(([x, y]) => `${x * 16},${y * 16}`));
    expect(cats.every((c) => ok.has(`${c.hx},${c.hy}`))).toBe(true);
    let min = Infinity;
    for (const a of cats) for (const b of cats) if (a !== b) min = Math.min(min, Math.hypot(a.hx - b.hx, a.hy - b.hy) / 16);
    expect(min).toBeGreaterThanOrEqual(10);
  });
  it('出生点太少/没有也不会出错', () => {
    expect(genCats([])).toEqual([]);
    expect(genCats([[5, 5], [6, 6]]).length).toBe(2);
  });
  it('好感度档位', () => {
    expect([0, 3, 4, 11, 12, 29, 30, 79, 80, 999].map(catLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
    expect(catNext(0)).toBe(LEVEL_AT[1]); expect(catNext(30)).toBe(50); expect(catNext(80)).toBe(0); // 满档（挚友）才是 0
    expect(cleanCats({ '3': 5.9, x: 1, '1000': 4, '7': -1, '2': 99999 })).toEqual({ '3': 5, '2': 9999 });
  });
});

describe('玩家进度（服务器规则）', () => {
  const prof = () => { const r = validateProfile({ gender: 'f', look: 1, name: '测试', college: '机电学院', major: '机械设计', year: 2024 }); if (!r.ok) throw new Error(r.error); return r.profile; };
  const setup = () => {
    const store = new PlayerStore(null);
    store.set('k1', { profile: prof(), seen: 0 });
    const cats = genCats(Array.from({ length: 200 }, (_, i) => [5 + (i % 20) * 12, 5 + Math.floor(i / 20) * 12] as [number, number]), 5);
    let rnd = 0.99; // 默认不触发随机回赠
    const pg = new Progress(store, cats, () => rnd);
    return { store, pg, cats, setRnd: (v: number) => { rnd = v; } };
  };
  const T0 = Date.UTC(2026, 10, 1, 4, 0, 0); // 北京时间 11-01 12:00

  it('每日补给：每天第一次补猫粮到 5 包，同一天不重复，换日再补', () => {
    const { pg } = setup();
    expect(pg.dailySupply('k1', T0)).toEqual([{ id: 'cat_food', n: DAILY_FOOD }]);
    expect(pg.dailySupply('k1', T0 + 3600e3)).toEqual([]);
    pg.take('k1', 'cat_food', 3);
    expect(pg.dailySupply('k1', T0 + 3600e3)).toEqual([]); // 还是同一天
    const next = T0 + 24 * 3600e3;
    expect(dayNo(next)).toBe(dayNo(T0) + 1);
    expect(pg.dailySupply('k1', next)).toEqual([{ id: 'cat_food', n: 3 }]); // 补回 5 包
    expect(pg.inv('k1').cat_food).toBe(5);
    pg.grant('k1', 'cat_food', 20);
    expect(pg.dailySupply('k1', next + 24 * 3600e3)).toEqual([]); // 已经多于 5 包就不补
  });
  it('换日以北京时间 0 点为界', () => {
    expect(dayNo(Date.UTC(2026, 10, 1, 15, 59))).toBe(dayNo(Date.UTC(2026, 10, 1, 0, 0)));
    expect(dayNo(Date.UTC(2026, 10, 1, 16, 0))).toBe(dayNo(Date.UTC(2026, 10, 1, 0, 0)) + 1);
  });
  it('摸猫：要在猫附近、有冷却、好感度 +1', () => {
    const { pg, cats } = setup(), c = cats[0];
    expect(pg.pet('k1', 0, c.hx + 500, c.hy, T0).ok).toBe(false); // 太远
    const r1 = pg.pet('k1', 0, c.hx + 20, c.hy, T0);
    expect(r1).toMatchObject({ ok: true, aff: 1, level: 0 });
    expect(pg.pet('k1', 0, c.hx, c.hy, T0 + 1000).ok).toBe(false); // 冷却中
    expect(pg.pet('k1', 0, c.hx, c.hy, T0 + 7000)).toMatchObject({ ok: true, aff: 2 });
    expect(pg.pet('k1', 99, c.hx, c.hy, T0).ok).toBe(false); // 没这只猫
  });
  it('喂猫：消耗物品、没有就不能喂、有冷却；升到"熟悉"得猫条', () => {
    const { pg, cats } = setup(), c = cats[1];
    pg.grant('k1', 'cat_food', 2);
    const r = pg.feed('k1', 1, 'cat_food', c.hx, c.hy, T0);
    expect(r).toMatchObject({ ok: true, aff: 3 });
    expect(pg.inv('k1').cat_food).toBe(1);
    expect(pg.feed('k1', 1, 'cat_food', c.hx, c.hy, T0 + 1000).ok).toBe(false);
    expect(pg.inv('k1').cat_food).toBe(1); // 冷却中失败不扣东西
    expect(pg.feed('k1', 1, 'cat_treat', c.hx, c.hy, T0 + 25000).ok).toBe(false); // 没有猫条
    expect(pg.feed('k1', 1, 'fish', c.hx, c.hy, T0 + 25000).ok).toBe(false); // 不认识的食物
    const r2 = pg.feed('k1', 1, 'cat_food', c.hx, c.hy, T0 + 50000); // 3+3 = 6，升到"眼熟"
    expect(r2).toMatchObject({ ok: true, aff: 6, level: 1, leveled: true });
    expect(pg.inv('k1').cat_food).toBeUndefined();
  });
  it('好感度一路升到"亲密"：猫条 + 爱猫徽章（徽章只有一枚）', () => {
    const { pg, cats, store } = setup(), c = cats[2];
    store.get('k1')!.cats = { '2': 28 }; // 离"亲密"(30) 差 2
    pg.grant('k1', 'cat_food', 1);
    const r = pg.feed('k1', 2, 'cat_food', c.hx, c.hy, T0); // +3 → 31
    expect(r.level).toBe(3); expect(r.leveled).toBe(true);
    expect(r.gifts).toEqual(expect.arrayContaining([{ id: 'cat_treat', n: 2 }, { id: 'cat_badge', n: 1 }]));
    expect(pg.inv('k1')).toMatchObject({ cat_treat: 2, cat_badge: 1 });
    // 换一只猫也升到亲密：猫条再来 2 根，徽章已有，不重复
    const c2 = cats[3]; store.get('k1')!.cats!['3'] = 29; pg.grant('k1', 'cat_food', 1);
    const r2 = pg.feed('k1', 3, 'cat_food', c2.hx, c2.hy, T0 + 100000);
    expect(r2.gifts.filter((g) => g.id === 'cat_badge')).toEqual([]);
    expect(pg.inv('k1').cat_badge).toBe(1);
    expect(pg.inv('k1').cat_treat).toBe(4);
  });
  it('熟悉的小猫投喂时可能回赠银杏叶；陌生的不会', () => {
    const { pg, cats, store, setRnd } = setup(), c = cats[0];
    setRnd(0); // 一定触发
    pg.grant('k1', 'cat_food', 2);
    expect(pg.feed('k1', 0, 'cat_food', c.hx, c.hy, T0).gifts).toEqual([]); // 好感 3 → 仍是陌生
    store.get('k1')!.cats = { '0': 5 };
    expect(pg.feed('k1', 0, 'cat_food', c.hx, c.hy, T0 + 30000).gifts).toEqual([{ id: 'ginkgo_leaf', n: 1 }]);
  });
  it('背包与好感度会被存下来、读回来', async () => {
    const { mkdtempSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
    const file = join(mkdtempSync(join(tmpdir(), 'px-')), 'players.json');
    const a = new PlayerStore(file); a.set('k1', { profile: prof(), seen: 1 });
    const pg = new Progress(a, [], () => 0.5);
    pg.grant('k1', 'cat_treat', 4); pg.dailySupply('k1', T0); a.get('k1')!.cats = { '1': 7 }; a.touch();
    a.set('k1', { profile: prof(), x: 10, y: 20, seen: 2 }); // 位置更新不能冲掉背包
    a.flush();
    const b = new PlayerStore(file), s = b.get('k1')!;
    expect(s.inv).toEqual({ cat_treat: 4, cat_food: 5 });
    expect(s.cats).toEqual({ '1': 7 });
    expect(s.sup).toBe(dayNo(T0));
  });
});

describe('校门口的单车与图书馆门口的猫', async () => {
  const { allCats, genCats, CAT_COUNT, NEW_CAT_COUNT, NEW_COAT_FIRST } = await import('../src/shared/cats');
  const { gateBikes } = await import('../src/shared/bikes');
  const { existsSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { GEN } = await import('../tools/paths.ts');
  const { WorldMap } = await import('../src/world/WorldMap');
  const file = join(GEN, 'world.json');
  const world = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;

  it('校门口共 20 辆，位置各不相同、两侧各 10 辆', () => {
    const b = gateBikes();
    expect(b.length).toBe(20);
    expect(new Set(b.map((s) => `${s.x},${s.y}`)).size).toBe(20);
    expect(b.filter((s) => s.x < 360 * 16).length).toBe(10);
  });
  it('图书馆门口 4 只猫排在随机猫之后，编号连续、名字不重复；没有世界数据时仍是空的', () => {
    const pts: [number, number][] = Array.from({ length: 640 }, (_, i) => [10 + (i % 32) * 20, 10 + Math.floor(i / 32) * 25]);
    const cats = allCats(pts);
    expect(cats.length).toBe(CAT_COUNT + 4 + NEW_CAT_COUNT);
    expect(cats.map((c) => c.id)).toEqual(cats.map((_, i) => i));
    expect(new Set(cats.map((c) => c.name)).size).toBe(cats.length);
    expect(cats.slice(0, CAT_COUNT)).toEqual(genCats(pts)); // 原来的猫（和好感度编号）不受影响
    expect(allCats([])).toEqual([]);
  });
  it('第二批毛色的新猫：每种新毛色一只、编号在图书馆猫之后；老猫的毛色冻结（28–31 号是 白/黑/三花/橘）', () => {
    const pts: [number, number][] = Array.from({ length: 640 }, (_, i) => [10 + (i % 32) * 20, 10 + Math.floor(i / 32) * 25]);
    const cats = allCats(pts), fresh = cats.slice(CAT_COUNT + 4);
    expect(fresh.map((c) => c.coat)).toEqual(Array.from({ length: NEW_CAT_COUNT }, (_, k) => NEW_COAT_FIRST + k));
    expect(cats.slice(CAT_COUNT, CAT_COUNT + 4).map((c) => c.coat)).toEqual([2, 1, 3, 0]);
    expect(cats.slice(0, CAT_COUNT).every((c) => c.coat >= 0 && c.coat < NEW_COAT_FIRST)).toBe(true);   // 随机分布的猫永远只有前 6 种毛色
    expect(allCats(pts)).toEqual(cats);                                                               // 确定性
  });
  it.skipIf(!world)('真实地图上：新猫的家都在可走的地方，且彼此、与老猫分开', () => {
    const map = new WorldMap(world), cats = allCats(world.npcSpawns), fresh = cats.slice(CAT_COUNT + 4);
    expect(fresh.length).toBe(NEW_CAT_COUNT);
    for (const c of fresh) expect(map.boxBlocked(c.hx, c.hy), `猫 ${c.name}`).toBe(false);
    for (const c of fresh) expect(cats.filter((o) => o.id !== c.id && Math.hypot(o.hx - c.hx, o.hy - c.hy) < 4 * 16).length, `猫 ${c.name} 离别的猫太近`).toBe(0);
  });
  it.skipIf(!world)('真实地图上：停放点和猫的家都在可走的地方，猫家在图书馆正门附近', () => {
    const map = new WorldMap(world);
    for (const s of gateBikes()) expect(map.boxBlocked(s.x, s.y), `单车 ${s.x},${s.y}`).toBe(false);
    const lib = allCats(world.npcSpawns).slice(CAT_COUNT, CAT_COUNT + 4);
    const door = world.buildings.find((b: { id: string }) => b.id === 'library').doors[0];
    for (const c of lib) {
      expect(map.boxBlocked(c.hx, c.hy), c.name).toBe(false);
      expect(Math.hypot(c.hx / 16 - (door.x + door.w / 2), c.hy / 16 - door.y)).toBeLessThan(10);
    }
  });
});

describe('成就', async () => {
  const { ACHIEVEMENTS, ACH_TOTAL, cleanAch, isUnlockable, isAchEvent } = await import('../src/shared/achievements');
  const prof = () => { const r = validateProfile({ gender: 'f', look: 1, name: '测试', college: '机电学院', major: '机械设计', year: 2024 }); if (!r.ok) throw new Error(r.error); return r.profile; };

  it('目录：前两个是「进入校园」「真正的河北工程」，占位排在最后；id 不重复；占位不能解锁', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENTS.slice(0, 2).map((a) => a.name)).toEqual(['进入校园', '真正的河北工程']);
    expect(ACH_TOTAL).toBe(ACHIEVEMENTS.filter((a) => !a.placeholder).length);
    expect(ACHIEVEMENTS.filter((a) => a.placeholder).every((a) => ACHIEVEMENTS.indexOf(a) >= ACH_TOTAL)).toBe(true);
    expect(isUnlockable('enter_campus')).toBe(true);
    expect(isUnlockable('soon_1')).toBe(false);
    expect(isUnlockable('nope')).toBe(false);
    expect(ACHIEVEMENTS.every((a) => a.hint && (a.placeholder || a.desc))).toBe(true);
  });
  it('cleanAch 只留可解锁的成就和合法时间；事件白名单', () => {
    expect(cleanAch({ enter_campus: 123.9, soon_1: 5, bogus: 5, real_hebei: -1, x: 'y' })).toEqual({ enter_campus: 123 });
    expect(cleanAch(null)).toEqual({});
    expect(isAchEvent('egg_done')).toBe(true); expect(isAchEvent('give_me_everything')).toBe(false);
  });
  it('解锁：第一次返回 true，重复/占位/未知返回 false，且会落盘重读', async () => {
    const { mkdtempSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
    const file = join(mkdtempSync(join(tmpdir(), 'px-')), 'players.json');
    const a = new PlayerStore(file); a.set('k1', { profile: prof(), seen: 1 });
    const pg = new Progress(a, []);
    expect(pg.unlock('k1', 'enter_campus', 1000)).toBe(true);
    expect(pg.unlock('k1', 'enter_campus', 2000)).toBe(false);
    expect(pg.unlock('k1', 'soon_1', 2000)).toBe(false);
    expect(pg.unlock('k1', 'bogus', 2000)).toBe(false);
    expect(pg.unlock('nobody', 'enter_campus', 2000)).toBe(false);
    expect(pg.achievements('k1')).toEqual({ enter_campus: 1000 }); // 保留第一次的时间
    expect(pg.titles('k1')).toEqual({ own: { freshman: 1000 }, sel: 'freshman' }); // 成就附带的称号一起发，并自动佩戴
    a.set('k1', { profile: prof(), x: 1, y: 2, seen: 3 }); a.flush(); // 位置更新不能冲掉成就
    expect(new PlayerStore(file).get('k1')!.ach).toEqual({ enter_campus: 1000 });
  });
});


describe('称号', async () => {
  const { TITLES, titleDef, isOwnable, cleanTitles } = await import('../src/shared/titles');
  const { ACHIEVEMENTS } = await import('../src/shared/achievements');
  const prof = () => { const r = validateProfile({ gender: 'f', look: 1, name: '测试', college: '机电学院', major: '机械设计', year: 2024 }); if (!r.ok) throw new Error(r.error); return r.profile; };

  it('目录：id 不重复；成就上写的称号都存在；管理员称号是特殊的、不能进档案', () => {
    expect(new Set(TITLES.map((t) => t.id)).size).toBe(TITLES.length);
    for (const a of ACHIEVEMENTS) if (a.title) expect(titleDef(a.title), a.id).toBeTruthy();
    expect(isOwnable('freshman')).toBe(true); expect(isOwnable('admin')).toBe(false); expect(isOwnable('nope')).toBe(false);
    expect(cleanTitles({ freshman: 5.9, admin: 5, nope: 5, runner: -1, angler: 'x' })).toEqual({ freshman: 5 });
  });
  it('发放/佩戴：第一个自动佩戴；只能戴有的；空字符串取消；管理员称号只有管理员能戴；老成就补发称号', () => {
    const store = new PlayerStore(null); store.set('k', { profile: prof(), seen: 1, ach: { real_hebei: 5, enter_campus: 4 } });
    const pg = new Progress(store, []);
    expect(pg.titles('k')).toEqual({ own: {}, sel: '' });
    expect(pg.syncTitles('k', 100).sort()).toEqual(['freshman', 'real_hebei']);
    expect(pg.titles('k').sel).toBeTruthy();
    expect(pg.syncTitles('k', 200)).toEqual([]); // 不重复补发
    expect(pg.grantTitle('k', 'runner', 300)).toBe(true); expect(pg.grantTitle('k', 'runner', 400)).toBe(false);
    expect(pg.grantTitle('k', 'admin', 500)).toBe(false);
    expect(pg.setTitle('k', 'runner')).toBe(true); expect(pg.titles('k').sel).toBe('runner');
    expect(pg.setTitle('k', 'angler')).toBe(false); expect(pg.titles('k').sel).toBe('runner');
    expect(pg.setTitle('k', 'admin')).toBe(false); expect(pg.setTitle('k', 'admin', true)).toBe(true);
    expect(pg.setTitle('k', '')).toBe(true); expect(pg.titles('k').sel).toBe('');
  });
});


describe('长椅座位', async () => {
  const { readFileSync } = await import('node:fs');
  const { WorldMap } = await import('../src/world/WorldMap');
  const { seatSpots, nearestSeat } = await import('../src/shared/seats');
  const { EMOTES, emoteDef } = await import('../src/shared/emotes');
  const { packFlags, unpackFlags, FLAG_SIT } = await import('../src/shared/protocol');

  it('座位在长椅正南面第一处可站的位置；重复长椅合并；被堵死的长椅没有座位', () => {
    const blocked = (x: number, y: number) => y < 410; // 410 以北都是障碍
    const spots = seatSpots([{ x: 100, y: 405 }, { x: 100.2, y: 405.1 }, { x: 300, y: 100 }], { boxBlocked: blocked });
    expect(spots).toHaveLength(1);
    expect(spots[0]).toMatchObject({ bx: 100, by: 405, x: 100, y: 411 });
    expect(nearestSeat(spots, 104, 414, 26)).toBe(spots[0]);
    expect(nearestSeat(spots, 200, 414, 26)).toBeUndefined();
  });
  it('真实地图：每个座位都是合法位置，数量可观', () => {
    const world = JSON.parse(readFileSync(new URL('../public/assets/generated/world.json', import.meta.url), 'utf8'));
    const map = new WorldMap(world);
    const seats = seatSpots(world.objects.filter((o: { k: string }) => o.k === 'bench'), map);
    expect(seats.length).toBeGreaterThan(100);
    for (const s of seats) { expect(map.boxBlocked(s.x, s.y)).toBe(false); expect(Math.hypot(s.x - s.bx, s.y - s.by)).toBeLessThanOrEqual(20); }
  });
  it('表情编号稳定且连续；坐姿位进出 flags', () => {
    expect(EMOTES.every((e, i) => e.id === i && e.icon && e.name)).toBe(true);
    expect(emoteDef(4)?.anim).toBe('dance'); expect(emoteDef(99)).toBeUndefined(); expect(emoteDef(1.5)).toBeUndefined();
    const f = packFlags('down', true, true, false, true);
    expect(f & FLAG_SIT).toBe(FLAG_SIT);
    expect(unpackFlags(f)).toMatchObject({ sit: true, moving: false, run: false, ride: false }); // 坐着不会同时在移动/奔跑
  });
});


describe('背景音乐作曲', async () => {
  const { composeBar, MOODS, midiHz, barSeconds } = await import('../src/audio/compose');
  const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  it('同样的随机数 → 同样的音符；每个音符的拍位、时长、音高都在合理范围内', () => {
    for (const mood of ['day', 'night'] as const) {
      const a = composeBar(seeded(7), mood, 3), b = composeBar(seeded(7), mood, 3);
      expect(a).toEqual(b);
      for (let bar = 0; bar < 40; bar++) {
        const r = composeBar(seeded(bar + 1), mood, bar);
        for (const n of r.notes) {
          expect(n.at).toBeGreaterThanOrEqual(0); expect(n.at).toBeLessThan(4);
          expect(n.dur).toBeGreaterThan(0); expect(n.midi).toBeGreaterThanOrEqual(24); expect(n.midi).toBeLessThanOrEqual(96);
          expect(n.vel).toBeGreaterThan(0); expect(n.vel).toBeLessThanOrEqual(1);
        }
        expect(r.notes.filter((n) => n.voice === 'pad')).toHaveLength(3);
        expect(r.notes.filter((n) => n.voice === 'bass').length).toBe(2);
      }
    }
  });
  it('旋律音都落在该心情的五声音阶里（怎么拼都不会不和谐）；夜晚比白天慢；音高换算正确', () => {
    for (const mood of ['day', 'night'] as const) {
      const m = MOODS[mood], inScale = new Set(m.scale.map((d) => (((m.root + d) % 12) + 12) % 12));
      for (let bar = 0; bar < 60; bar++) for (const n of composeBar(seeded(bar * 3 + 1), mood, bar).notes) if (n.voice === 'lead') expect(inScale.has(n.midi % 12), `${mood} ${n.midi}`).toBe(true);
    }
    expect(barSeconds('night')).toBeGreaterThan(barSeconds('day'));
    expect(midiHz(69)).toBeCloseTo(440, 5); expect(midiHz(81)).toBeCloseTo(880, 5);
  });
});


describe('每日任务', async () => {
  const { dailyQuests, FIXED_QUESTS, QUEST_POOL, POOL_PICKS, questDef, cleanQuestSave, VISIT_SPOTS } = await import('../src/shared/quests');
  const { itemDef } = await import('../src/shared/items');
  const prof = () => { const r = validateProfile({ gender: 'f', look: 1, name: '测试', college: '机电学院', major: '机械设计', year: 2024 }); if (!r.ok) throw new Error(r.error); return r.profile; };
  const DAY = 1000 * 3600 * 24, T0 = Date.UTC(2026, 10, 2, 0, 0, 0) - 8 * 3600e3 + 3600e3; // 北京时间 2026-11-02 01:00

  it('目录：id 不重复；奖励物品都存在；事件名合法；每天 = 固定 2 个 + 池里抽 3 个，同一天永远一样、不同天不全一样', () => {
    const all = [...FIXED_QUESTS, ...QUEST_POOL];
    expect(new Set(all.map((q) => q.id)).size).toBe(all.length);
    for (const q of all) { expect(q.goal).toBeGreaterThan(0); for (const r of q.reward) { expect(itemDef(r.id), `${q.id}→${r.id}`).toBeTruthy(); expect(r.n).toBeGreaterThan(0); } }
    for (const v of VISIT_SPOTS) expect(QUEST_POOL.some((q) => q.ev === v.ev), v.ev).toBe(true);
    const d = dailyQuests(20000);
    expect(d).toHaveLength(FIXED_QUESTS.length + POOL_PICKS);
    expect(d.slice(0, FIXED_QUESTS.length)).toEqual([...FIXED_QUESTS]);
    expect(new Set(d.map((q) => q.id)).size).toBe(d.length);
    expect(dailyQuests(20000)).toEqual(d);
    const sets = new Set(Array.from({ length: 30 }, (_, i) => dailyQuests(20000 + i).slice(2).map((q) => q.id).sort().join()));
    expect(sets.size).toBeGreaterThan(5);
    expect(questDef('login')?.reward.some((r) => r.id === 'fishing_rod')).toBe(true); // 登录礼包含鱼竿
  });
  it('进度：事件推进、完成自动发奖励（鱼竿只给一次）；换日重置；全做完当天只记一次累计天数', () => {
    const store = new PlayerStore(null); store.set('k', { profile: prof(), seen: 1 });
    const pg = new Progress(store, []);
    const login = pg.questEvent('k', 'login', 1, T0);
    expect(login.changed).toBe(true); expect(login.done.map((q) => q.id)).toEqual(['login']);
    expect(login.gains).toEqual(expect.arrayContaining([{ id: 'bait', n: 5 }, { id: 'cat_treat', n: 1 }, { id: 'fishing_rod', n: 1 }]));
    expect(pg.questEvent('k', 'login', 1, T0 + 5).changed).toBe(false); // 同一天不重复
    const tomorrow = pg.questEvent('k', 'login', 1, T0 + DAY);
    expect(tomorrow.gains.some((g) => g.id === 'fishing_rod')).toBe(false); // 已经有鱼竿了
    expect(tomorrow.gains.find((g) => g.id === 'bait')?.n).toBe(5);
    expect(pg.inv('k').bait).toBe(10);

    // 在线时间：分次累计到 600
    let r = pg.questEvent('k', 'online', 300, T0 + DAY); expect(r.done).toEqual([]); expect(pg.quests('k', T0 + DAY).list.find((q) => q.id === 'online')?.prog).toBe(300);
    r = pg.questEvent('k', 'online', 300, T0 + DAY); expect(r.done.map((q) => q.id)).toEqual(['online']);
    // 把今天抽到的 3 个池任务都做完 → allDone，累计 +1；再触发不会重复累计
    const day = Math.floor((T0 + DAY + 8 * 3600e3) / DAY);
    let all = false;
    for (const q of dailyQuests(day).slice(2)) { const x = pg.questEvent('k', q.ev, q.goal, T0 + DAY); all = all || x.allDone; }
    expect(all).toBe(true);
    expect(pg.quests('k', T0 + DAY).full).toBe(1);
    pg.questEvent('k', dailyQuests(day)[2].ev, 99, T0 + DAY);
    expect(pg.quests('k', T0 + DAY).full).toBe(1);
    // 换日：进度清零，累计天数保留
    const next = pg.quests('k', T0 + 2 * DAY);
    expect(next.list.every((q) => !q.done && q.prog === 0)).toBe(true); expect(next.full).toBe(1);
    expect(pg.hasOpenQuest('k', 'login', T0 + 2 * DAY)).toBe(true); expect(pg.hasOpenQuest('k', 'login', T0 + 2 * DAY - 0)).toBe(true);
    expect(pg.questEvent('nobody', 'login', 1, T0).changed).toBe(false);
  });
  it('cleanQuestSave 只留认识的任务和合法数值', () => {
    expect(cleanQuestSave({ day: 5, prog: { login: 1.9, nope: 3, pet: -1 }, done: ['login', 'login', 'zzz', 7] })).toEqual({ day: 5, prog: { login: 1 }, done: ['login'] });
    expect(cleanQuestSave({ prog: {} })).toBeUndefined(); expect(cleanQuestSave(null)).toBeUndefined();
  });
});

describe('钓鱼目录', async () => {
  const { FISH, REAL_FISH, rollFish, cleanFishLog, isFish, fishDef, FISHING, castTarget } = await import('../src/shared/fishing');
  const { itemDef } = await import('../src/shared/items');
  const { ICONS } = await import('../tools/art/items');
  const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  it('每种鱼都有同名物品和图标；鱼竿/鱼饵/杂物也有；真鱼 27 种、5 档稀有度', () => {
    for (const f of FISH) { expect(itemDef(f.id), f.id).toBeTruthy(); expect(ICONS[f.id], f.id).toBeTruthy(); }
    for (const id of ['fishing_rod', 'bait']) { expect(itemDef(id), id).toBeTruthy(); expect(ICONS[id], id).toBeTruthy(); }
    expect(REAL_FISH.length).toBe(27); expect(isFish('fish_koi')).toBe(true); expect(isFish('junk_boot')).toBe(false); expect(fishDef('nope')).toBeUndefined();
    const by = (r: string) => FISH.filter((f) => f.rarity === r).length;
    expect([by('common'), by('uncommon'), by('rare'), by('epic'), by('legendary'), by('junk')]).toEqual([6, 6, 6, 5, 4, 4]);
    for (const f of REAL_FISH) { expect(f.minCm! < f.maxCm!, f.id).toBe(true); expect(f.maxKg, f.id).toBeGreaterThan(0); expect(['smooth', 'mixed', 'dart']).toContain(f.move); }
  });
  it('抽鱼：尺寸在范围内、杂物没有尺寸、越稀有越少；夜里黑鱼/鲶鱼更多；下雨泥鳅更多；冰湖银鱼王只在冬天', () => {
    const rnd = seeded(42), n = 60000, count: Record<string, number> = {}; let nightSnake = 0, daySnake = 0;
    for (let i = 0; i < n; i++) {
      const r = rollFish(rnd, { night: i % 2 === 0, season: 'autumn' }); count[r.def.id] = (count[r.def.id] ?? 0) + 1;
      if (r.def.minCm !== undefined) { expect(r.cm).toBeGreaterThanOrEqual(r.def.minCm); expect(r.cm).toBeLessThanOrEqual(r.def.maxCm!); } else expect(r.cm).toBe(0);
      if (r.def.id === 'fish_snakehead') { if (i % 2 === 0) nightSnake++; else daySnake++; }
    }
    expect(count.fish_crucian).toBeGreaterThan(count.fish_koi * 4);
    expect(nightSnake).toBeGreaterThan(daySnake * 1.3);
    const tot = (r: string) => FISH.filter((f) => f.rarity === r).reduce((a, f) => a + (count[f.id] ?? 0), 0);
    expect(tot('common')).toBeGreaterThan(tot('uncommon')); expect(tot('uncommon')).toBeGreaterThan(tot('rare')); expect(tot('rare')).toBeGreaterThan(tot('epic')); expect(tot('epic')).toBeGreaterThan(tot('legendary'));
    expect(count.fish_icefish ?? 0).toBe(0); // 秋天钓不到
    const loach = (rain: boolean, season: 'spring' | 'winter') => { const q = seeded(7); let c = 0; for (let i = 0; i < 40000; i++) if (rollFish(q, { night: false, rain, season }).def.id === 'fish_loach') c++; return c; };
    expect(loach(true, 'spring')).toBeGreaterThan(loach(false, 'spring') * 1.4);
    const q = seeded(9); let ice = 0; for (let i = 0; i < 60000; i++) if (rollFish(q, { night: false, season: 'winter' }).def.id === 'fish_icefish') ice++;
    expect(ice).toBeGreaterThan(0);
  });
  it('个头档位、重量、完美加成、出没说明', async () => {
    const { sizeTier, weightKg, perfectCm, fmtKg, habitatText } = await import('../src/shared/fishing');
    const carp = fishDef('fish_carp')!; // 25–60 cm，最大 5 kg
    expect(sizeTier(carp, 25).rank).toBe(-1); expect(sizeTier(carp, 40).rank).toBe(0); expect(sizeTier(carp, 48).rank).toBe(1); expect(sizeTier(carp, 55).rank).toBe(2); expect(sizeTier(carp, 60).name).toBe('巨物');
    expect(sizeTier(fishDef('junk_boot')!, 0).rank).toBe(0);
    const mid = () => 0.5;
    expect(weightKg(carp, 60, mid)).toBeCloseTo(5, 1); expect(weightKg(carp, 30, mid)).toBeLessThan(weightKg(carp, 50, mid)); expect(weightKg(fishDef('junk_boot')!, 0, mid)).toBe(0);
    expect(weightKg(fishDef('fish_gudgeon')!, 5, mid)).toBeGreaterThanOrEqual(0.01);
    expect(perfectCm(carp, 30)).toBe(39); expect(perfectCm(carp, 60)).toBe(60);
    expect(fmtKg(0.35)).toBe('350 g'); expect(fmtKg(3.4)).toBe('3.4 kg'); expect(fmtKg(12)).toBe('12 kg'); expect(fmtKg(100)).toBe('100 kg'); expect(fmtKg(0)).toBe('');
    expect(habitatText(fishDef('fish_icefish')!)).toContain('只在冬天出现'); expect(habitatText(fishDef('fish_eel')!)).toContain('夜里'); expect(habitatText(fishDef('fish_eel')!)).toContain('雨天');
    expect(habitatText(fishDef('fish_carp')!)).toContain('什么时候');
  });
  it('图鉴清洗；抛竿目标：面前必须有水、脚下不能是水', () => {
    expect(cleanFishLog({ fish_koi: { n: 2.7, best: 55.5 }, junk_boot: { n: 1, best: 0 }, fish_carp: { n: 0 }, nope: { n: 3 } })).toEqual({ fish_koi: { n: 2, best: 55, kg: 0 } });
    expect(cleanFishLog({ fish_koi: { n: 1, best: 60, kg: 5.678 } }).fish_koi).toEqual({ n: 1, best: 60, kg: 5.68 });
    const water = (px: number, py: number) => px >= 100 && px < 400 && py >= 100 && py < 400; // 一片 300×300 的水
    expect(castTarget(water, 250, 100 + 8, 'down')).toBeNull(); // 站在水里
    const t = castTarget(water, 250, 90 + 8, 'down'); expect(t).not.toBeNull(); expect(t!.y).toBeGreaterThan(100);
    expect(castTarget(water, 250, 90 + 8, 'up')).toBeNull(); // 背对水面
    expect(castTarget(water, 250, 100 - FISHING.CAST_MAX - 20, 'down')).toBeNull(); // 离水太远
  });
});


describe('真实地图上的钓鱼', async () => {
  const { readFileSync } = await import('node:fs');
  const { WorldMap } = await import('../src/world/WorldMap');
  const { lakeMask } = await import('../src/shared/water');
  const { castTarget } = await import('../src/shared/fishing');
  const world = JSON.parse(readFileSync(new URL('../public/assets/generated/world.json', import.meta.url), 'utf8'));
  const map = new WorldMap(world), water = lakeMask(world.waterRuns, world.width, world.height, world.pois)!;

  it('湖的水面格被还原出来，岸边有大量可以抛竿的站位（站得住、面朝水）', () => {
    expect(water.count).toBeGreaterThan(5000);
    let spots = 0;
    for (let ty = 100; ty < 260; ty++) for (let tx = 280; tx < 450; tx++) {
      const x = tx * 16 + 8, y = ty * 16 + 15;
      if (map.boxBlocked(x, y)) continue;
      for (const f of ['down', 'up', 'left', 'right'] as const) if (castTarget(water.at, x, y, f)) { spots++; break; }
    }
    expect(spots).toBeGreaterThan(300);
  });
  it('出生点附近、校园其他地方不能钓鱼（只认湖）', () => {
    const sx = world.spawn.x * 16, sy = world.spawn.y * 16;
    for (const f of ['down', 'up', 'left', 'right'] as const) expect(castTarget(water.at, sx, sy, f)).toBeNull();
    expect(water.at(sx, sy)).toBe(false);
  });
});


describe('校园跑：跑道几何与比赛房间', async () => {
  const { readFileSync } = await import('node:fs');
  const { WorldMap } = await import('../src/world/WorldMap');
  const R = await import('../src/shared/run');
  const { RunGame } = await import('../server/run');
  const world = JSON.parse(readFileSync(new URL('../public/assets/generated/world.json', import.meta.url), 'utf8'));
  const map = new WorldMap(world);

  it('真实地图：跑道一圈约 400 米；中线上的每一点、每个检查点、每个起跑位都能站；起跑区在田径场里', () => {
    expect(R.LAP_M).toBeGreaterThan(370); expect(R.LAP_M).toBeLessThan(450);
    const bad: string[] = [];
    for (let s = 0; s < R.LAP_PX; s += 6) { const p = R.trackPoint(s); if (map.boxBlocked(p.x, p.y)) bad.push(`${Math.round(p.x)},${Math.round(p.y)}`); }
    expect(bad, bad.slice(0, 5).join(' ')).toEqual([]);
    for (let i = 0; i < 4; i++) for (let n = 1; n <= 4; n++) { const sp = R.startSpot(i, n); expect(map.boxBlocked(sp.x, sp.y), `${i}/${n}`).toBe(false); expect(R.inStartZone(sp.x, sp.y)).toBe(true); }
    const track = world.pois.find((p: { id: string }) => p.id === 'track-east');
    expect(Math.hypot(R.TRACK.cx / 16 - track.x, R.TRACK.cy / 16 - track.y)).toBeLessThan(track.r);
    expect(R.GATES).toHaveLength(R.RUN.GATES); expect(R.GATES[0]).toEqual(R.trackPoint(0));
  });
  it('检查点必须按顺序：沿跑道跑满规定圈数才算完成；抄近道跳过检查点不算；反方向不算', () => {
    const p = R.startProg(); let moves = 0;
    for (let s = 0; s < R.LAP_PX * R.RUN.LAPS + 400; s += 10) { const pt = R.trackPoint(s); if (R.advance(p, pt.x, pt.y)) moves++; if (R.finished(p)) break; }
    expect(R.finished(p)).toBe(true); expect(moves).toBe(R.RUN.GATES * R.RUN.LAPS);
    const cheat = R.startProg(); // 一上来就站到对面检查点：下一个要的是 1 号，不算
    const far = R.GATES[8]; expect(R.advance(cheat, far.x, far.y)).toBe(false); expect(cheat.gate).toBe(1);
    const back = R.startProg();
    for (let s = R.LAP_PX; s > 0; s -= 10) { const pt = R.trackPoint(s); R.advance(back, pt.x, pt.y); }
    expect(R.finished(back)).toBe(false); expect(back.lap).toBe(0);
    expect(R.progressOf({ lap: 1, gate: 3 })).toBeGreaterThan(R.progressOf({ lap: 0, gate: 15 }));
    expect(R.fmtTime(12345)).toBe('12.35 秒'); expect(R.fmtTime(62300)).toBe('1:02.3');
    expect(R.cleanRun({ best: 12000.7, n: 3, wins: -1, x: 1 })).toEqual({ best: 12000, n: 3, wins: 0 }); expect(R.cleanRun(5)).toBeUndefined();
  });

  /** 假的服务器宿主：玩家表、发出去的消息、传送记录、完成记录 */
  function rig() {
    const players = new Map<number, { uid: number; name: string; x: number; y: number; riding: boolean; sitting: boolean; fishing: boolean }>();
    const sent: { uid: number; m: { t: string } & Record<string, unknown> }[] = [], done: { uid: number; ms: number; place: number; size: number }[] = [], friends = new Set<string>();
    let t = 1_000_000;
    const g = new RunGame({
      player: (u) => players.get(u), send: (uid, m) => sent.push({ uid, m: m as never }),
      teleport: (u, x, y) => { const p = players.get(u); if (p) { p.x = x; p.y = y; } },
      areFriends: (a, b) => friends.has(`${Math.min(a, b)}-${Math.max(a, b)}`), blocked: () => false,
      onFinish: (uid, info) => done.push({ uid, ...info }),
    }, () => t);
    const add = (uid: number, name: string, at = R.startSpot(0, 1)) => { players.set(uid, { uid, name, x: at.x, y: at.y, riding: false, sitting: false, fishing: false }); return players.get(uid)!; };
    const befriend = (a: number, b: number) => friends.add(`${Math.min(a, b)}-${Math.max(a, b)}`);
    const adv = (ms: number) => { t += ms; g.tick(); };
    /** 让某人沿跑道从 s0 跑到 s1（每 10 像素一步，每步 50ms 过去，整个房间一起走） */
    const runAll = (runners: { uid: number; s: number }[], to: number) => {
      for (let i = 0; i < 4000 && runners.some((r) => r.s < to); i++) { for (const r of runners) { if (r.s >= to) continue; r.s += 10; const pt = R.trackPoint(r.s), p = players.get(r.uid); if (p) { p.x = pt.x; p.y = pt.y; } } adv(50); }
    };
    return { g, players, sent, done, add, befriend, adv, runAll, now: () => t };
  }

  it('单人：必须站在起跑区；倒计时 → 发令 → 跑满两圈 → 成绩；之后可以再来', () => {
    const r = rig(); r.add(1, '甲', { x: 5000, y: 5000 });
    r.g.create(1, true); expect(r.sent.at(-1)?.m.t).toBe('run_gone'); expect(r.g.active).toBe(0); // 不在起跑区
    r.players.get(1)!.x = R.GATES[0].x + 4; r.players.get(1)!.y = R.GATES[0].y + 6;
    r.sent.length = 0; r.g.create(1, true);
    const st = r.sent.find((x) => x.m.t === 'run_state')!.m as never as { phase: string; startAt: number; now: number };
    expect(st.phase).toBe('count'); expect(st.startAt - st.now).toBe(R.RUN.COUNTDOWN_MS);
    r.adv(R.RUN.COUNTDOWN_MS + 10);
    expect(r.sent.filter((x) => x.m.t === 'run_state').at(-1)!.m.phase).toBe('go');
    r.runAll([{ uid: 1, s: 0 }], R.LAP_PX * R.RUN.LAPS + 100);
    expect(r.done).toHaveLength(1); expect(r.done[0]).toMatchObject({ uid: 1, place: 1, size: 1 });
    expect(r.done[0].ms).toBeGreaterThan(5000);
    expect(r.sent.some((x) => x.m.t === 'run_end')).toBe(true);
    r.adv(9000); expect(r.g.active).toBe(0); // 结束后房间收掉，可以再来
  });
  it('邀请好友：只能邀请在线的好友；对方接受后被带到起跑线；名次按先后；邀请过期失效', () => {
    const r = rig(); r.add(1, '甲'); r.add(2, '乙', { x: 100, y: 100 }); r.add(3, '丙', { x: 100, y: 100 }); r.befriend(1, 2);
    r.g.create(1, false); r.g.invite(1, 3); expect(r.sent.at(-1)?.m.t).toBe('run_gone'); // 3 不是好友
    r.g.invite(1, 2);
    const inv = r.sent.find((x) => x.uid === 2 && x.m.t === 'run_invite')!.m as never as { rid: number };
    r.g.accept(3, inv.rid); expect(r.sent.at(-1)?.uid).toBe(3); expect(r.sent.at(-1)?.m.t).toBe('run_gone'); // 没被邀请
    r.g.accept(2, inv.rid);
    expect(r.g.roomOf(2)?.members.map((m) => m.uid)).toEqual([1, 2]);
    expect(Math.abs(r.players.get(2)!.y - R.GATES[0].y)).toBeLessThan(1); // 被带到起跑线
    r.g.start(2); expect(r.g.roomOf(1)?.phase).toBe('lobby'); // 只有房主能开始
    r.g.start(1); r.adv(R.RUN.COUNTDOWN_MS + 10);
    const a = { uid: 1, s: 0 }, b = { uid: 2, s: 0 };
    // 甲每步 10 像素，乙慢一点（每步先让甲走到前面再让乙跟上）：用不同终点驱动
    for (let i = 0; i < 6000 && r.done.length < 2; i++) { a.s += 10; if (i % 4) b.s += 10; for (const q of [a, b]) { const pt = R.trackPoint(q.s), p = r.players.get(q.uid)!; p.x = pt.x; p.y = pt.y; } r.adv(50); }
    expect(r.done.map((d) => [d.uid, d.place, d.size])).toEqual([[1, 1, 2], [2, 2, 2]]);
    const end = r.sent.filter((x) => x.m.t === 'run_end').at(-1)!.m as never as { results: { uid: number }[] };
    expect(end.results.map((x) => x.uid)).toEqual([1, 2]);

    const r2 = rig(); r2.add(1, '甲'); r2.add(2, '乙', { x: 100, y: 100 }); r2.befriend(1, 2);
    r2.g.create(1, false); r2.g.invite(1, 2);
    const rid = (r2.sent.find((x) => x.m.t === 'run_invite')!.m as never as { rid: number }).rid;
    r2.adv(R.RUN.INVITE_MS + 1000); r2.g.accept(2, rid);
    expect(r2.sent.at(-1)?.m.t).toBe('run_gone'); expect(r2.g.roomOf(2)).toBeUndefined();
  });
  it('骑车/离开田径场/中途退出：取消或放弃；最后一个人走了房间就没了；候场超时自动取消', () => {
    const r = rig(); r.add(1, '甲'); r.g.create(1, true); r.adv(R.RUN.COUNTDOWN_MS + 10);
    r.players.get(1)!.riding = true; r.adv(60);
    expect(r.sent.some((x) => x.m.t === 'run_gone' && String(x.m.msg).includes('骑车'))).toBe(true); expect(r.g.active).toBe(0);
    const bike = rig(); bike.add(1, '甲'); bike.players.get(1)!.riding = true; bike.g.create(1, true); expect(bike.g.active).toBe(0);
    const away = rig(); away.add(1, '甲'); away.g.create(1, true); away.adv(R.RUN.COUNTDOWN_MS + 10);
    away.players.get(1)!.x = 100; away.players.get(1)!.y = 100; away.adv(60); expect(away.g.active).toBe(0);
    const lobby = rig(); lobby.add(1, '甲'); lobby.g.create(1, false); lobby.adv(R.RUN.LOBBY_MS + 100); expect(lobby.g.active).toBe(0);
    const leave = rig(); leave.add(1, '甲'); leave.g.create(1, false); leave.sent.length = 0; leave.g.leave(1); expect(leave.sent.at(-1)).toMatchObject({ uid: 1, m: { t: 'run_gone', msg: '' } }); // 主动退出也通知客户端收起界面 expect(leave.g.active).toBe(0); leave.g.create(1, false); expect(leave.g.active).toBe(0); // 3 秒内不能连着开
    leave.adv(3100); leave.g.create(1, false); expect(leave.g.active).toBe(1);
  });
});


describe('好友大致位置', async () => {
  const { readFileSync } = await import('node:fs');
  const { whereIs, bearing, locText } = await import('../src/shared/where');
  const world = JSON.parse(readFileSync(new URL('../public/assets/generated/world.json', import.meta.url), 'utf8'));
  const ctx = { pois: world.pois, buildings: world.buildings.map((b: { name: string; bbox: unknown }) => ({ name: b.name, bbox: b.bbox })), w: world.width, h: world.height };

  it('真实地图：湖上说湖、图书馆门口说图书馆、出生点在南门前广场；远离一切时说校园的方位', () => {
    expect(whereIs(362 * 16, 180 * 16, ctx)).toBe('精工湖');
    const lib = world.buildings.find((b: { id: string }) => b.id === 'library');
    expect(whereIs((lib.bbox.x + lib.bbox.w / 2) * 16, (lib.bbox.y + lib.bbox.h / 2) * 16, ctx)).toBe(lib.name);
    expect(whereIs(world.spawn.x * 16, world.spawn.y * 16, ctx)).toBeTruthy();
    expect(whereIs(5 * 16, 5 * 16, { pois: [], buildings: [], w: 300, h: 300 })).toBe('校园西北部');
    expect(whereIs(150 * 16, 150 * 16, { pois: [], buildings: [], w: 300, h: 300 })).toBe('校园中部');
    // 不在任何地点里，但靠近某个地标：说"附近"
    expect(whereIs(100 * 16, 100 * 16, { pois: [{ id: 'a', name: '小亭子', kind: 'area', x: 110, y: 100, r: 3 }], buildings: [], w: 300, h: 300 })).toBe('小亭子附近');
    // 每个地标的中心都能说出名字（不会说出空话）
    for (const p of world.pois.filter((p: { kind: string; r?: number }) => p.kind !== 'spawn' && p.r)) expect(whereIs(p.x * 16, p.y * 16, ctx), p.id).toBeTruthy();
  });
  it('方位与距离：八方位、取整到 50 米、很近算"就在身边"；说明文字', () => {
    const o = 1000;
    expect(bearing(o, o, o, o - 800).dir).toBe('北'); expect(bearing(o, o, o + 800, o).dir).toBe('东'); expect(bearing(o, o, o - 800, o + 800).dir).toBe('西南');
    expect(bearing(o, o, o + 16 * 40, o).m).toBe(100); // 40 格 = 100 米
    expect(bearing(o, o, o + 16 * 41, o).m).toBe(100); // 102.5 米取整到 100
    expect(bearing(o, o, o + 5, o).near).toBe(true); expect(bearing(o, o, o + 5, o).m).toBe(50);
    expect(locText({ uid: 1, where: '精工湖', dir: '东北', m: 300 })).toBe('精工湖 · 东北方向约 300 米');
    expect(locText({ uid: 1, where: '精工湖', dir: '北', m: 50, near: true })).toContain('身边');
    expect(locText({ uid: 1, hidden: true })).toBe('位置已隐藏'); expect(locText(undefined)).toBe('');
  });
});


describe('专属称号', async () => {
  const { customTitleId, isCustomTitle, isOwnable, titleDef, cleanTitles } = await import('../src/shared/titles');
  const prof = () => { const r = validateProfile({ gender: 'f', look: 1, name: '测试', college: '机电学院', major: '机械设计', year: 2024 }); if (!r.ok) throw new Error(r.error); return r.profile; };

  it('名字 + 颜色编码进称号 id：能还原出名字和颜色；名字限 8 字；颜色必须是 #rrggbb；乱写的 id 不认', () => {
    const id = customTitleId('传奇玩家', '#FF7AC8');
    expect(id).toBe('~ff7ac8~传奇玩家');
    expect(titleDef(id)).toMatchObject({ id, name: '传奇玩家', color: '#ff7ac8', custom: true });
    expect(isOwnable(id)).toBe(true); expect(isCustomTitle(id)).toBe(true);
    expect(customTitleId('一二三四五六七八九十', 'ff0000')).toBe('~ff0000~一二三四五六七八'); // 超长截断
    expect(customTitleId('  ', '#ff0000')).toBeNull(); expect(customTitleId('名字', 'red')).toBeNull(); expect(customTitleId('名字', '#ff00')).toBeNull();
    expect(customTitleId('带~号', '#00ff00')).toBe('~00ff00~带号');
    for (const bad of ['~ff0000~', '~FF0000~大写', '~ff0000~太长太长太长太长太长', 'x~ff0000~名', '~gg0000~名', '~ff0000~a~b']) { expect(isCustomTitle(bad), bad).toBe(false); expect(isOwnable(bad)).toBe(false); expect(titleDef(bad)).toBeUndefined(); }
    expect(cleanTitles({ [id!]: 5, '~zzzzzz~坏': 5, freshman: 3 })).toEqual({ [id!]: 5, freshman: 3 });
  });
  it('发放/佩戴/收回：专属称号和普通称号走同一套；收回正在佩戴的会摘下', () => {
    const store = new PlayerStore(null); store.set('k', { profile: prof(), seen: 1 });
    const pg = new Progress(store, []), id = customTitleId('勇者', '#33aaff')!;
    expect(pg.grantTitle('k', id, 10)).toBe(true); expect(pg.titles('k').sel).toBe(id);
    expect(pg.revokeTitle('k', 'runner')).toBe(false);
    expect(pg.revokeTitle('k', id)).toBe(true); expect(pg.titles('k')).toEqual({ own: {}, sel: '' });
  });
});


describe('留在原地的共享单车', async () => {
  const { DropBikes } = await import('../server/bikes');
  const B = await import('../src/shared/bikes');

  it('停车：附近已有就只刷新时间；满了挤掉最早的；骑走后消失；超时消失', () => {
    const d = new DropBikes(), t0 = 1_000_000;
    const a = d.add(100, 100, false, t0); expect(a.created).toBe(true); expect(a.bike.id).toBe(1);
    const dup = d.add(105, 100, true, t0 + 1000); expect(dup.created).toBe(false); expect(dup.bike.id).toBe(1); expect(d.size).toBe(1);
    expect(d.near(100, 120, 30)?.id).toBe(1); expect(d.near(100, 300, 30)).toBeUndefined();
    expect(d.take(1)).toBe(true); expect(d.take(1)).toBe(false); expect(d.size).toBe(0);
    d.add(0, 0, false, t0); d.add(50, 0, false, t0 + 5000);
    expect(d.sweep(t0 + B.BIKE_DROP_TTL_MS - 1)).toEqual([]);
    expect(d.sweep(t0 + B.BIKE_DROP_TTL_MS + 1)).toEqual([2]); // 第一辆（t0）到期，第二辆还在
    expect(d.size).toBe(1);
    expect(d.sweep(t0 + 5000 + B.BIKE_DROP_TTL_MS + 1)).toEqual([3]); expect(d.size).toBe(0);
    const full = new DropBikes();
    for (let i = 0; i < B.BIKE_DROP_MAX; i++) full.add(i * 40, 0, false, t0 + i);
    const over = full.add(99999, 0, false, t0 + 9999);
    expect(over.created).toBe(true); expect(over.evicted).toEqual([1]); expect(full.size).toBe(B.BIKE_DROP_MAX); // 最早的被挤掉
    expect(full.list().some((b) => b.id === 1)).toBe(false);
  });
});


describe('队伍成员关系', async () => {
  const { PartyManager } = await import('../server/party');
  const P = await import('../src/shared/party');

  function rig() {
    const online = new Set<number>(), friends = new Set<string>(), log: string[] = [], changed: number[][] = [];
    let t = 1_000_000;
    const key = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;
    const m = new PartyManager({
      online: (u) => online.has(u), name: (u) => `P${u}`, areFriends: (a, b) => friends.has(key(a, b)), blocked: () => false,
      changed: (u) => changed.push([...u]), gone: (u, msg) => log.push(`gone ${u} ${msg}`),
      sendInvite: (to, pid, from) => log.push(`invite ${to} ${pid} ${from}`), result: (u, ok, msg) => log.push(`result ${u} ${ok} ${msg}`),
    }, () => t);
    const add = (...us: number[]) => us.forEach((u) => online.add(u));
    const friend = (a: number, b: number) => friends.add(key(a, b));
    return { m, log, changed, add, friend, online, adv: (ms: number) => { t += ms; m.tick(); } };
  }

  it('邀请 → 接受：队长邀请在线好友；非好友/不在线/自己都被拒；已在别的队伍的被拒', () => {
    const r = rig(); r.add(1, 2, 3); r.friend(1, 2);
    r.m.invite(1, 3); expect(r.log.at(-1)).toContain('result 1 false'); // 3 不是好友
    r.m.invite(1, 1); expect(r.log.at(-1)).toContain('不能邀请自己');
    r.m.invite(1, 2); expect(r.log.at(-1)).toMatch(/^invite 2 1 1/);
    r.m.accept(2, 1); expect(r.m.membersOf(1)).toEqual([1, 2]); expect(r.m.mates(1, 2)).toBe(true); expect(r.m.mates(1, 3)).toBe(false);
    r.friend(2, 3); r.m.invite(2, 3); expect(r.log.at(-1)).toContain('只有队长'); // 队员不能拉人
    r.friend(1, 3); r.m.invite(1, 3); r.m.accept(3, 1); expect(r.m.membersOf(3)).toEqual([1, 2, 3]);
    r.m.accept(3, 1); expect(r.log.at(-1)).toContain('result 3 false'); // 重复接受/已在队里
  });
  it('人数上限、邀请过期、拒绝；掉线退出；队长走了换人；只剩一人解散；队长可踢人、队员不行', () => {
    const r = rig(); r.add(1, 2, 3, 4, 5, 6);
    for (const u of [2, 3, 4, 5, 6]) r.friend(1, u);
    for (const u of [2, 3, 4]) { r.m.invite(1, u); r.m.accept(u, 1); }
    expect(r.m.membersOf(1)).toHaveLength(P.PARTY_MAX);
    r.m.invite(1, 5); expect(r.log.at(-1)).toContain('最多');
    r.m.kick(2, 3); expect(r.log.at(-1)).toContain('只有队长'); expect(r.m.membersOf(1)).toHaveLength(4);
    r.m.kick(1, 3); expect(r.m.membersOf(1)).toEqual([1, 2, 4]); expect(r.log).toContain('gone 3 你被队长请出了队伍'); expect(r.m.partyOf(3)).toBeUndefined();
    r.m.leave(1); expect(r.m.partyOf(2)!.leader).toBe(2); expect(r.m.membersOf(2)).toEqual([2, 4]); // 队长走了换下一位
    r.m.leave(4); expect(r.m.partyOf(2)).toBeUndefined(); expect(r.log).toContain('gone 2 队伍解散了'); expect(r.m.size).toBe(0);
    // 邀请过期
    r.m.invite(5, 6); expect(r.log.at(-1)).toContain('result 5 false'); // 5 和 6 不是好友
    r.friend(5, 6); r.m.invite(5, 6); const pid = Number(r.log.at(-1)!.split(' ')[2]);
    r.adv(P.PARTY_INVITE_MS + 1000); r.m.accept(6, pid); expect(r.log.at(-1)).toContain('result 6 false'); expect(r.m.size).toBe(0); // 没人理，队伍作罢
    r.m.invite(5, 6); const pid2 = Number(r.log.at(-1)!.split(' ')[2]); r.m.decline(6, pid2); expect(r.log.at(-1)).toContain('暂时不想组队'); r.m.accept(6, pid2); expect(r.m.membersOf(5)).toEqual([5]);
  });
});


describe('小猫：亲密度完整设计（跟随 / 专属名字）', async () => {
  const C = await import('../src/shared/cats');
  const prof = () => { const r = validateProfile({ gender: 'f', look: 1, name: '测试', college: '机电学院', major: '机械设计', year: 2024 }); if (!r.ok) throw new Error(r.error); return r.profile; };
  const cats = C.genCats(Array.from({ length: 200 }, (_, i) => [10 + (i % 20) * 8, 10 + Math.floor(i / 20) * 8] as [number, number]), 4);

  it('档位表自洽：5 档、每档有说明；跟随/改名从「亲密」起；专属名字清洗', () => {
    expect(C.LEVEL_AT).toHaveLength(C.LEVEL_NAMES.length); expect(C.LEVEL_PERKS).toHaveLength(C.LEVEL_NAMES.length);
    expect(C.LEVEL_NAMES[C.BOND_LEVEL]).toBe('亲密'); expect(C.LEVEL_NAMES.at(-1)).toBe('挚友');
    expect(C.cleanNicks({ 3: '  团团  ', 4: '', 5: '一二三四五六七八九十', x: '坏', 99999: '坏', 6: 7 })).toEqual({ 3: '团团', 5: '一二三四五六七八' });
  });
  it('Progress：好感不够不能取名；够了能取/清除；挚友奖励猫条 ×3；记住跟随的猫', () => {
    const store = new PlayerStore(null); store.set('k', { profile: prof(), seen: 1 });
    const pg = new Progress(store, cats, () => 0.99);
    expect(pg.canBond('k', 0)).toBe(false); expect(pg.setNick('k', 0, '团团')).toBeNull();
    store.get('k')!.cats = { '0': 29 };
    expect(pg.canBond('k', 0)).toBe(false);
    store.get('k')!.cats = { '0': 30 };
    expect(pg.canBond('k', 0)).toBe(true);
    expect(pg.setNick('k', 0, '  团团  ')).toBe('团团'); expect(pg.nicks('k')).toEqual({ 0: '团团' });
    expect(pg.setNick('k', 0, '')).toBe(''); expect(pg.nicks('k')).toEqual({});
    pg.setFollowed('k', 0); expect(pg.followed('k')).toBe(0); pg.setFollowed('k', undefined); expect(pg.followed('k')).toBeUndefined();
    // 升到挚友（80）：猫条 ×3
    store.get('k')!.cats = { '0': 79 }; store.get('k')!.inv = { cat_treat: 1 };
    const c = cats[0], now = 1e12;
    const r = pg.feed('k', 0, 'cat_treat', c.hx, c.hy, now);
    expect(r.level).toBe(4); expect(r.gifts.find((g) => g.id === 'cat_treat')?.n).toBeGreaterThanOrEqual(3);
  });
});

describe('拉鱼小游戏模拟', async () => {
  const { FightSim, fightOf, FIGHT } = await import('../src/shared/fishfight');
  const { fishDef, FISH } = await import('../src/shared/fishing');
  const run = (diff: number, move: 'smooth' | 'mixed' | 'dart', seed: number, ctl: (s: InstanceType<typeof FightSim>) => boolean, maxSec = 60) => {
    const s = new FightSim({ seed, diff, move }); let t = 0;
    while (!s.result && t < maxSec) { s.step(1 / 60, ctl(s)); t += 1 / 60; }
    return { s, t };
  };
  // 会玩的"机器人"：绿条中心落在鱼下面就按住（带一点速度预判）
  const bot = (s: InstanceType<typeof FightSim>) => s.bar + s.vel * 0.12 < s.fish;

  it('不按键、一直按住（绿条贴着最底/最顶）几乎都会输', () => {
    let idleWins = 0, holdWins = 0, n = 0;
    for (const mv of ['smooth', 'mixed', 'dart'] as const) for (let seed = 1; seed <= 30; seed++) {
      if (run(0.5, mv, seed, () => false).s.result === 'win') idleWins++;
      if (run(0.5, mv, seed, () => true, 120).s.result === 'win') holdWins++;
      n++;
    }
    expect(idleWins / n).toBeLessThan(0.1); expect(holdWins / n).toBeLessThan(0.1);
  });
  it('会跟鱼的机器人：简单的鱼稳赢，用时不短于最短时间；越难越难赢', () => {
    let easyWins = 0, hardWins = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const e = run(0.15, 'smooth', seed, bot), h = run(0.9, 'dart', seed, bot);
      if (e.s.result === 'win') { easyWins++; expect(e.t * 1000).toBeGreaterThanOrEqual(FIGHT.MIN_MS); }
      if (h.s.result === 'win') hardWins++;
    }
    expect(easyWins).toBeGreaterThanOrEqual(27); expect(hardWins).toBeLessThanOrEqual(easyWins); // 2026-11-03 再降难度后，完美机器人连最难的鱼也能全赢（真人要慢、手抖）
  });
  it('同一个 seed 游法完全一致（确定性）；难鱼的绿条更短', () => {
    const a = run(0.5, 'mixed', 5, bot), b = run(0.5, 'mixed', 5, bot);
    expect([a.s.fish, a.s.bar, a.s.progress, a.t]).toEqual([b.s.fish, b.s.bar, b.s.progress, b.t]);
    expect(new FightSim({ seed: 1, diff: 0.9, move: 'dart' }).half).toBeLessThan(new FightSim({ seed: 1, diff: 0.1, move: 'dart' }).half);
  });
  it('fightOf：难度随稀有度和个头增加，范围 0~1，游法跟着鱼走', () => {
    const crucian = fishDef('fish_crucian')!, dragon = fishDef('fish_lakedragon')!;
    expect(fightOf(dragon, 150, 1).diff).toBeGreaterThan(fightOf(crucian, 12, 1).diff);
    expect(fightOf(crucian, 28, 1).diff).toBeGreaterThan(fightOf(crucian, 12, 1).diff);
    for (const f of FISH) { const d = fightOf(f, f.maxCm ?? 0, 3); expect(d.diff).toBeGreaterThan(0); expect(d.diff).toBeLessThanOrEqual(1); }
    expect(fightOf(dragon, 200, 7).move).toBe('dart'); expect(fightOf(dragon, 200, -1).seed).toBeGreaterThanOrEqual(0);
  });
});
