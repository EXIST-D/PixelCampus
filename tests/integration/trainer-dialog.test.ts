// @vitest-environment happy-dom
/**
 * 手机上和训练家切磋：「一点切磋，按钮就消失、什么都没发生」的回归测试。
 * 根因 1：手机上点对话框 = 翻页 / 关闭（pointerdown），按钮的 pointerdown 冒泡上去，对话框在 click 之前就先关了；
 * 根因 2：服务器拒绝（冷却中 / 队伍空 / 精灵没力气）的原因只在精灵面板 / 战斗界面开着时才显示，对话里什么都看不到。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('@/audio/sfx', () => ({ sfx: vi.fn() }));
import { openTrainerAsk } from '@/scenes/world/interaction';

const trainer = { id: 't1', name: '图书馆学长', before: '来一场切磋吧！' };
const npc = { trainer } as never;

/** 最小的场景替身：hud 的对话框行为和 Hud.ts 一致（单页对话，点一下 = 关闭） */
function fakeScene(over: { online?: boolean; battle?: boolean } = {}) {
  document.body.innerHTML = '<div id="dialog"><div id="dialog-title"></div><div id="dialog-body"></div><div id="dialog-foot"></div></div>';
  const body = document.getElementById('dialog-body')!, foot = document.getElementById('dialog-foot')!;
  const sc = {
    net: { status: over.online === false ? 'offline' : 'online', handlers: {} as Record<string, ((...a: unknown[]) => void) | undefined>, trainerBattle: vi.fn() },
    battleUi: { isOpen: !!over.battle }, pvpUi: { isOpen: false }, bossUi: { isOpen: false },
    hud: {
      dialogOpen: false,
      openDialog(_t: string, pages: string | string[]) { const p = Array.isArray(pages) ? pages : [pages]; body.textContent = p.join('\n'); foot.textContent = '点这里关闭'; this.dialogOpen = true; },
      closeDialog() { this.dialogOpen = false; },
    },
  };
  // WorldScene 里：点对话框（pointerdown）= 按一下互动键 → 单页对话直接关闭
  document.getElementById('dialog')!.addEventListener('pointerdown', () => { if (sc.hud.dialogOpen) sc.hud.closeDialog(); });
  return { sc, body, foot };
}
const buttons = () => [...document.querySelectorAll('#dialog-foot button')] as HTMLButtonElement[];
const byText = (t: string) => buttons().find((b) => b.textContent === t)!;
const down = (el: Element) => el.dispatchEvent(new Event('pointerdown', { bubbles: true }));

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('训练家切磋对话（手机）', () => {
  it('按钮的 pointerdown 不会冒泡成「点对话框 = 关闭」：手指按下去时对话框还在，随后的点击能发起切磋', () => {
    const { sc } = fakeScene();
    openTrainerAsk(sc as never, npc);
    expect(buttons().map((b) => b.textContent)).toEqual(['切磋', '下次吧']);
    down(byText('切磋'));
    expect(sc.hud.dialogOpen).toBe(true);           // 以前这里已经被关掉了，按钮随之消失
    byText('切磋').click();
    expect(sc.net.trainerBattle).toHaveBeenCalledWith('t1');
  });

  it('点「下次吧」：对话关闭，不发起切磋', () => {
    const { sc } = fakeScene();
    openTrainerAsk(sc as never, npc);
    down(byText('下次吧')); byText('下次吧').click();
    expect(sc.hud.dialogOpen).toBe(false); expect(sc.net.trainerBattle).not.toHaveBeenCalled();
  });

  it('服务器拒绝（比如冷却中）：原因显示在对话里，而不是什么都不发生', async () => {
    const { sc, body } = fakeScene();
    openTrainerAsk(sc as never, npc);
    byText('切磋').click();
    expect(body.textContent).toContain('正在发起切磋');
    sc.net.handlers.monResult?.(false, '刚打完一场，歇一会儿再来（还要等 12 秒）');
    expect(body.textContent).toContain('现在不能切磋'); expect(body.textContent).toContain('还要等 12 秒');
    await vi.advanceTimersByTimeAsync(6000); // 定时器收尾后不会再覆盖这条原因
    expect(body.textContent).toContain('还要等 12 秒');
  });

  it('开战成功（战斗界面打开了）：对话框收起', async () => {
    const { sc } = fakeScene();
    openTrainerAsk(sc as never, npc);
    byText('切磋').click();
    sc.battleUi.isOpen = true;
    await vi.advanceTimersByTimeAsync(300);
    expect(sc.hud.dialogOpen).toBe(false);
  });

  it('服务器没有任何回应：5 秒后提示稍后再试', async () => {
    const { sc, body } = fakeScene();
    openTrainerAsk(sc as never, npc);
    byText('切磋').click();
    await vi.advanceTimersByTimeAsync(5300);
    expect(body.textContent).toContain('没有收到服务器的回应');
  });

  it('不能切磋（没连上服务器 / 正在战斗中）：一打开就写明原因，不给「切磋」按钮', () => {
    const off = fakeScene({ online: false });
    openTrainerAsk(off.sc as never, npc);
    expect(off.body.textContent).toContain('连上服务器'); expect(buttons().length).toBe(0);
    const busy = fakeScene({ battle: true });
    openTrainerAsk(busy.sc as never, npc);
    expect(busy.body.textContent).toContain('正在战斗'); expect(buttons().length).toBe(0);
  });
});
