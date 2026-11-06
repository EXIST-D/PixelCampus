import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { startServer } from '../server/index';
import { PlayerStore } from '../server/store';
import { PROTOCOL_VERSION, type ServerMsg } from '../src/shared/protocol';
import { validateProfile } from '../src/shared/profile';
import { LOTTERY_MAX_BATCH, LOTTERY_TICKET } from '../src/shared/lottery';

const W = 200;
const world = { width: W, height: W, collision: Array.from({ length: W }, () => '0'.repeat(W)), spawn: { x: 20, y: 20 }, pois: [] };
const open: WebSocket[] = [];
let srv: Awaited<ReturnType<typeof startServer>> | null = null;
afterEach(async () => { for (const w of open.splice(0)) w.terminate(); await srv?.close(); srv = null; });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tok = (k: string) => `lottoken${k}`.padEnd(24, k);
const profile = (name: string) => ({ name, gender: 'f' as const, look: 1, college: '机电学院', major: '机械设计', year: 2024 });

async function client(port: number, name: string, token: string) {
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
  return { ws, send, msgs, wait, uid: w.uid };
}

describe('彩票榜（名人堂 · 彩票分区）', () => {
  it('刮过奖就会上榜：lot_book 里 top 有自己的名字、me 记着累计、rank = 1；没刮过的人 rank = 0', async () => {
    srv = await startServer({ port: 0, world, game: { mons: { gift: false } } });
    const a = await client(srv.port, '刮奖的人', tok('A')), b = await client(srv.port, '没刮的人', tok('B'));
    // 给 A 塞 10 张票（正常是商店买）
    const key = PlayerStore.key(tok('A'));
    srv.store.get(key)!.inv = { [LOTTERY_TICKET]: 10 }; srv.store.touch();
    let n = a.msgs.length;
    a.send({ t: 'lot_draw', n: 10 });
    const res = await a.wait('lot_result', n);
    expect(res.prizes).toHaveLength(10);
    // 保底：连续 5 张白板后第 6 张必中，所以 10 张不可能全空
    expect(res.total).toBeGreaterThan(0);
    n = a.msgs.length; a.send({ t: 'lot_book' });
    const book = await a.wait('lot_book', n);
    expect(book.me.n).toBe(10); expect(book.me.won).toBe(res.total); expect(book.me.best).toBe(Math.max(...res.prizes));
    expect(book.top.map((x) => x.uid)).toContain(a.uid);
    expect(book.top[0]).toMatchObject({ uid: a.uid, name: '刮奖的人', won: res.total });
    expect(book.rank).toBe(1);
    // 没刮过的人：榜单里能看到别人，自己 rank 0
    n = b.msgs.length; b.send({ t: 'lot_book' });
    const book2 = await b.wait('lot_book', n);
    expect(book2.me.n).toBe(0); expect(book2.rank).toBe(0);
    expect(book2.top.map((x) => x.name)).toContain('刮奖的人');
  });

  it('按累计中奖排、只取前 10；我排第 12 时 rank 仍然是 12（名次不受截断影响）', async () => {
    srv = await startServer({ port: 0, world, game: { mons: { gift: false } } });
    // 造 12 个「刮过奖」的存档，累计中奖从 1200 递减到 100
    for (let i = 0; i < 12; i++) {
      srv.store.set(PlayerStore.key(tok('P' + i)), {
        profile: profile('榜' + (i + 1)) as never, seen: Date.now(), uid: srv.store.ensureUid(PlayerStore.key(tok('P' + i))),
        lt: { n: 10, won: 1200 - i * 100, best: 400, hits: 3 },
      });
    }
    const me = await client(srv.port, '榜12', tok('P11')); // 累计 100，排第 12
    let n = me.msgs.length; me.send({ t: 'lot_book' });
    const book = await me.wait('lot_book', n);
    expect(book.top).toHaveLength(10); // 只给前 10
    expect(book.top.map((x) => x.won)).toEqual([1200, 1100, 1000, 900, 800, 700, 600, 500, 400, 300]);
    expect(book.top.every((x) => x.uid !== me.uid)).toBe(true); // 第 12 名不在前 10 里
    expect(book.rank).toBe(12); // 但自己知道自己是第 12
    expect(book.me).toMatchObject({ n: 10, won: 100 });
  });

  it('赚钱榜：只收真的赚了的（中奖 − 张数×票价），和亏钱榜互不重叠；刚好回本两边都不上', async () => {
    srv = await startServer({ port: 0, world, game: { mons: { gift: false } } });
    const P = (i: number) => PlayerStore.key(tok('G' + i));
    const seed = (i: number, n: number, won: number) => srv!.store.set(P(i), {
      profile: profile('赚' + i) as never, seen: Date.now(), uid: srv!.store.ensureUid(P(i)),
      lt: { n, won, best: Math.min(won, 500), hits: 1 },
    });
    seed(0, 10, 5000);   // 花 3000 中 5000 → 赚 2000
    seed(1, 10, 3600);   // 花 3000 中 3600 → 赚 600
    seed(2, 10, 3000);   // 刚好回本 → 两边都不上
    seed(3, 10, 1000);   // 亏 2000
    const me = await client(srv.port, '赚0', tok('G0'));
    let n = me.msgs.length; me.send({ t: 'lot_book' });
    const book = await me.wait('lot_book', n);
    expect(book.gain!.map((x) => [x.name, x.gain])).toEqual([['赚0', 2000], ['赚1', 600]]);
    expect(book.loss!.map((x) => [x.name, x.loss])).toEqual([['赚3', 2000]]);   // 回本的「赚2」不在亏钱榜
    expect(book.myGain).toBe(2000); expect(book.gainRank).toBe(1);
    expect(book.myLoss).toBe(0); expect(book.lossRank).toBe(0);
    // 亏的那个人看：赚钱榜里没有自己
    const loser = await client(srv.port, '赚3', tok('G3'));
    n = loser.msgs.length; loser.send({ t: 'lot_book' });
    const b2 = await loser.wait('lot_book', n);
    expect(b2.myGain).toBe(0); expect(b2.gainRank).toBe(0);
    expect(b2.myLoss).toBe(2000); expect(b2.lossRank).toBe(1);
    expect(b2.gain!.every((x) => x.uid !== loser.uid)).toBe(true);
  });
});
