# 【仅供参考】自研家具摆放规则与 17 件家居家具

## 玩法

作者 11/6 已上线 decor.ts 摆放规则 + 39 件家具商店 + 墙纸地板 + 房间扩建，实现更完整；此模块仅作为另一套实现留档，不建议合入。

> ⚠️ **与上游已有实现撞车**：作者已有 `src/shared/decor.ts`、`src/systems/decoredit.ts`、39 件家具商店与 `DormSave.lay` 摆放存档，本模块的 `place.ts` / `furn.ts` / `PlaceBar.ts` 是同功能的另一套实现，合入会造成两套规则并存。

## 本模块源码（保持原路径，可直接复制）
- `files/src/shared/place.ts`
- `files/src/shared/furn.ts`
- `files/src/ui/PlaceBar.ts`
- `files/tools/art/furniture-home.ts`
- `files/tools/art/preview-furniture.ts`
- `files/tests/place.test.ts`
- `files/tests/furn.test.ts`
- `files/tests/furnserver.test.ts`

## 接入时还要改的共享文件（本贡献包不含，因作者 11/6 已大改）

## 补丁
`patches/08-placement-ref.patch` 相对作者 2026-11-05 基线（`c7bdecb`），用于阅读与移植；作者 11/6 之后改过不少共享文件，**不要直接 `git apply` 到最新 main**。
