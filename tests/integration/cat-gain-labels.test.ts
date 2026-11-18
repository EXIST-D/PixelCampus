// @vitest-environment happy-dom
/** 猫咪互动按钮第二行写明这次能涨多少好感（数值取自共享规则 cats.ts / fishing.ts，不手抄）。 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CatPanel, type CatActions } from '@/ui/CatPanel';
import { FEED_GAIN, HUG_FIRST_GAIN, HUG_GAIN, HUG_LEVEL, LEVEL_AT, PET_GAIN, type CatDef } from '@/shared/cats';
import { FISH_FEED_GAIN } from '@/shared/fishing';

const noop = () => {};
const acts = { pet: noop, hug: noop, feed: noop, follow: noop, nick: noop, close: noop, tame: noop, duel: noop } as unknown as CatActions;
beforeEach(() => { document.body.replaceChildren(); const hud = document.createElement('div'); hud.id = 'hud'; document.body.append(hud); });
const buttonOf = (head: string) => ([...document.querySelectorAll('.cat-grid .btn')] as HTMLButtonElement[]).find((b) => (b.textContent ?? '').startsWith(head));

describe('猫面板：互动按钮上的好感涨幅', () => {
  it('摸一摸 / 猫粮 / 猫条 / 喂鱼 / 抱抱 的第二行都写着好感 +N（挚友以上才有抱抱的数值）', () => {
    const cat: CatDef = { id: 1, name: '蒲公英', coat: 0, hx: 0, hy: 0 };
    const panel = new CatPanel(acts); panel.open(cat);
    panel.update(LEVEL_AT[HUG_LEVEL], 2, 2, 2, true);
    expect(buttonOf('摸一摸')?.textContent).toContain(`好感 +${PET_GAIN}`);
    expect(buttonOf('喂猫粮')?.textContent).toMatch(new RegExp(`好感 \\+${FEED_GAIN.cat_food}`));
    expect(buttonOf('喂猫条')?.textContent).toMatch(new RegExp(`好感 \\+${FEED_GAIN.cat_treat}`));
    const fish = Object.values(FISH_FEED_GAIN);
    expect(buttonOf('喂鱼')?.textContent).toContain(`好感 +${Math.min(...fish)}~${Math.max(...fish)}`);
    expect(buttonOf('抱抱')?.textContent).toContain(`好感 +${HUG_GAIN}`); expect(buttonOf('抱抱')?.textContent).toContain(`+${HUG_FIRST_GAIN}`);
    // 页面上还有一行总说明（每日首次互动的额外好感）
    expect(document.querySelector('.cat-gain-tip')?.textContent).toContain('每天第一次');
  });
});
