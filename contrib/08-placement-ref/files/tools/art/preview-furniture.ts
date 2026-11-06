/**
 * 家具预览图：把家具按 2 倍放大排成一张图，方便肉眼检查像素（不参与游戏构建）。
 *   npx tsx tools/art/preview-furniture.ts [输出路径]
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Img, type RGBA } from './px.ts';
import { HOME_FURNITURE } from './furniture-home.ts';
import { DORM_FURNITURE } from './furniture-dorm.ts';
import { FURNITURE } from './furniture.ts';
import { OFFICE_FURNITURE } from './furniture-office.ts';
import { ROOT } from '../paths.ts';

const SCALE = 3, GAP = 10, MAXW = 720, PAD = 10;
const bg: RGBA = [238, 232, 218, 255];

const sets: [string, Record<string, () => { img: Img }>][] = [
  ['home', HOME_FURNITURE], ['dorm', DORM_FURNITURE], ['furniture', FURNITURE], ['office', OFFICE_FURNITURE],
];

const items = sets.flatMap(([, m]) => Object.entries(m).map(([k, mk]) => ({ k, img: mk().img })));
// 逐行摆：宽 720，放不下就换行
let x = PAD, y = PAD, rowH = 0, totalH = PAD;
const pos: { x: number; y: number; img: Img }[] = [];
for (const it of items) {
  const w = it.img.w * SCALE, h = it.img.h * SCALE;
  if (x + w + PAD > MAXW) { x = PAD; y += rowH + GAP; rowH = 0; }
  pos.push({ x, y, img: it.img });
  x += w + GAP; rowH = Math.max(rowH, h);
}
totalH = y + rowH + PAD;

const out = new Img(MAXW, totalH);
out.rect(0, 0, MAXW, totalH, bg);
for (const p of pos) {
  for (let yy = 0; yy < p.img.h; yy++) for (let xx = 0; xx < p.img.w; xx++) {
    const c = p.img.get(xx, yy); if (!c[3]) continue;
    for (let sy = 0; sy < SCALE; sy++) for (let sx = 0; sx < SCALE; sx++) out.set(p.x + xx * SCALE + sx, p.y + yy * SCALE + sy, c);
  }
}
const dst = process.argv[2] ? process.argv[2] : join(ROOT, 'ref', 'furniture-preview.png');
await out.save(dst);
writeFileSync(join(ROOT, 'ref', 'furniture-preview.txt'), pos.map((p) => p.img.w).join(','));
console.log('已生成', dst, `${MAXW}x${totalH}`, '件数', pos.length);
