/** 公告栏：格式与清洗。客户端、服务器共用。公告可以多行（更新日志），玩家端一律用 textContent 渲染。 */
export interface Notice { id: number; title: string; body: string; ts: number }
export const NOTICE_TITLE_MAX = 40;
export const NOTICE_BODY_MAX = 1500;
export const NOTICE_KEEP = 30; // 最多保留多少条历史公告

/** 多行文本清洗：去控制/零宽字符（保留换行）、统一换行、行尾去空白、连续空行最多一行、按"字"截断 */
export function cleanMultiline(s: unknown, max: number): string {
  if (typeof s !== 'string') return '';
  const t = s.replace(/\r\n?/g, '\n').replace(/\t/g, '  ')
    .replace(/[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/gu, (c) => (c === '\n' ? c : ' '))
    .split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return Array.from(t).slice(0, max).join('');
}
export const cleanNoticeTitle = (s: unknown) => cleanMultiline(s, NOTICE_TITLE_MAX).replace(/\n+/g, ' ');
export const cleanNoticeBody = (s: unknown) => cleanMultiline(s, NOTICE_BODY_MAX);

/**
 * 把公告正文按链接切开：`[{text}, {text, url}, ...]`，渲染端据此拼出可点的链接。
 * 只认 http/https；中文括号、句末标点不算进链接里。渲染时必须用 createElement + .href 赋值，不要拼 HTML 字符串
 * （链接字符串来自管理员输入，拼 HTML 会被注入）。
 */
export function splitLinks(body: string): { text: string; url?: string }[] {
  const out: { text: string; url?: string }[] = [];
  const re = /https?:\/\/[^\s<>"'，。；：！？）】」]+/gi;
  let last = 0;
  for (const m of body.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: body.slice(last, i) });
    const raw = m[0], trail = /[.;:!?,]+$/.exec(raw)?.[0] ?? ''; // 只把英文句末标点留在正文里
    const url = trail ? raw.slice(0, -trail.length) : raw;
    out.push({ text: url, url });
    if (trail) out.push({ text: trail });
    last = i + raw.length;
  }
  if (last < body.length) out.push({ text: body.slice(last) });
  return out;
}
