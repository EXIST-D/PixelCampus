import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WorldMap } from '../src/world/WorldMap';
import WebSocket from 'ws';
import { startServer } from '../server/index';
import { PlayerStore } from '../server/store';
import { PROTOCOL_VERSION, FLAG_TANDEM, FLAG_RIDE, type ServerMsg } from '../src/shared/protocol';
import { validateProfile } from '../src/shared/profile';
import { TANDEM_SPEED_MULT, tandemSpots } from '../src/shared/bikes';

const W = 200;
/** 测试用的停车点（世界只有 200×200 格，真实点位在校园地图上，见下面的规则测试） */
const T = { x: 1000, y: 1000 };
const world = {
  width: W, height: W, collision: Array.from({ length: W }, () => '0'.repeat(W)), spawn: { x: 20, y: 20 }, pois: [],
  bikes: [{ x: 200, y: 200 }],
  tandems: [{ x: T.x, y: T.y }],
};
const open: WebSocket[] = [];
let srv: Awaited<ReturnType<typeof startServer>> | null = null;
afterEach(async () => { for (const w of open.splice(0)) w.terminate(); await srv?.close(); srv = null; });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tok = (k: string) => `tandemtoken${k}`.padEnd(24, k);
const profile = (name: string) => ({ name, gender: 'f' as const, look: 1, college: '机电学院', major: '机械设计', year: 2024 });

