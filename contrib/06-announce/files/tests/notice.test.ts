import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { splitLinks } from '../src/shared/notice';
import { ANNOUNCE } from '../src/shared/announce';
import { Notices } from '../server/notices';

describe('公告里的链接', () => {
  it('只把 http(s) 地址切出来，其余原样保留', () => {
    const segs = splitLinks('去 https://github.com/EXIST-D 看看，谢谢。');
    expect(segs.map((s) => s.url ?? s.text)).toEqual(['去 ', 'https://github.com/EXIST-D', ' 看看，谢谢。']);
  });
  it('没有链接时就是一段文本', () => {
    expect(splitLinks('没有链接')).toEqual([{ text: '没有链接' }]);
  });
  it('英文句末标点不算进链接里', () => {
    const segs = splitLinks('见 https://example.com/a.');
    expect(segs[1].url).toBe('https://example.com/a');
    expect(segs.at(-1)?.text).toBe('.');
  });
  it('开场公告本身能切出两条 GitHub 链接，并且写着群号', () => {
    const urls = splitLinks(ANNOUNCE.body).filter((s) => s.url).map((s) => s.url);
    expect(urls).toContain(ANNOUNCE.repo);
    expect(urls).toContain(ANNOUNCE.author);
    expect(ANNOUNCE.body).toContain(ANNOUNCE.qq);
  });
});

describe('公告存储：开场公告只在第一次开服时写入', () => {
  const dirs: string[] = [];
  const tmpFile = () => { const d = mkdtempSync(join(tmpdir(), 'pc-notice-')); dirs.push(d); return join(d, 'notices.json'); };
  afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

  it('文件不存在 → 写入一条；再开一次不会重复', () => {
    const f = tmpFile();
    const a = new Notices(f, ANNOUNCE);
    expect(a.list()).toHaveLength(1);
    expect(a.list()[0]).toMatchObject({ title: ANNOUNCE.title, body: ANNOUNCE.body });
    expect(new Notices(f, ANNOUNCE).list()).toHaveLength(1);
  });
  it('管理员删光了也不会重新冒出来', () => {
    const f = tmpFile();
    const a = new Notices(f, ANNOUNCE);
    a.remove(a.list()[0].id);
    expect(new Notices(f, ANNOUNCE).list()).toEqual([]);
  });
  it('开场公告的内容改了（比如群号换了）→ 就地更新，id 变新、只会重新弹一次', () => {
    const f = tmpFile();
    const first = new Notices(f, ANNOUNCE).list()[0];
    const changed = { title: ANNOUNCE.title, body: ANNOUNCE.body.replace(ANNOUNCE.qq, '100000000') };
    const b = new Notices(f, changed);
    expect(b.list()).toHaveLength(1);
    expect(b.list()[0].body).toContain('100000000');
    expect(b.list()[0].id).toBeGreaterThan(first.id);
    expect(new Notices(f, changed).list()[0].id).toBe(b.list()[0].id); // 内容没再变，就不动
  });
  it('不给 seed（测试与开发默认）时不写入任何东西', () => {
    const f = tmpFile();
    expect(new Notices(f).list()).toEqual([]);
    expect(existsSync(f)).toBe(false);
  });
});

describe('多条种子公告（新手必读 + 支持作者）', () => {
  const dirs: string[] = [];
  const tmpFile = () => { const d = mkdtempSync(join(tmpdir(), 'pc-notice2-')); dirs.push(d); return join(d, 'notices.json'); };
  afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
  const A = { title: '支持一下开源作者', body: '去点 star' };
  const B = { title: '新手必读', body: '这里有什么' };

  it('新加一条种子公告：已经存在的老公告不动，新那条补上（排在最前面）', () => {
    const f = tmpFile();
    new Notices(f, [A]); // 第一次只有 A
    const n = new Notices(f, [A, B]);
    expect(n.list().map((x) => x.title)).toEqual([B.title, A.title]);
  });
  it('同一条公告内容变了 → 就地更新并换成新 id；没变就不动', () => {
    const f = tmpFile();
    const id = new Notices(f, [A, B]).list().find((x) => x.title === B.title)!.id;
    const same = new Notices(f, [A, B]);
    expect(same.list().find((x) => x.title === B.title)!.id).toBe(id);
    const changed = new Notices(f, [A, { title: B.title, body: '改了内容' }]);
    const row = changed.list().find((x) => x.title === B.title)!;
    expect(row.body).toBe('改了内容');
    expect(row.id).toBeGreaterThan(id);
  });
  it('管理员删掉的种子公告不会再被写回来（用 seeded 记着）', () => {
    const f = tmpFile();
    const first = new Notices(f, [A, B]);
    first.remove(first.list().find((x) => x.title === B.title)!.id);
    const again = new Notices(f, [A, B]);
    expect(again.list().map((x) => x.title)).toEqual([A.title]);
  });
});
