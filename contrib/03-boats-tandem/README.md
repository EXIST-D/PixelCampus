# 精工湖小船 ×7 + 船上钓鱼 + 双人自行车

## 玩法

湖上 7 条小木船，可上船、划动、船上抛竿；少了自动补、离船自动归位。校园里多一辆能带人的双人自行车。

## 本模块源码（保持原路径，可直接复制）
- `files/src/shared/boat.ts`
- `files/tools/art/boats.ts`
- `files/tools/art/bikes.ts`
- `files/tests/boat.test.ts`
- `files/tests/tandem.test.ts`
- `files/src/shared/bikes.ts`
- `files/src/entities/RemotePlayer.ts`

## 接入时还要改的共享文件（本贡献包不含，因作者 11/6 已大改）
- `src/scenes/WorldScene.ts`
- `src/shared/protocol.ts`
- `server/game.ts`

## 补丁
`patches/03-boats-tandem.patch` 相对作者 2026-11-05 基线（`c7bdecb`），用于阅读与移植；作者 11/6 之后改过不少共享文件，**不要直接 `git apply` 到最新 main**。
