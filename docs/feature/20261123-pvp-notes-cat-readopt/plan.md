# 对战提示 + 猫咪一键接回宿舍 计划

| 项 | 内容 |
|---|---|
| 状态 | 已完成（2026-11-23，本地已做、未部署） |
| 对应 spec | [spec.md](spec.md) |

## 任务（每个任务单独提交）
1. **对战提示（服务端 + 协议）**：新增 S→C `pvp_note { ok, msg, end? }`（`end` = 这条邀请已经有结果）；`server/pvp.ts` 在邀请 / 拒绝 / 超时（`setTimeout`）/ 开战失败时发；邀请带「对方正被别人邀请」检查；接受时重新检查 `mons.inBattle`、同世界，并清掉双方未答的野生遭遇；`start()` 的队伍提示分别发给对的人；野外遭遇 / 猫战 / 训练家战 / 接受野生遭遇在 PvP / BOSS 中被拒。
2. **对战提示（客户端）**：`PvpUi` 处理 `pvpNote`（等待条 + 横幅）；邀请弹窗换位置；`onPvp` 先检查联网。
3. **一键接回（共享规则 + 服务端）**：`DormSave.dr`（最近送回的猫，≤3）；`dormCatApply` 送回时写入、接回时移除；`cleanDorm` 清洗；`dorm_data` 带 `dr`。
4. **一键接回（界面）**：`DormPanel` 新增「刚送回校园的猫」；`dorm_cat` 结果提示补一句。
5. **文档**：`protocol:doc`、FEATURES、CHANGELOG、README 索引；私有记录部署后补。

## 协议 / 数据
- 新增消息 `pvp_note`；`dorm_data` 新增可选 `dr: number[]`；`DormSave.dr`。全是新增，**不升 `PROTOCOL_VERSION`**（旧客户端忽略新消息 / 字段；对战结果仍同时发 `mon_result`）。
- 改了 `src/shared/*`，服务端要一起部署。

## 测试
- 服务端：`server/tests/pvp.test.ts`（提示、超时、接受时状态检查、遭遇互斥）、`server/tests/dorm-cats.test.ts`（`dr` 增删、重连保留）。
- 共享：`dormCatApply` / `cleanDorm`。
- 客户端：`PvpUi` 提示、`DormPanel` 列表（happy-dom）。
