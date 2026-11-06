# 钓鱼六级称号 + 顶级彩虹字

## 玩法

按图鉴鱼种数 1/5/10/18/24/27 解锁六级称号，一级一色（青绿→青→蓝→紫→橙→彩虹）；顶级「钓鱼大师」头顶流动彩虹 + 面板渐变；钓到新鱼即时补发，登录静默补发。

## 本模块源码（保持原路径，可直接复制）
- `files/src/ui/titleText.ts`
- `files/tests/titles.test.ts`
- `files/src/shared/titles.ts`
- `files/src/ui/TitlePanel.ts`
- `files/src/ui/StudentCard.ts`

## 接入时还要改的共享文件（本贡献包不含，因作者 11/6 已大改）
- `server/progress.ts`
- `src/net/client.ts`

## 补丁
`patches/05-fish-titles.patch` 相对作者 2026-11-05 基线（`c7bdecb`），用于阅读与移植；作者 11/6 之后改过不少共享文件，**不要直接 `git apply` 到最新 main**。
