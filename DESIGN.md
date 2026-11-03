# DESIGN.md — StarRadar Premium AI SaaS

<!-- impeccable:design-schema 1 -->

视觉世界的持久决定。2026-11-03 由用户提供的完整设计简报钉选(Premium AI SaaS Product
Design System),替换「午夜线网」;operate 模式,code-led。

## World thesis

一款成熟 AI SaaS 产品的观测控制台:左侧导航 + 顶栏 + 白色卡片的经典企业布局,
信息密度服务效率,Agent 的运行状态与产出是一等公民。拒绝模板后台的廉价感,
也拒绝装饰性隐喻——比喻词只保留在数据可视化里(赛道图谱)。

## Palette(色彩策略:Restrained)

| Token | 明主题(默认) | 暗主题(次选) | 用途 |
|---|---|---|---|
| `--bg` | `#f7f8fa` | `#0f1115` | 页面地 |
| `--surface` | `#ffffff` | `#16181d` | 卡片 |
| `--border` | `#e5e7eb` | `#262a33` | 细边框 |
| `--ink` | `#111827` | `#f3f4f6` | 主文字 |
| `--sub` / `--faint` | `#6b7280` / `#9ca3af` | `#9ca3af` / `#6b7280` | 次级文字 |
| `--primary` | `#3e63dd` | `#7a96f2` | 低饱和蓝主色:选中、主按钮、图表 |
| `--green` / `--orange` / `--red` | `#16a34a` / `#d97706` / `#dc2626` | 暗色适配 | 状态语义(涨/黑马/失败) |

阴影:`0 1px 2px rgba(16,24,40,.05)` 常态,hover `0 4px 14px`。深色背景默认不出现
(用户可切暗主题,系统为同一 token 的暗色投影)。

## Type

- UI 与显示:`Public Sans Variable`(企业级 grotesque)+ PingFang/雅黑栈。
- 数据:`JetBrains Mono Variable`,一律 `tabular-nums`。
- 层级:页面标题 20px/700 → 卡片题 14.5px/700 → 正文 14 → 辅助 12.5 → 标签 11 大写。

## Layout(结构即世界观)

- 左侧 232px 固定侧边栏:产品标 + 分组导航(观测/我的/系统)+ 设置与主题;≤980px 变抽屉。
- 顶栏 56px:页面标题 + Agent 运行状态 pill + 最近观测时间 + 立即观测。
- 内容区 max-width 1240,24px 内边距。KPI 四格 → Agent 卡 → 赛道线网 → 通知 + 快捷入口。

## AI-Native surfaces(Agent 是一等公民)

- **状态 pill**:运行中(蓝,脉冲)/ 空闲 / 成功(绿)/ 失败(红),出现在顶栏、Agent 卡、运行表。
- **Agent 卡**:最近一轮结果(扫描数、新收录数)、自动观测节奏、立即观测主按钮。
- **Agent 动态页**:`/api/runs` 真实运行记录表(状态/耗时/扫描/新增/产出)+ `/api/notifications` 分发流。
- 数据全部来自真实管线(fetch_runs / notifications 表),无任何装饰性假状态。

## Components

白卡 + 1px 边框 + 8px 圆角;控件 6px;状态徽章 999px 胶囊。
语义徽章:黑马 = 橙、共振 = 蓝、新 = 蓝软底、降温/营销嫌疑 = 灰虚线。
增速数字:绿色 tabular,估算加 ≈(虚线框纪律已简化为前缀 + tooltip)。
删除/取消关注一律走确认弹窗;榜单支持排序(综合/Star/名称)与加载更多。

## Bans in force

大面积渐变、霓虹色、紫色 AI 风、默认深色页面、玻璃拟态、无意义装饰图标、
独立边框滥用、渐变文字、眉题、零偏移光晕。
