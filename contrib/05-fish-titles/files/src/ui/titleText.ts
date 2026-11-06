/**
 * 称号文字的统一样式工具。
 *
 * 为什么不是直接给容器加 class：学生证的「card-ttl」、称号面板的「ttl-tag」、名人堂的「hall-title」
 * 自己都带底色（深色小牌子）。彩虹用的是 `background-clip: text`，如果加在容器上，
 * 被裁成字的会是**容器自己的底色**，牌子就消失了。所以彩虹必须落在一层内层 span 上。
 */
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

/** 造一个称号文字节点：彩虹 = 内层 span 走渐变；普通 = 直接用它的颜色 */
export function titleText(text: string, opt: { rainbow?: boolean; color?: string; cls?: string } = {}): HTMLSpanElement {
  const span = el('span', [opt.cls ?? '', opt.rainbow ? 'ttl-rainbow' : ''].filter(Boolean).join(' '), text);
  if (!opt.rainbow && opt.color) span.style.color = opt.color;
  return span;
}
