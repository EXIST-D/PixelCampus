# 【部分撞车】手感与修复小包

## 玩法

大地图点选传送（15 秒冷却 + 落点校验）、贴着猫不再提示太远、合成台材料计数修复、拉鱼阶段 E 键可交互等修复。

> ⚠️ **与上游已有实现撞车**：商店一次买 10 份、背包上限 999、牵手三人链、宿舍浴缸、节日系统、钓鱼手册：作者 2026-11-06 已自行实现且更完整（见上游 CHANGELOG「背包 999 与批量操作」一节），本模块内涉及这几项的文件仅作对照，不要合入。

## 本模块源码（保持原路径，可直接复制）
- `files/src/ui/TeleportPanel.ts`
- `files/src/world/WorldMap.ts`
- `files/src/shared/party.ts`
- `files/src/shared/cats.ts`
- `files/src/ui/MonPanel.ts`
- `files/tests/maptp.test.ts`
- `files/tests/netchain.test.ts`
- `files/tests/progress.test.ts`
- `files/tests/storeprofile.test.ts`
- `files/tests/rename.test.ts`

## 接入时还要改的共享文件（本贡献包不含，因作者 11/6 已大改）
- `src/ui/ShopPanel.ts`
- `src/ui/BackpackPanel.ts`
- `src/shared/items.ts`
- `src/shared/protocol.ts`
- `server/game.ts`

## 补丁
`patches/07-qol.patch` 相对作者 2026-11-05 基线（`c7bdecb`），用于阅读与移植；作者 11/6 之后改过不少共享文件，**不要直接 `git apply` 到最新 main**。
