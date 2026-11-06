import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import WebSocket from 'ws';
import { startServer } from '../server/index';
import { PlayerStore } from '../server/store';
import { FLAG_BOAT, FLAG_RIDE, PROTOCOL_VERSION, encodeReport, packFlags, unpackFlags, type ServerMsg } from '../src/shared/protocol';
import { validateProfile } from '../src/shared/profile';
import { BOAT_COUNT, BOAT_HOME_MS, BOAT_LAND_REACH, BOAT_SPEED_MULT, BOAT_STRANDED_MS, findMoor, findMoors, landNear } from '../src/shared/boat';
import { lakeMask } from '../src/shared/water';
import { WorldMap } from '../src/world/WorldMap';

describe('小船 · 规则', () => {
  it('离岸太远就上不了岸（找不到落脚点）；岸边能找到、而且找的是最近的岸', () => {
    // 湖心一大片水：往哪儿走 58 像素都是水 → 下不了船
    const allWater = () => true;
    expect(landNear(allWater, 500, 500)).toBeNull();
    // 水/陆分界在 x = 1000（左边水、右边陆）
    const map = (x: number) => x < 1000;
    const spot = landNear(map, 970, 300)!;
    expect(spot).toBeTruthy();
    expect(map(spot.x)).toBe(false);              // 落点是陆地
    expect(spot.x - 970).toBeLessThanOrEqual(BOAT_LAND_REACH); // 没跑太远
    expect(landNear(map, 1020, 300)).toEqual({ x: 1020, y: 300 }); // 本来就在岸上
  });

  it('停船点有 4 处，彼此隔开（船散在湖岸，不会挤成一堆）；船比共享单车慢一半', () => {
    const isWater = (tx: number, ty: number) => tx > 5 && tx < 65 && ty > 5 && ty < 65;
    const isLand = (tx: number, ty: number) => !isWater(tx, ty);
    const ms = findMoors(isWater, isLand, { x: 35, y: 35 }, BOAT_COUNT);
    expect(ms.length).toBeGreaterThanOrEqual(4); // 一圈岸边能放几条就几条
    for (const a of ms) for (const b of ms) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(14 * 16 - 1);
    for (const m of ms) expect(isWater(Math.floor(m.x / 16), Math.floor(m.y / 16))).toBe(true);
    expect(BOAT_SPEED_MULT).toBeLessThan(1);
  });

  it('停船点：湖里、旁边能站人、离湖心不太远；船比共享单车慢一半', () => {
    const isWater = (tx: number, ty: number) => tx > 10 && tx < 30 && ty > 10 && ty < 30;
    const isLand = (tx: number, ty: number) => !isWater(tx, ty);
    const m = findMoor(isWater, isLand, { x: 20, y: 20 })!;
    expect(m).toBeTruthy();
    expect(isWater(Math.floor(m.x / 16), Math.floor(m.y / 16))).toBe(true);
    const around = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => isLand(Math.floor(m.x / 16) + dx, Math.floor(m.y / 16) + dy));
    expect(around.some(Boolean)).toBe(true); // 旁边有陆地（能走上去上船）
    expect(findMoor(() => false, isLand, { x: 20, y: 20 })).toBeNull(); // 没水就没有停船点
    expect(BOAT_SPEED_MULT).toBeLessThan(1); // 比车慢
  });
});

describe.skipIf(!existsSync(join(__dirname, '..', 'public', 'assets', 'generated', 'world.json')))('小船 · 真实校园地图', () => {
  it('精工湖找得到 4 处停船点：都停在水面上、岸边一格能站人、彼此散开', () => {
    const w = JSON.parse(readFileSync(join(__dirname, '..', 'public', 'assets', 'generated', 'world.json'), 'utf8'));
    const map = new WorldMap({ width: w.width, height: w.height, collision: w.collision });
    const mask = lakeMask(w.waterRuns, w.width, w.height, w.pois)!;
    const lake = w.pois.find((p: { id: string }) => p.id === 'lake')!;
    const moor = findMoor((tx, ty) => mask.tileWater(tx, ty), (tx, ty) => !map.tileBlocked(tx, ty), lake)!;
    expect(moor).toBeTruthy();
    expect(mask.at(moor.x, moor.y)).toBe(true);                       // 船在水里
    expect(map.boxBlocked(moor.x, moor.y)).toBe(true);                // （水格是挡人的，所以人走不过去）
    expect(landNear((x, y) => map.boxBlocked(x, y), moor.x, moor.y)).toBeTruthy(); // 岸边站得住，上得了船

    const all = findMoors((tx, ty) => mask.tileWater(tx, ty), (tx, ty) => !map.tileBlocked(tx, ty), lake, BOAT_COUNT);
    expect(all).toHaveLength(BOAT_COUNT);
    for (const m of all) {
      expect(mask.at(m.x, m.y), `${m.x},${m.y} 不在水里`).toBe(true);
      expect(landNear((x, y) => map.boxBlocked(x, y), m.x, m.y)).toBeTruthy();
    }
    for (const a of all) for (const b of all) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(13 * 16);
  });
});

