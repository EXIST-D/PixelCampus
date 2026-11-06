import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { startServer } from '../server/index';
import { PlayerStore } from '../server/store';
import { PROTOCOL_VERSION, type ServerMsg } from '../src/shared/protocol';
import { validateProfile } from '../src/shared/profile';
import { BET, betPrize } from '../src/shared/fishbet';
import { sellPrice } from '../src/shared/economy';
import { dayNo } from '../server/progress';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const W = 200;
/** 赌鱼摊的互动区（像素坐标）：摊位在 (100, 100) 格，玩家出生点正好站在前面 */
const SPOT = { x: 96 * 16, y: 100 * 16, w: 8 * 16, h: 3 * 16 };
const world = {
  width: W, height: W,
  collision: Array.from({ length: W }, () => '0'.repeat(W)),
  spawn: { x: 100, y: 101 }, pois: [], spots: { fishbet: SPOT },
};
const open: WebSocket[] = [];
let srv: Awaited<ReturnType<typeof startServer>> | null = null;
afterEach(async () => { for (const w of open.splice(0)) w.terminate(); await srv?.close(); srv = null; });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tok = (k: string) => `bettoken${k}`.padEnd(24, k);
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
  await wait('welcome');
  return { ws, send, msgs, wait };
}

describe('赌鱼铺（服务器结算）', () => {
  it('押一条鱼：扣鱼、给 4 条泳道、名次 1~4；只有第一名才有奖', async () => {
    srv = await startServer({ port: 0, world, game: { mons: { gift: false } } });
    const a = await client(srv.port, '赌鱼佬', tok('A'));
    const key = PlayerStore.key(tok('A'));
    srv.store.get(key)!.inv = { fish_crucian: 3 };
    srv.store.touch();

    let n = a.msgs.length;
    a.send({ t: 'fishbet', id: 'fish_crucian' });
    const r = await a.wait('fishbet_result', n);
    expect(r.ok).toBe(true);
    expect(r.lanes).toHaveLength(BET.LANES);
    expect(r.lanes.filter((l) => l.mine)).toHaveLength(1);
    expect(r.lanes[0].mine || r.lanes[1].mine || r.lanes[2].mine || r.lanes[3].mine).toBe(true);
    expect(r.rank).toBeGreaterThanOrEqual(1);
    expect(r.rank).toBeLessThanOrEqual(4);
    expect(r.lanes[r.rank - 1].mine).toBe(true);              // 名次和泳道顺序要对得上
    expect(new Set(r.lanes.map((l) => l.id)).size).toBe(BET.LANES); // 不重复
    // 押的那条鱼被扣掉了一条
    expect(srv.store.get(key)!.inv?.fish_crucian).toBe(2);
    // 第一名才有奖，奖金额 = 今日收购价 × 赔率
    const price = sellPrice('fish_crucian', dayNo(Date.now()));
    expect(r.prize).toBe(r.rank === 1 ? betPrize(price, 'common') : 0);
    if (r.prize > 0) expect(srv.store.get(key)!.coin).toBe(r.prize);
    // 战绩落库（名人堂赌鱼榜的数据来源）
    expect(srv.store.get(key)!.fb).toEqual({ n: 1, win: r.rank === 1 ? 1 : 0, got: r.prize, best: r.prize });
  });

  it('背包里没有这条鱼就被拒；杂物也不能押', async () => {
    srv = await startServer({ port: 0, world, game: { mons: { gift: false } } });
    const a = await client(srv.port, '空手', tok('B'));
    const key = PlayerStore.key(tok('B'));
    srv.store.get(key)!.inv = { boot: 2 };
    srv.store.touch();

    let n = a.msgs.length;
    a.send({ t: 'fishbet', id: 'fish_carp' });
    const r1 = await a.wait('fishbet_result', n);
    expect(r1.ok).toBe(false);
    expect(r1.msg).toContain('没有');

    n = a.msgs.length;
    a.send({ t: 'fishbet', id: 'boot' });
    const r2 = await a.wait('fishbet_result', n);
    expect(r2.ok).toBe(false);
    expect(r2.msg).toContain('杂物');
    expect(srv.store.get(key)!.inv?.boot).toBe(2);            // 没被扣
  });

  it('冷却：连着押第二把会被拦下，并告诉你还要等多久', async () => {
    srv = await startServer({ port: 0, world, game: { mons: { gift: false } } });
    const a = await client(srv.port, '连点党', tok('C'));
    const key = PlayerStore.key(tok('C'));
    srv.store.get(key)!.inv = { fish_crucian: 5 };
    srv.store.touch();

    let n = a.msgs.length;
    a.send({ t: 'fishbet', id: 'fish_crucian' });
    expect((await a.wait('fishbet_result', n)).ok).toBe(true);
    n = a.msgs.length;
    a.send({ t: 'fishbet', id: 'fish_crucian' });
    const r = await a.wait('fishbet_result', n);
    expect(r.ok).toBe(false);
    expect(r.wait).toBeGreaterThan(0);
    expect(r.wait).toBeLessThanOrEqual(BET.COOLDOWN_MS);
    expect(srv.store.get(key)!.inv?.fish_crucian).toBe(4);    // 第二把没扣鱼
  });

  it('名人堂赌鱼榜：按累计赢到的币排、平手看场次；名次和"我"的数据都对得上', async () => {
    srv = await startServer({ port: 0, world, game: { mons: { gift: false } } });
    // 造三个有战绩的号：A 赢 900（12 场 3 胜）、B 赢 900（20 场 4 胜）、C 赢 300
    const seed = (k: string, i: number, fb: { n: number; win: number; got: number; best: number }) => {
      const key = PlayerStore.key(tok(k));
      srv!.store.set(key, { profile: profile(`赌${i}`) as never, seen: Date.now(), uid: srv!.store.ensureUid(key), fb });
    };
    seed('E0', 0, { n: 12, win: 3, got: 900, best: 400 });
    seed('E1', 1, { n: 20, win: 4, got: 900, best: 300 });
    seed('E2', 2, { n: 5, win: 1, got: 300, best: 300 });
    const a = await client(srv.port, '赌2', tok('E2'));
    const n = a.msgs.length;
    a.send({ t: 'hall_get' });
    const h = await a.wait('hall', n);
    expect(h.bet.map((r) => r.name)).toEqual(['赌1', '赌0', '赌2']);    // 同为 900 时押得多的排前面
    expect(h.bet.map((r) => r.value)).toEqual([900, 900, 300]);
    expect(h.bet[0]).toMatchObject({ value: 900, extra: 20, win: 4 });
    expect(h.me.bet).toEqual({ value: 300, extra: 5, win: 1, rank: 3 });
    expect(h.total.bet).toBe(3);
    // 没玩过的号：不在榜上、rank 0
    const b = await client(srv.port, '路人', tok('E9'));
    const n2 = b.msgs.length;
    b.send({ t: 'hall_get' });
    const h2 = await b.wait('hall', n2);
    expect(h2.me.bet).toEqual({ value: 0, extra: 0, win: 0, rank: 0 });
    expect(h2.bet.some((r) => r.name === '路人')).toBe(false);
  });

  it('战绩落盘：重启后还在（名人堂不靠内存里的临时数据）', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fbstore-'));
    const file = join(dir, 'players.json');
    const key = PlayerStore.key(tok('F'));
    const s1 = new PlayerStore(file);
    s1.set(key, { profile: profile('存档哥') as never, seen: Date.now(), uid: 5, fb: { n: 12, win: 3, got: 900, best: 400 } });
    s1.flush();
    const s2 = new PlayerStore(file);
    expect(s2.get(key)?.fb).toEqual({ n: 12, win: 3, got: 900, best: 400 });
    rmSync(dir, { recursive: true, force: true });
  });

  it('离摊位太远不能押（位置由服务器的互动区判定，客户端骗不了）', async () => {
    srv = await startServer({ port: 0, world: { ...world, spawn: { x: 10, y: 10 } }, game: { mons: { gift: false } } });
    const a = await client(srv.port, '远处的人', tok('D'));
    const key = PlayerStore.key(tok('D'));
    srv.store.get(key)!.inv = { fish_crucian: 5 };
    srv.store.touch();
    const n = a.msgs.length;
    a.send({ t: 'fishbet', id: 'fish_crucian' });
    const r = await a.wait('fishbet_result', n);
    expect(r.ok).toBe(false);
    expect(r.msg).toContain('湖边');
    expect(srv.store.get(key)!.inv?.fish_crucian).toBe(5);
  });
});
