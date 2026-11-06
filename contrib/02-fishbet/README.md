# 赌鱼铺「鱼力全开」+ 名人堂赌鱼榜

## 玩法

押背包里一条鱼，抽 3 条相邻档陪跑，4 泳道赛跑，头名按今日收购价×赔率结算；赔率用 30 万局模拟倒推，期望≈0.87；6 秒冷却、≥800 上公屏、站位校验。战绩落盘，名人堂按累计赢币排名。

## 本模块源码（保持原路径，可直接复制）
- `files/src/shared/fishbet.ts`
- `files/src/ui/FishBetUi.ts`
- `files/tests/fishbet.test.ts`
- `files/tests/fishbetserver.test.ts`
- `files/tools/art/props.ts`
- `files/data/campus/terrain/10-lake.json`

## 接入时还要改的共享文件（本贡献包不含，因作者 11/6 已大改）
- `src/shared/hall.ts`
- `src/ui/HallPanel.ts`
- `src/net/client.ts`
- `src/shared/protocol.ts`
- `server/store.ts`
- `server/game.ts`

## 补丁
`patches/02-fishbet.patch` 相对作者 2026-11-05 基线（`c7bdecb`），用于阅读与移植；作者 11/6 之后改过不少共享文件，**不要直接 `git apply` 到最新 main**。
