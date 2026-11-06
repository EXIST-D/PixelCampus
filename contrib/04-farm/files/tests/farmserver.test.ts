import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { startServer } from '../server/index';
import { PlayerStore } from '../server/store';
import { PROTOCOL_VERSION, type ServerMsg } from '../src/shared/protocol';
import { validateProfile } from '../src/shared/profile';
import { FARM_PLOTS } from '../src/shared/farm';

const W = 60;
const world = {
  width: W, height: W,
  collision: Array.from({ length: W }, () => '0'.repeat(W)),
  spawn: { x: 20, y: 20 }, pois: [],
};
const open: WebSocket[] = [];
let srv: Awaited<ReturnType<typeof startServer>> | null = null;
afterEach(async () => { for (const w of open.splice(0)) w.terminate(); await srv?.close(); srv = null; });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tok = (k: string) => `farmtoken${k}`.padEnd(24, k);
const profile = (name: string) => ({ name, gender: 'f' as const, look: 1, college: '机电学院', major: '机械设计', year: 2024 });

async function client(port: number, name: string, token: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`); open.push(ws);
  const msgs: ServerMsg[] = [];
  ws.on('message', (d, bin) => { if (!bin) msgs.push(JSON.parse(d.toString()) as ServerMsg); });
  await new Promise<void>((r, j) => { ws.on('open', () => r()); ws.on('error', j); });
  const send = (m: unknown) => ws.send(JSON.stringify(m));
  const wait = async <T extends ServerMsg['t']>(t: T, from = 0, ms = 4000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const m = msgs.slice(from).find((x): x is Extract<ServerMsg, { t: T }> => x.t === t);
      if (m) return m;
      await sleep(15);
    }
    throw new Error(`等不到 ${t}`);
  };
  const r = validateProfile(profile(name)); if (!r.ok) throw new Error(r.error);
  send({ t: 'hello', v: PROTOCOL_VERSION, token, profile: r.profile });
  const welcome = await wait('welcome');
  return { ws, msgs, send, wait, uid: welcome.uid };
}

/** 造一个有钱的号（种子要花钱） */
async function setup(coin = 500) {
  srv = await startServer({ port: 0, world, game: { mons: { gift: false } } });
  const a = await client(srv.port, '农场主', tok('A'));
  const s = srv!;
  const key = PlayerStore.key(tok('A'));
  s.store.get(key)!.coin = coin; s.store.touch();
  return { a, key };
}

describe('实验田服务端', () => {
  it('不在田里不能动手（客户端骗不了）', async () => {
    const { a } = await setup();
    const n = a.msgs.length;
    a.send({ t: 'farm_act', op: 'plant', i: 0, k: 'potato' });
    const r = await a.wait('farm_result', n);
    expect(r.ok).toBe(false);
    expect(r.msg).toContain('实验田');
  });

  it('进门 → 种 → 浇满 → 收，钱和地块都对得上', async () => {
    const { a, key } = await setup(500);
    let n = a.msgs.length;
    a.send({ t: 'farm_go' });
    await a.wait('farm_in', n);
    const data = await a.wait('farm_data', n);
    expect(data.plots.length).toBe(FARM_PLOTS);
    expect(data.plots.every((p) => p === null)).toBe(true);
    expect(data.empty).toBe(FARM_PLOTS);

    // 种土豆（种子 45）
    n = a.msgs.length;
    a.send({ t: 'farm_act', op: 'plant', i: 3, k: 'potato' });
    const p = await a.wait('farm_result', n);
    expect(p.ok).toBe(true);
    expect(srv!.store.get(key)!.coin).toBe(500 - 45);

    // 同一格再种 → 拒绝
    n = a.msgs.length;
    a.send({ t: 'farm_act', op: 'plant', i: 3, k: 'cabbage' });
    expect((await a.wait('farm_result', n)).ok).toBe(false);

    // 浇 3 次（土豆要 3 次）——但同一天只能浇一次
    n = a.msgs.length;
    a.send({ t: 'farm_act', op: 'water', i: 3 });
    expect((await a.wait('farm_result', n)).ok).toBe(true);
    n = a.msgs.length;
    a.send({ t: 'farm_act', op: 'water', i: 3 });
    const again = await a.wait('farm_result', n);
    expect(again.ok).toBe(false);
    expect(again.msg).toContain('今天已经浇过');

    // 直接把进度补满，验证收获
    srv!.store.get(key)!.fm = { p: [{ k: 'potato', g: 3, wd: 1 }, null, null, null, null, null, null, null, null, null, null, null] };
    srv!.store.touch();
    const before = srv!.store.get(key)!.coin!;
    n = a.msgs.length;
    a.send({ t: 'farm_act', op: 'harvest', i: 0 });
    const h = await a.wait('farm_result', n);
    expect(h.ok).toBe(true);
    expect(srv!.store.get(key)!.coin!).toBeGreaterThan(before);       // 收到钱
    expect(srv!.store.get(key)!.fm?.p?.[0] ?? null).toBeNull();        // 格子清空
  });

  it('没熟不能收；浇满了不用再浇', async () => {
    const { a, key } = await setup(500);
    const n0 = a.msgs.length;
    a.send({ t: 'farm_go' }); await a.wait('farm_in', n0);
    srv!.store.get(key)!.fm = { p: [{ k: 'pumpkin', g: 1, wd: 1 }, null, null, null, null, null, null, null, null, null, null, null] };
    srv!.store.touch();
    let n = a.msgs.length;
    a.send({ t: 'farm_act', op: 'harvest', i: 0 });
    const r1 = await a.wait('farm_result', n);
    expect(r1.ok).toBe(false);
    expect(r1.msg).toContain('还没熟');

    srv!.store.get(key)!.fm = { p: [{ k: 'pumpkin', g: 4, wd: 1 }, null, null, null, null, null, null, null, null, null, null, null] };
    srv!.store.touch();
    n = a.msgs.length;
    a.send({ t: 'farm_act', op: 'water', i: 0 });
    const r2 = await a.wait('farm_result', n);
    expect(r2.ok).toBe(false);
    expect(r2.msg).toContain('能收了');
  });

  it('一键浇水：只浇该浇的，熟了的不浇', async () => {
    const { a, key } = await setup(500);
    const n0 = a.msgs.length;
    a.send({ t: 'farm_go' }); await a.wait('farm_in', n0);
    const day = Math.floor((Date.now() + 8 * 3600e3) / 86400e3);
    srv!.store.get(key)!.fm = { p: [
      { k: 'potato', g: 1, wd: day - 1 },   // 该浇 → 2
      { k: 'potato', g: 1, wd: day },       // 今天浇过 → 不动
      { k: 'potato', g: 3, wd: day - 1 },   // 熟了 → 不浇
      null, null, null, null, null, null, null, null, null,
    ] };
    srv!.store.touch();
    const n = a.msgs.length;
    a.send({ t: 'farm_act', op: 'waterAll' });
    const r = await a.wait('farm_result', n);
    expect(r.ok).toBe(true);
    expect(r.msg).toContain('浇了 1 格');
    const p = srv!.store.get(key)!.fm!.p!;
    expect(p[0]).toEqual({ k: 'potato', g: 2, wd: day });
    expect(p[1]).toEqual({ k: 'potato', g: 1, wd: day });
    expect(p[2]).toEqual({ k: 'potato', g: 3, wd: day - 1 });
  });

  it('钱不够种不了', async () => {
    const { a, key } = await setup(10);
    const n0 = a.msgs.length;
    a.send({ t: 'farm_go' }); await a.wait('farm_in', n0);
    const n = a.msgs.length;
    a.send({ t: 'farm_act', op: 'plant', i: 0, k: 'pumpkin' });
    const r = await a.wait('farm_result', n);
    expect(r.ok).toBe(false);
    expect(r.msg).toContain('校园币不够');
    expect(srv!.store.get(key)!.fm?.p?.[0] ?? null).toBeNull();
  });

  it('地块落盘：重启后还在（农场不能只在内存里）', () => {
    const dir = require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'farm-'));
    const file = require('node:path').join(dir, 'players.json');
    const key = PlayerStore.key(tok('Z'));
    const s1 = new PlayerStore(file);
    s1.set(key, { profile: profile('存档') as never, seen: Date.now(), uid: 7, fm: { p: [{ k: 'potato', g: 2, wd: 5 }, null, null, null, null, null, null, null, null, null, null, null] } });
    s1.flush();
    const s2 = new PlayerStore(file);
    expect(s2.get(key)?.fm?.p?.[0]).toEqual({ k: 'potato', g: 2, wd: 5 });
    require('node:fs').rmSync(dir, { recursive: true, force: true });
  });
});
