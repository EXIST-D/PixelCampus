# 校园彩票 + 赚钱/亏钱双榜

## 玩法

商店 300 币一张、连续 5 张白板后保底 200、面板直接买票；名人堂按「中奖−买票成本」分赚钱榜/亏钱榜，0 收益两边都不上。

## 本模块源码（保持原路径，可直接复制）
- `files/src/shared/lottery.ts`
- `files/src/ui/LotteryUi.ts`
- `files/tests/lottery.test.ts`
- `files/tests/lotbook.test.ts`

## 接入时还要改的共享文件（本贡献包不含，因作者 11/6 已大改）
- `src/shared/hall.ts`
- `src/ui/HallPanel.ts`
- `src/ui/ShopPanel.ts`
- `docs/ECONOMY.md`
- `src/shared/protocol.ts`
- `server/game.ts`

## 补丁
`patches/01-lottery.patch` 相对作者 2026-11-05 基线（`c7bdecb`），用于阅读与移植；作者 11/6 之后改过不少共享文件，**不要直接 `git apply` 到最新 main**。