// ---------------------------------------------------------------- 服务器
const W = 200;
/** 一个小池塘：x 90..110、y 95..105 是水，周围全是空地 */
const pondWorld = {
  width: W, height: W, spawn: { x: 20, y: 20 },
  pois: [{ id: 'lake', x: 100, y: 100 }],
  waterRuns: Array.from({ length: 11 }, (_, i) => [95 + i, 90, 110] as [number, number, number]),
  // 水格在碰撞图里是挡人的（和真实地图一样）：所以人走不进湖，船只能在水上漂
  collision: Array.from({ length: W }, (_, ty) => Array.from({ length: W }, (_, tx) => (tx >= 90 && tx < 110 && ty >= 95 && ty <= 105 ? '1' : '0')).join('')),
};
const open: WebSocket[] = [];
let srv: Awaited<ReturnType<typeof startServer>> | null = null;
afterEach(async () => { for (const w of open.splice(0)) w.terminate(); await srv?.close(); srv = null; });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function client(port: number, name: string, token: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`); open.push(ws);
  const msgs: ServerMsg[] = [];
  ws.on('message', (d, bin) => { if (!bin) msgs.push(JSON.parse(d.toString()) as ServerMsg); });
  await new Promise<void>((r, j) => { ws.on('open', () => r()); ws.on('error', j); });
  const send = (m: unknown) => ws.send(JSON.stringify(m));
  const wait = async <T extends ServerMsg['t']>(t: T, from = 0, ms = 4000, f: (m: Extract<ServerMsg, { t: T }>) => boolean = () => true) => { const end = Date.now() + ms; while (Date.now() < end) { const m = msgs.slice(from).find((x): x is Extract<ServerMsg, { t: T }> => x.t === t && f(x as Extract<ServerMsg, { t: T }>)); if (m) return m; await sleep(15); } throw new Error(`等不到 ${t}`); };
  const r = validateProfile({ gender: 'f', look: 1, name, college: '机电学院', major: '机械设计', year: 2024 }); if (!r.ok) throw new Error(r.error);
  send({ t: 'hello', v: PROTOCOL_VERSION, token, profile: r.profile });
  const w = await wait('welcome');
  return { ws, send, msgs, wait, uid: w.uid, id: w.id };
}
const G = () => (srv!.game as unknown as { byUid: Map<number, { x: number; y: number; flags: number; riding: boolean; rideKind: string; key: string }> }).byUid;

describe('小船（服务器）', () => {
  const tok = (k: string) => `boattoken${k}`.padEnd(24, k);
  /** 岸上、紧挨着停船点那一格：船停在池塘南岸的水里（97,105），人站在 (97,106) 的格子中心 */
  const shore = { x: 97 * 16 + 8, y: 106 * 16 + 8 };
  const setup = async () => {
    srv = await startServer({ port: 0, world: pondWorld, game: { mons: { gift: false } } });
    srv.store.set(PlayerStore.key(tok('A')), { profile: { name: '划船', gender: 'f', look: 1, college: '机电学院', major: '机械设计', year: 2024 } as never, x: shore.x, y: shore.y, seen: Date.now(), inv: { fishing_rod: 1, bait: 20 } });
    const c = await client(srv.port, '划船', tok('A'));
    return c;
  };

  it('进世界就有船停在湖面上（池塘小，停船点少于 4 条也照常）；上岸走近按 E 就能划（位置挪到船上，flags 带"在划船"）', async () => {
    const c = await setup();
    const drops = await c.wait('bike_drops');
    const boats = drops.list.filter((b) => b.k === 'boat');
    expect(boats.length).toBeGreaterThanOrEqual(1);
    const boat = boats.sort((a, b) => Math.hypot(a.x - shore.x, a.y - shore.y) - Math.hypot(b.x - shore.x, b.y - shore.y))[0];
    expect(srv!.game.progress.inv(G().get(c.uid)!.key)).toBeTruthy();
    c.msgs.length = 0; c.send({ t: 'ride', on: true });
    const r = await c.wait('ride_result');
    expect(r.ok).toBe(true); expect(r.kind).toBe('boat');
    const p = G().get(c.uid)!;
    expect(p.riding).toBe(true); expect(p.rideKind).toBe('boat');
    expect(p.x).toBe(boat.x); expect(p.y).toBe(boat.y);                 // 人坐到船上
    expect(unpackFlags(p.flags)).toMatchObject({ ride: true, boat: true, tandem: false });
    // 划走的那条不再停在原处（别的船还在，被划走的这条不见了）
    expect(srv!.game.dropped.list().filter((b) => b.k === 'boat')).toHaveLength(boats.length - 1);
  });

  it('划船只能在水上：往湖里划可以，往岸上划会被拉回', async () => {
    const c = await setup();
    await c.wait('bike_drops');
    c.send({ t: 'ride', on: true }); await c.wait('ride_result', 0, 4000, (m) => m.ok);
    const p = G().get(c.uid)!;
    // 往湖里（-y 方向，北上）划：服务器接受
    const y0 = p.y;
    for (let i = 1; i <= 4; i++) { c.ws.send(encodeReport({ x: p.x, y: y0 - i * 6, flags: packFlags('up', true, false, true, false, false, false, true) })); await sleep(60); }
    expect(p.y).toBeLessThan(y0);
    // 往岸上（+y 方向，越过 y=105 那条水边）划：服务器不接受（水面以外不算"能走"）
    const y1 = p.y;
    c.ws.send(encodeReport({ x: p.x, y: 108 * 16, flags: packFlags('down', true, false, true, false, false, false, true) })); await sleep(120);
    expect(p.y).toBe(y1);
  });

  it('船上能钓鱼：划到湖心甩一竿，鱼落在船前面的水面上、水域按船所在那片算；普通骑车（不是船）还是不让钓', async () => {
    const cl = await setup();
    await cl.wait('bike_drops');
    cl.send({ t: 'ride', on: true }); await cl.wait('ride_result', 0, 4000, (m) => m.ok);
    const p = G().get(cl.uid)!;
    p.x = 100 * 16 + 8; p.y = 100 * 16 + 8; // 池塘正中间：四周都是水，岸上那套"站在岸边"根本不成立
    p.flags = (p.flags & ~3) | 0; // 朝下
    cl.msgs.length = 0; cl.send({ t: 'fish_cast' });
    const w = await cl.wait('fish_state', 0, 4000, (m) => m.s === 'wait');
    expect(w.zone).toBe('deep'); // 湖心深水
    expect(w.x).toBeTruthy(); expect(w.y).toBeTruthy();
    const wm = (srv!.game as unknown as { water: { at: (x: number, y: number) => boolean } }).water;
    expect(wm.at(w.x!, w.y!)).toBe(true); // 浮漂落在水面上
    expect(Math.hypot(w.x! - p.x, w.y! - p.y)).toBeLessThanOrEqual(40); // 就在船头前面，没抛到岸上去
    // 收线放弃，别影响后面的用例
    cl.send({ t: 'fish_cancel' }); await cl.wait('fish_state', 0, 4000, (m) => m.s === 'idle');
    // 骑车（不是船）还是不能钓：规则没被放宽（等过 900ms 的抛竿冷却）
    await sleep(950);
    p.rideKind = 'bike';
    cl.msgs.length = 0; cl.send({ t: 'fish_cast' });
    const bad = await cl.wait('fish_state', 0, 4000, (m) => m.s === 'idle' && !!m.msg);
    expect(bad.msg).toContain('下车');
  });

  it('靠岸才能下船：湖心按 E 会被拒（人还在船上），划回岸边才下得去，船留在水面上别人能接着划', async () => {
    const c = await setup();
    await c.wait('bike_drops');
    c.send({ t: 'ride', on: true }); await c.wait('ride_result', 0, 4000, (m) => m.ok);
    const p = G().get(c.uid)!;
    // 湖心（四周 100 像素内没有陆地）：下不了船
    p.x = 100 * 16 + 8; p.y = 100 * 16 + 8;
    c.msgs.length = 0; c.send({ t: 'ride', on: false });
    const no = await c.wait('ride_result');
    expect(no.ok).toBe(false); expect(no.stay).toBe(true);
    expect(G().get(c.uid)!.riding).toBe(true); // 还在船上
    // 划回岸边：能下船，人站到陆地上，船留在原来的水面
    p.x = 97 * 16 + 8; p.y = 105 * 16 + 8;
    c.msgs.length = 0; c.send({ t: 'ride', on: false });
    const ok = await c.wait('ride_result');
    expect(ok.ok).toBe(true);
    const me = G().get(c.uid)!;
    expect(me.riding).toBe(false); expect(me.flags & (FLAG_RIDE | FLAG_BOAT)).toBe(0);
    expect(me.y).toBeGreaterThan(105 * 16); // 站到岸上（水的外面）
    const atSpot = srv!.game.dropped.list().filter((b) => b.k === 'boat' && b.x === 97 * 16 + 8 && b.y === 105 * 16 + 8);
    expect(atSpot).toHaveLength(1); // 船停在刚才划到的位置（别的停船点上的船不算）
  });
});

describe('小船 · 自动归位（别把船丢在湖心）', () => {
  const tok = (k: string) => `home${k}`.padEnd(24, k);
  const shore = { x: 97 * 16 + 8, y: 106 * 16 + 8 };
  const center = { x: 100 * 16 + 8, y: 100 * 16 + 8 };
  const setup = async () => {
    srv = await startServer({ port: 0, world: pondWorld, game: { mons: { gift: false } } });
    srv.store.set(PlayerStore.key(tok('H')), { profile: { name: '归位', gender: 'f', look: 1, college: '机电学院', major: '机械设计', year: 2024 } as never, x: shore.x, y: shore.y, seen: Date.now(), inv: { fishing_rod: 1, bait: 20 } });
    const c = await client(srv.port, '归位', tok('H'));
    const g = srv.game as unknown as { dropped: { list: () => { id: number; x: number; y: number; k?: string }[]; move: (id: number, x: number, y: number, now: number) => unknown }; boatMoors: { x: number; y: number }[]; boatHomeTick: (now: number) => void };
    return { c, g };
  };
  const atMoor = (g: { boatMoors: { x: number; y: number }[] }, b: { x: number; y: number }) => g.boatMoors.some((m) => Math.hypot(m.x - b.x, m.y - b.y) < 1);

  it('没人用的船会自己漂回停船点（湖心 60 秒就回来），已经在停船点的不会被搬来搬去', async () => {
    const { c, g } = await setup();
    const drops = await c.wait('bike_drops');
    const boat = drops.list.filter((b) => b.k === 'boat')[0];
    expect(BOAT_STRANDED_MS).toBeLessThan(BOAT_HOME_MS);
    // 造一条"被丢在湖心、放了 2 分钟"的船
    g.dropped.move(boat.id, center.x, center.y, Date.now() - BOAT_STRANDED_MS - 1000);
    c.msgs.length = 0;
    g.boatHomeTick(Date.now());
    const back = g.dropped.list().find((b) => b.id === boat.id)!;
    expect(atMoor(g, back), `应该回到停船点：${back.x},${back.y}`).toBe(true);
    await c.wait('bike_drop', 0, 3000, (m) => m.bike.id === boat.id); // 客户端收到"这条船挪位置了"（同一个 id）
    // 再 tick 一次（很久以后）：已经在停船点上，不动
    const before = { x: back.x, y: back.y };
    c.msgs.length = 0;
    g.boatHomeTick(Date.now() + BOAT_HOME_MS * 2);
    const after = g.dropped.list().find((b) => b.id === boat.id)!;
    expect(after.x).toBe(before.x); expect(after.y).toBe(before.y);
    expect(c.msgs.some((m) => m.t === 'bike_drop')).toBe(false); // 没白搬
  });

  it('船少了会自己补回来：停在岸边的 + 有人正划着的算在一起，不会越补越多', async () => {
    const { c, g } = await setup();
    await c.wait('bike_drops');
    const take = (id: number) => (g.dropped as unknown as { take: (id: number) => boolean }).take(id);
    const boatsNow = () => g.dropped.list().filter((b) => b.k === 'boat');
    const n0 = boatsNow().length;
    const cap = Math.min(BOAT_COUNT, g.boatMoors.length); // 小池塘停船点少，能放几条就几条
    expect(n0).toBe(cap);
    // 假装这几条船都被弄丢了：下一次秒级检查应该补回来
    for (const b of boatsNow()) take(b.id);
    g.boatHomeTick(Date.now());
    expect(boatsNow()).toHaveLength(n0);
    // 再 tick 几次不会再变多
    for (let i = 0; i < 3; i++) g.boatHomeTick(Date.now() + i * 1000);
    expect(boatsNow()).toHaveLength(n0);
    // 有人正划着的时候不重复补：脚下那一条不算"丢了"
    const p = G().get(c.uid)!;
    take(boatsNow()[0].id); p.riding = true; p.rideKind = 'boat';
    g.boatHomeTick(Date.now());
    expect(boatsNow()).toHaveLength(cap - 1);
  });

  it('划到湖心直接下线：船不会丢在湖中间（直接回停船点）', async () => {
    const { c, g } = await setup();
    await c.wait('bike_drops');
    const n0 = g.dropped.list().filter((b) => b.k === 'boat').length;
    c.send({ t: 'ride', on: true }); await c.wait('ride_result', 0, 4000, (m) => m.ok);
    const p = G().get(c.uid)!;
    p.x = center.x; p.y = center.y;
    c.ws.close(); await sleep(300);
    const boats = g.dropped.list().filter((b) => b.k === 'boat');
    expect(boats).toHaveLength(n0); // 一条不少
    expect(boats.some((b) => Math.hypot(b.x - center.x, b.y - center.y) < 40)).toBe(false); // 没有一条留在湖心
    expect(boats.some((b) => atMoor(g, b))).toBe(true); // 回到了停船点
  });
});
