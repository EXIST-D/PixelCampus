# 公告种子系统（按标题判重、新增置顶）

## 玩法

把公告写成代码里的种子列表，服务端启动时按标题判重播种；新增标题自动置顶，改标题即更新，不用手改线上数据文件。

## 本模块源码（保持原路径，可直接复制）
- `files/src/shared/announce.ts`
- `files/tests/notice.test.ts`
- `files/src/shared/notice.ts`
- `files/src/ui/NoticePanel.ts`

## 接入时还要改的共享文件（本贡献包不含，因作者 11/6 已大改）
- `server/notices.ts`

## 补丁
`patches/06-announce.patch` 相对作者 2026-11-05 基线（`c7bdecb`），用于阅读与移植；作者 11/6 之后改过不少共享文件，**不要直接 `git apply` 到最新 main**。
