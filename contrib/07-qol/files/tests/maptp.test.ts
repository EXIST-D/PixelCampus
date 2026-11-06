import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { startServer } from '../server/index';
import { PROTOCOL_VERSION, type ServerMsg } from '../src/shared/protocol';
import { validateProfile } from '../src/shared/profile';

const W = 100;
const world = { width: W, height: W, collision: Array.from({ length: W }, () => '0'.repeat(W)), spawn: { x: 20, y: 20 } };
const open: WebSocket[] = [];
let srv: Awaited<ReturnType<typeof startServer>> | null = null;
afterEach(async () => { for (const w of open.splice(0)) w.terminate(); await srv?.close(); srv = null; });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function client(port: number, name: string, token: string) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`); open.push(ws);
  const msgs: ServerMsg[] = [];
  ws.on('message', (d, bin) => { if (!bin) msgs.push(JSON.parse(d.toString())); });
  await new Promise<void>((r, j) => { ws.on('open', () => r()); ws.on('error', j); });
  const r = validateProfile({ gender: 'f', look: 1, name, college: '机电学院', major: '机械设计', year: 2024 }); if (!r.ok) throw new Error(r.error);
  ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, token, profile: r.profile }));
  for (let i = 0; i < 100 && !msgs.some((m) => m.t === 'welcome'); i++) await sleep(15);
  const send = (m: unknown) => ws.send(JSON.stringify(m));
  const wait = async <T extends ServerMsg['t']>(t: T, from = 0, ms = 2500) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { const m = msgs.slice(from).find((x) => x.t === t); if (m) return m as Extract<ServerMsg, { t: T }>; await sleep(15); }
    throw new Error(`等不到 ${t}`);
  };
  return { ws, msgs, send, wait };
}
type C = Awaited<ReturnType<typeof client>>;
const GIFT = { mons: { gift: false } };
let n = 0; const tok = () => `maptp${++n}`.padEnd(24, 'q');

const tp = async (c: C, x: number, y: number) => { const i = c.msgs.length; c.send({ t: 'tp_map', x, y }); return c.wait('tp_result', i); };

describe('地图传送（所有人可用）', () => {
  it('点地图上一个能站的空点 → 传送成功，并给一句「已传送到 …」', async () => {
    srv = await startServer({ port: 0, world, game: GIFT });
    const c = await client(srv.port, '传送甲', tok());
    const r = await tp(c, 60 * 16, 60 * 16);
    expect(r.ok).toBe(true);
    expect(r.msg).toContain('已传送到');
    // 服务器把人挪过去了：再传一次同一点（15 秒冷却内）应该被拦
    const again = await tp(c, 70 * 16, 70 * 16);
    expect(again.ok).toBe(false);
    expect(again.msg).toContain('冷却');
  });

  it('落在建筑/水里也没关系：会自动挪到旁边能站的地方', async () => {
    // 中间挖一块 1 格阻挡，点在正中间
    const rows = Array.from({ length: W }, (_, y) => Array.from({ length: W }, (_, x) => (x === 50 && y === 50 ? '1' : '0')).join(''));
    srv = await startServer({ port: 0, world: { ...world, collision: rows }, game: GIFT });
    const c = await client(srv.port, '传送乙', tok());
    const r = await tp(c, 50 * 16 + 8, 50 * 16 + 8);
    expect(r.ok).toBe(true); // 旁边有能站的地方
  });

  it('地图外、非法坐标 → 拒绝并说明原因', async () => {
    srv = await startServer({ port: 0, world, game: GIFT });
    const c = await client(srv.port, '传送丙', tok());
    expect((await tp(c, -5, 10)).ok).toBe(false);
    const out = await tp(c, (W + 10) * 16, 10);
    expect(out.ok).toBe(false);
    expect(out.msg).toContain('不在地图里');
  });
});
