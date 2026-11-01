# DESIGN.md — StarRadar「活字排字房」The Composing Room

<!-- impeccable:design-schema 1 -->

视觉世界的持久决定。由 2026-11-02 重设计(codeseed e64abb6b31d6f818,operate 模式,code-led)产生。

## World thesis

榜单是一块每天被重新拣字的排字石:数据即铅字,观测即重新排字。
拒绝品类默认的"玻璃卡 + 光晕仪表盘"。世界只贡献字体、色板、密度与一个签名动作,
布局与控件始终是标准 web 组件。

## Palette(色彩策略:Restrained + 语义色)

| Token | 暗主题(排字石) | 明主题(印出的纸) | 用途 |
|---|---|---|---|
| `--bg0/1` | `#15171b` / `#191c21` | `#ece6d9` / `#e5ded0` | 石板地 / 纸地 |
| `--panel` | `#1c1f25` | `#f4f0e7` | 一级抬升面板 |
| `--ink` | `#e8e2d5` 骨白 | `#211d16` 铅墨 | 正文与铅字 |
| `--sub` / `--faint` | `#b3aa99` / `#8a8274` | `#4d463a` / `#6b6254` | 次/弱层级(均 ≥4.5:1) |
| `--accent` 铜模金 | `#b98a44` | `#7a5a28` | 选中、热力、图表墨色、链接 |
| `--zhusha` 朱砂 | `#c9413c` | `#b23a35` | **仅**报眼、黑马标记、今日新增大数 |
| `--green` / `--down` | `#7fa86b` / `#b0614e` | `#557a43` / `#a05541` | 涨 / 跌 |

朱砂纪律:除报眼、黑马、黑马 KPI 外不得出现;关注/通知/选中一律铜金。

## Type

- 显示层:`Noto Serif SC → Source Han Serif SC → SimSun` 栈(报头、分区标题、汉字序号、点评引文、报告导语)。
- 数据层:`JetBrains Mono Variable`,一律 `font-variant-numeric: tabular-nums`。
- 控件层:系统 sans(`--font-ui`)。三种声音不得互换:标题不用 mono,数据不用衬线。

## Signature components

- **字模 chip**:墨底 `--block` + 1px 骨白框的小方框,数字的基本容器。
  **框即状态**:实线框 = 实测,虚线框 = 估算(UI 同时保留 ≈ 前缀),删除线 = 已撤(降温)。
- **报眼(lead-box)**:右上角朱砂角签 + 当日新增 STAR 大数;一天只有一个。
- **汉字序号**:榜单排名用 壹/贰/…/拾壹(currency > 99 回落阿拉伯数字),前三名分别铜金/骨白/赭。
- **hairline seam**:面板间用 1px 线分隔或 1px 缝隙网格,外阴影零使用。
- **撤**:降温项目保留在榜,删除线 + 「撤」记号——不下架,只销户。

## Charts

统一墨色:描边 `currentColor`(容器 color = `var(--accent)`),填充 `var(--accent-soft)`,
无渐变。同一榜单内所有 sparkline 共享一个 y 域(跨行可比);详情/赛道大图 y 轴自适应数据区间。

## Motion

一个签名时刻:主榜单观测后的逐行"重新排字"入场(错峰 30ms,上限 0.5s)。
其余一切静态;CountUp 已废除。`prefers-reduced-motion` 下全部动画归零。

## Surfaces & themes

暗主题=排字石,明主题=印出的纸(同一套 token 的纸面投影)。切换经 `data-theme` 持久化。
圆角纪律:字模与控件 2px;面板方形;不用胶囊。

## Bans in force

渐变文字、眉题(eyebrow)、零偏移彩色光晕、彩色 border-left、幽灵卡(边框+大软阴影)、
图表渐变填充、mono 用于非数据文本。
