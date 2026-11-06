import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { startServer } from '../server/index';
import { PlayerStore } from '../server/store';
import { PROTOCOL_VERSION, type ServerMsg } from '../src/shared/protocol';
import { validateProfile } from '../src/shared/profile';

const W = 60;
const world = { width: W, height: W, collision: Array.from({ length: W }, () => '0'.repeat(W)), spawn: { x: 20, y: 20 }, pois: [] };
const open: WebSocket[] = [];
let srv: Awaited<ReturnType<typeof startServer>> | null = null;
afterEach(async () => { for (const w of open.splice(0)) w.terminate(); await srv?.close(); srv = null; });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 改名（学生证 → 修改资料）：只换显示名，不动身份。
 * 身份是 localStorage 里的 token（服务器存的是它的 sha256）→ 校园号 uid 永远不变；
 * 背包、校园币、宿舍家具、赌鱼战绩、图鉴都挂在同一个 key 上，所以改名一个都不会丢。
 */
describe('改名', () => {
  it('只换显示名：校园号、背包、校园币、宿舍、战绩、图鉴都还在', async () => {
    srv = await startServer({ port: 0, world, game: { mons: { gift: false } } });
    const token = 'renametoken0123456789abc';
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`); open.push(ws);
    const msgs: ServerMsg[] = [];
    ws.on('message', (d, bin) => { if (!bin) msgs.push(JSON.parse(d.toString()) as ServerMsg); });
    await new Promise<void>((r) => ws.on('open', () => r()));
    const p0 = validateProfile({ name: '原名', gender: 'm', look: 0, college: '机电学院', major: '机械设计', year: 2024 });
    if (!p0.ok) throw new Error(p0.error);
    ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, token, profile: p0.profile }));
    const wait = async <T extends ServerMsg['t']>(t: T, ms = 4000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) { const m = msgs.find((x) => x.t === t) as Extract<ServerMsg, { t: T }> | undefined; if (m) return m; await sleep(15); }
      throw new Error('等不到 ' + t);
    };
    const w1 = await wait('welcome');
    const key = PlayerStore.key(token);
    // 塞点数据进去：背包、币、宿舍一件家具、赌鱼战绩、图鉴
    const rec = srv.store.get(key)!;
    rec.inv = { fish_carp: 3 }; rec.coin = 777; rec.dm = { fr: [{ k: 'poster', x: 3, y: 2, rot: 0 }] } as never;
    rec.fb = { n: 5, win: 2, got: 300, best: 200 }; rec.fd = { fish_carp: { n: 3, best: 40, kg: 2 } }; srv.store.touch();
    // 改名
    const p1 = validateProfile({ name: '新名字', gender: 'm', look: 0, college: '机电学院', major: '机械设计', year: 2024 });
    if (!p1.ok) throw new Error(p1.error);
    ws.send(JSON.stringify({ t: 'profile', profile: p1.profile }));
    await sleep(800);
    const after = srv.store.get(key)!;
    expect(after.profile.name).toBe('新名字');
    expect(after.uid).toBe(w1.uid);
    expect(after.inv).toEqual({ fish_carp: 3 });
    expect(after.coin).toBe(777);
    expect(after.dm?.fr).toEqual([{ k: 'poster', x: 3, y: 2, rot: 0 }]);
    expect(after.fb).toEqual({ n: 5, win: 2, got: 300, best: 200 });
    expect(after.fd?.fish_carp?.n).toBe(3);
  });
});
