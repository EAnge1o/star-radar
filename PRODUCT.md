# Product

<!-- impeccable:product-schema 1 -->

> 标注说明:本文件写于视觉世界重设计前,访谈探针未获应答,以下事实来自
> 项目仓库证据与用户在会话中的明确表述;标注「(推断)」的条目为推断值。

## Platform

web

## Users

- 主要用户:仓库所有者本人(推断)——每天数次快速扫榜,1-3 分钟内决定"要不要关注/试用某个项目"(推断);技术选型与研究时也会停留较久,反复筛选、对比、看赛道(推断)。
- 次要受众:GitHub 上经仓库链接到来的开发者访客(推断)——第一眼判断这个工具是否有品、可信。

## Product Purpose

StarRadar 是自托管的 GitHub trending 观测工具:按「真实增速」而非总量排行,
让用户比总量榜更早发现正在起量的项目,并盯住自己关注的项目。
成功 = 用户每天打开它替代 GitHub trending 页,并信任它的增速与共振信号。

## Positioning

邻居产品(GitHub trending 页、各种镜像站)无法照抄的机制:
- 用 stargazers `starred_at` 采样与每日快照差值**实测**增速,而非展示总量;
- GitHub × Hacker News **双平台共振**信号分辨真热与刷榜;
- 每项目一句话中文点评 + 赛道语义聚类,把英文 README 讲成人话;
- Watchlist 里程碑/暴增推送到飞书/TG,关键词订阅成为个人榜单。

## Operating Context

- 自托管于本机(FastAPI + SQLite),浏览器访问 http://127.0.0.1:8000;
- 数据源:GitHub REST API(可选 token)、HN Algolia(免费)、智谱 LLM(可选);
- 观测节奏:启动自检 + 每 30 分钟巡检、超 6 小时自动全量观测;
- 典型状态:早晨或工作间隙打开,滚动榜单 → 点开详情 → 回到榜单,全程键盘可操作(j/k/Enter//)。

## Capabilities and Constraints

- 已确认能力:增速/新秀/总量/降温四榜、关键词订阅、Watchlist 推送、赛道详情与热度曲线、
  每日/每周报告、HN 共振、中文点评、明暗双主题、PWA、URL 状态同步;
- 技术约束:无 token 时增速为估算(UI 标 ≈);GitHub API 限流下抓取器需自我保护;
  TLS 中间人拦截环境需降级兜底(已实现);
- 未决事实:推送通道(飞书/TG)用户尚未配置;GITHUB_TOKEN 与智谱 API key 均未配置;
- 术语:中文为主,英文专有名词(Star、Fork、Agent、MCP 等)保留原文。

## Brand Commitments

- 名称 **StarRadar**(确认),中文副标「GitHub 趋势雷达」;
- 定位话术:自托管 GitHub trending 观测工具,不使用「开源趋势雷达」一类表述(用户明确要求);
- MIT License,仓库 github.com/EAnge1o/star-radar;
- 视觉现状:深色玻璃卡「深空观测站」风, JetBrains Mono 承载数据;此为 incumbent 证据,
  不是新世界的约束(重设计时按 new-work 处理)。

## Evidence on Hand

- 真实运行数据:SQLite 内 1000+ 真实项目、13 条赛道、HN 共振样本、6 天快照历史(data/star-radar.db);
- 仓库截图三张(screenshots/);README 完整;无用户证言、无基准测试数据 —— 不得虚构。

## Product Principles

1. **测量而非罗列**:每一个数字都可追溯到一次真实测量或明确标注的估算;
2. **扫一眼就有判断**:榜单的排序、徽章、点评要在几秒内回答「值得看吗」;
3. **诚实标注**:估算、推测、降级状态在界面上永远可见,不伪装成精确值;
4. **密度即效率**:数据面板不靠大留白展示,一屏的信息量优先于装饰性呼吸感;
5. **自托管优先**:所有功能在无外部凭证时优雅降级,不空转。
