import { describe, expect, it, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PlayerStore } from '../server/store';
import { repairProfile, LOOK_CHOICES } from '../src/shared/profile';

const dir = mkdtempSync(join(tmpdir(), 'ph-store-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const base = { v: 1, name: '小明', gender: 'm', look: 0, college: '机电工程学院', major: '机械设计制造', year: 2025, motto: '', cardNo: '2025000001' };

describe('坏档案不会把玩家变成新号', () => {
  it('造型号不合法：换成该性别的第一个造型，其余字段保留', () => {
    const r = repairProfile({ ...base, look: 99 });
    expect(r?.profile.look).toBe(LOOK_CHOICES.m[0]);
    expect(r?.profile.name).toBe('小明');
    expect(r?.fixed).toContain('造型');
  });

  it('名字/学院/专业空了：补默认值（至少还能登进去找回背包）', () => {
    const r = repairProfile({ ...base, name: '   ', college: undefined, major: null });
    expect(r?.profile.name).toBe('同学');
    expect(r?.profile.college).toBe('未填写学院');
    expect(r?.profile.major).toBe('未填写专业');
    expect(r?.fixed).toEqual(expect.arrayContaining(['姓名', '学院', '专业']));
  });

  it('性别缺失/错乱：按男生兜底，造型跟着换到男生里有的那个', () => {
    const r = repairProfile({ ...base, gender: 'x', look: 1 }); // look 1 是女生的
    expect(r?.profile.gender).toBe('m');
    expect(LOOK_CHOICES.m).toContain(r!.profile.look);
  });

  it('完全不是对象才丢掉', () => {
    expect(repairProfile(null)).toBeUndefined();
    expect(repairProfile('abc')).toBeUndefined();
  });

  it('启动时整库载入：坏档案被修好收下，uid/背包都还在', () => {
    const file = join(dir, 'players.json');
    writeFileSync(file, JSON.stringify({
      k_valid: { profile: base, x: 1, y: 2, uid: 1, inv: { bait: 5 } },
      k_badlook: { profile: { ...base, look: 42 }, x: 3, y: 4, uid: 2, inv: { bait: 7 }, coin: 300 },
      k_broken: { profile: 'not-an-object', x: 0, y: 0, uid: 3 },
    }));
    const store = new PlayerStore(file);
    expect(store.size).toBe(2);                       // 坏的那条（根本不是对象）被丢掉
    expect(store.get('k_valid')?.uid).toBe(1);
    expect(store.get('k_badlook')?.uid).toBe(2);
    expect(store.get('k_badlook')?.profile.look).toBe(LOOK_CHOICES.m[0]);
    expect(store.get('k_badlook')?.inv?.bait).toBe(7); // 背包没丢
    expect(store.get('k_badlook')?.coin).toBe(300);    // 校园币没丢
  });
});