async function client(port: number, name: string, token: string, at: { x: number; y: number }) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`); open.push(ws);
  const msgs: ServerMsg[] = [];
  ws.on('message', (d, bin) => { if (!bin) msgs.push(JSON.parse(d.toString()) as ServerMsg); });
  await new Promise<void>((r, j) => { ws.on('open', () => r()); ws.on('error', j); });
  const send = (m: unknown) => ws.send(JSON.stringify(m));
  const wait = async <T extends ServerMsg['t']>(t: T, from = 0, ms = 4000, f: (m: Extract<ServerMsg, { t: T }>) => boolean = () => true) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { const m = msgs.slice(from).find((x): x is Extract<ServerMsg, { t: T }> => x.t === t && f(x as Extract<ServerMsg, { t: T }>)); if (m) return m; await sleep(15); }
    throw new Error(`等不到 ${t}`);
  };
  const r = validateProfile(profile(name)); if (!r.ok) throw new Error(r.error);
  send({ t: 'hello', v: PROTOCOL_VERSION, token, profile: r.profile });
  const w = await wait('welcome');
  return { ws, send, msgs, wait, uid: w.uid, id: w.id, at };
}
const G = (s: NonNullable<typeof srv>) => s.game as unknown as { byUid: Map<number, { x: number; y: number; riding: boolean; rideKind: string; flags: number; passenger: number; paxOf: number }> };

describe('双人自行车（规则）', () => {
  it('校园里停了 4 辆双人车：位置互不重叠、都在地图里；速度比共享单车快', () => {
    const spots = tandemSpots();
    expect(spots).toHaveLength(4);
    for (const a of spots) for (const b of spots) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(40);
    expect(TANDEM_SPEED_MULT).toBeGreaterThan(1);
  });
});

describe('双人自行车（服务器）', () => {
  it('停在双人车旁边按 E 骑的就是双人车：服务端记车型、flags 带 FLAG_TANDEM、共享单车的点仍然是普通车', async () => {
    srv = await startServer({ port: 0, world, game: { mons: { gift: false } } });
    const key = PlayerStore.key(tok('A'));
    srv.store.set(key, { profile: profile('骑手') as never, x: T.x, y: T.y, seen: Date.now() });
    const a = await client(srv.port, '骑手', tok('A'), { x: T.x, y: T.y });
    let n = a.msgs.length; a.send({ t: 'ride', on: true });
    const r = await a.wait('ride_result', n);
    expect(r.ok).toBe(true); expect(r.kind).toBe('tandem');
    const p = G(srv).byUid.get(a.uid)!;
    expect(p.riding).toBe(true); expect(p.rideKind).toBe('tandem');
    expect(p.flags & FLAG_TANDEM).toBe(FLAG_TANDEM); expect(p.flags & FLAG_RIDE).toBe(FLAG_RIDE);
    // 锁车：车留在脚边，且标明是双人车（别人能接着骑）
    n = a.msgs.length; a.send({ t: 'ride', on: false });
    expect((await a.wait('ride_result', n)).ok).toBe(true);
    const drop = await a.wait('bike_drop', n);
    expect(drop.bike.k).toBe('tandem');
    expect(G(srv).byUid.get(a.uid)!.flags & (FLAG_RIDE | FLAG_TANDEM)).toBe(0);
    // 共享单车点：还是普通车
    const key2 = PlayerStore.key(tok('B'));
    srv.store.set(key2, { profile: profile('路人') as never, x: 200, y: 200, seen: Date.now() });
    const b = await client(srv.port, '路人', tok('B'), { x: 200, y: 200 });
    n = b.msgs.length; b.send({ t: 'ride', on: true });
    const r2 = await b.wait('ride_result', n);
    expect(r2.kind).toBe('bike'); expect(G(srv).byUid.get(b.uid)!.rideKind).toBe('bike');
  });

  it('后座：双人车谁都能坐（不用组队），共享单车还是只能坐队友的', async () => {
    srv = await startServer({ port: 0, world, game: { mons: { gift: false } } });
    // A 骑双人车，B 是陌生人
    srv.store.set(PlayerStore.key(tok('C')), { profile: profile('司机') as never, x: T.x, y: T.y, seen: Date.now() });
    srv.store.set(PlayerStore.key(tok('D')), { profile: profile('同学') as never, x: T.x + 20, y: T.y + 6, seen: Date.now() });
    const a = await client(srv.port, '司机', tok('C'), { x: T.x, y: T.y });
    const b = await client(srv.port, '同学', tok('D'), { x: T.x + 20, y: T.y + 6 });
    let n = a.msgs.length; a.send({ t: 'ride', on: true }); expect((await a.wait('ride_result', n)).kind).toBe('tandem');
    // 陌生人坐后座：可以
    n = b.msgs.length; b.send({ t: 'pax_join', uid: a.uid });
    const ok = await b.wait('pax_result', n);
    expect(ok.ok).toBe(true); expect(ok.pid).toBe(a.id); expect(ok.kind).toBe('tandem');
    expect(G(srv).byUid.get(b.uid)!.paxOf).toBe(a.uid);
    expect(G(srv).byUid.get(a.uid)!.passenger).toBe(b.uid);
    // 后座只坐一个：第三个人上不来
    srv.store.set(PlayerStore.key(tok('E')), { profile: profile('第三人') as never, x: T.x + 10, y: T.y, seen: Date.now() });
    const c = await client(srv.port, '第三人', tok('E'), { x: T.x + 10, y: T.y });
    n = c.msgs.length; c.send({ t: 'pax_join', uid: a.uid });
    expect((await c.wait('pax_result', n)).ok).toBe(false);
  });

  it('共享单车仍然只让队友坐后座（不是队友就被拒）', async () => {
    srv = await startServer({ port: 0, world, game: { mons: { gift: false } } });
    srv.store.set(PlayerStore.key(tok('F')), { profile: profile('骑车人') as never, x: 200, y: 200, seen: Date.now() });
    srv.store.set(PlayerStore.key(tok('G')), { profile: profile('陌生人') as never, x: 214, y: 204, seen: Date.now() });
    const a = await client(srv.port, '骑车人', tok('F'), { x: 200, y: 200 });
    const b = await client(srv.port, '陌生人', tok('G'), { x: 214, y: 204 });
    let n = a.msgs.length; a.send({ t: 'ride', on: true }); expect((await a.wait('ride_result', n)).kind).toBe('bike');
    n = b.msgs.length; b.send({ t: 'pax_join', uid: a.uid });
    const res = await b.wait('pax_result', n);
    expect(res.ok).toBe(false); expect(res.msg).toContain('队友');
  });
});

describe.skipIf(!existsSync(join(__dirname, '..', 'public', 'assets', 'generated', 'world.json')))('双人车停放点（真实校园地图）', () => {
  it('4 个点都站得住（不在水里、不在建筑里），玩家走过去就能按 E 骑', () => {
    const w = JSON.parse(readFileSync(join(__dirname, '..', 'public', 'assets', 'generated', 'world.json'), 'utf8'));
    const map = new WorldMap({ width: w.width, height: w.height, collision: w.collision });
    for (const s of tandemSpots()) {
      expect(s.x, `x=${s.x}`).toBeGreaterThan(0); expect(s.x).toBeLessThan(map.pxW);
      expect(s.y, `y=${s.y}`).toBeGreaterThan(0); expect(s.y).toBeLessThan(map.pxH);
      expect(map.boxBlocked(s.x, s.y), `${s.x},${s.y} 卡在障碍里`).toBe(false);
    }
  });
});
