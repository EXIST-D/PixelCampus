// @vitest-environment happy-dom
/** 宿舍面板「刚送回校园的猫」：不小心送回去了，一键接回（不用走近、不用在校园里找它）。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NetClient } from '@/net/client';
import { DormPanel, type DormData } from '@/ui/DormPanel';

class FakeNet {
  handlers: Record<string, ((...a: any[]) => void) | undefined> = {};
  status = 'online'; dormCat = vi.fn(); dormGet = vi.fn(); dormGo = vi.fn(); dormBind = vi.fn();
}
let net: FakeNet;
beforeEach(() => { document.body.replaceChildren(); const hud = document.createElement('div'); hud.id = 'hud'; document.body.append(hud); net = new FakeNet(); });
const data = (o: Partial<DormData> = {}): DormData => ({ t: 'dorm_data', b: '三社区B楼', canChange: true, ac: 0, ch: {}, bv: {} as never, likes: 0, options: [], ...o } as DormData);
const rows = () => [...document.querySelectorAll('.dorm-cat-row')] as HTMLElement[];
const open = (m: DormData, info?: (id: number) => { name: string; why?: string } | null) => {
  const ui = new DormPanel(net as unknown as NetClient); if (info) ui.catInfo = info;
  net.handlers.dormData?.(m); ui.open(); net.handlers.dormData?.(m); return ui;
};

describe('宿舍面板：刚送回校园的猫', () => {
  it('没有送回过猫：不显示这一块', () => { open(data()); expect(rows()).toHaveLength(0); expect(document.body.textContent).not.toContain('刚送回校园的猫'); });

  it('每只送回的猫一行（名字 + 接回宿舍）；能接回的按钮可点，点一下发 dorm_cat(on=true)', () => {
    open(data({ dr: [47, 12] }), (id) => ({ name: id === 47 ? '蒲公英' : '大橘' }));
    expect(document.body.textContent).toContain('刚送回校园的猫'); expect(rows()).toHaveLength(2);
    expect(rows()[0].textContent).toContain('蒲公英'); expect(rows()[1].textContent).toContain('大橘');
    const btn = rows()[0].querySelector('button') as HTMLButtonElement; expect(btn.textContent).toBe('接回宿舍'); expect(btn.disabled).toBe(false);
    btn.click(); expect(net.dormCat).toHaveBeenCalledWith(47, true);
  });

  it('现在接不回来（没猫窝 / 住满了 / 好感不够…）：按钮置灰，原因写在名字下面；点了也不发请求', () => {
    open(data({ dr: [47] }), () => ({ name: '蒲公英', why: '宿舍里要先摆一个空着的「宿舍猫窝」' }));
    const btn = rows()[0].querySelector('button') as HTMLButtonElement; expect(btn.disabled).toBe(true);
    expect(rows()[0].textContent).toContain('宿舍猫窝'); btn.click(); expect(net.dormCat).not.toHaveBeenCalled();
  });

  it('没连服务器：不发请求并提示；拿不到猫的资料（还没加载）也有一行，用编号兜底', () => {
    const ui = open(data({ dr: [47] })); expect(rows()[0].textContent).toContain('#47');
    net.status = 'offline'; (rows()[0].querySelector('button') as HTMLButtonElement).click(); expect(net.dormCat).not.toHaveBeenCalled();
    void ui; expect(document.body.textContent).toContain('没连上服务器');
  });

  it('接回成功后服务器发来不带 dr 的数据：这一块消失', () => {
    open(data({ dr: [47] }), () => ({ name: '蒲公英' })); expect(rows()).toHaveLength(1);
    net.handlers.dormData?.(data({ dc: [47] })); expect(rows()).toHaveLength(0);
  });
});
