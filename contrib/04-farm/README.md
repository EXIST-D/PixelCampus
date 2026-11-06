# 实验田：四个社区各一个入口 + 温室 12 格

## 玩法

四个社区门口各一块栅栏菜地，按 E 进私人温室；白菜/土豆/南瓜 3 种作物、4 阶段生长，进度按浇水次数推进，不跨日结算、永不枯死；支持一键浇水，收获直接给币。

## 本模块源码（保持原路径，可直接复制）
- `files/src/shared/farm.ts`
- `files/src/ui/FarmBar.ts`
- `files/tools/art/crops.ts`
- `files/tools/art/furniture-farm.ts`
- `files/data/interiors/farm.json`
- `files/data/campus/manual.json`
- `files/data/campus/terrain/61-dorm-landscape.json`
- `files/src/shared/manual.ts`
- `files/tests/farm.test.ts`
- `files/tests/farmserver.test.ts`

## 接入时还要改的共享文件（本贡献包不含，因作者 11/6 已大改）
- `src/scenes/WorldScene.ts`
- `src/scenes/InteriorScene.ts`
- `src/scenes/BootScene.ts`
- `src/shared/protocol.ts`
- `src/net/client.ts`
- `server/game.ts`
- `server/store.ts`
- `tools/art/index.ts`
- `tools/world/interiors.ts`

## 补丁
`patches/04-farm.patch` 相对作者 2026-11-05 基线（`c7bdecb`），用于阅读与移植；作者 11/6 之后改过不少共享文件，**不要直接 `git apply` 到最新 main**。
