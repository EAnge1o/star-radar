# DESIGN.md — StarRadar「午夜线网」Midnight Transit Diagram

<!-- impeccable:design-schema 1 -->

视觉世界的持久决定。由 2026-11-02 用户钉选的挑战者方向
(wayfinding-cartography-signage-midnight-transit-diagram)替换「活字排字房」而来;
codeseed e64abb6b31d6f818,operate 模式,code-led。

## World thesis

赛道即线路:GitHub 的赛道全景是一张午夜珐琅线网图,用户像查地铁一样查趋势。
世界只贡献字体、色板、密度与一个签名动作;布局、导航、控件始终是标准 web 组件。

## Palette(色彩策略:Committed——午夜蓝就是表面)

| Token | 暗主题(午夜珐琅) | 明主题(白天口袋地图) | 用途 |
|---|---|---|---|
| `--bg0/1` | `#0f1930` / `#132042` | `#edf1f8` / `#e3e9f4` | 珐琅蓝地 |
| `--panel` | `#16264a` | `#f7f9fd` | 一级抬升面板 |
| `--ink` | `#f2f0e6` 瓷白 | `#16213c` 深蓝墨 | 站名与正文 |
| `--sub` / `--faint` | `#b8c4dd` / `#8b9bc0` | `#3d4a66` / `#566180` | 次/弱层级(≥4.5:1) |
| `--accent` 信号琥珀 | `#f0a832` | `#96600f` | 选中、热力、图表墨色 |
| `--zhusha` 猩红 | `#d13a3f` | `#b23a35` | **仅**今日首发角签、黑马、黑马 KPI |
| `--green` / `--down` | `#4fc47a` / `#e35d5d` | `#2e8f52` / `#c03f3f` | 涨 / 跌 |
| 线路色环 |猩红/钴蓝/琥珀/绿/紫/青/橙/洋红… 13 色 | 同左(明度适配) | 每条赛道一色,按 track id 稳定取色 |

猩红纪律:除今日首发、黑马、黑马 KPI 外不得出现。图表墨色一律 `var(--accent)`。

## Type

- 显示与 UI:`Overpass Variable`(公路/地铁导视血统的 signage sans),中文回落
  PingFang/雅黑;标签小号、正字距。
- 数据:`JetBrains Mono Variable`,一律 `tabular-nums`。
- 站名/编号是 mono;报头与标题是 Overpass;不得混用。

## Signature components

- **线段卡(track-line chip)**:首页赛道卡的 45° 折线小样,线路色即赛道色;
  非选中的卡整体降为 80% 不透明——选中线路最亮。
- **线路图(LineDiagram)**:赛道详情页把该赛道画成一条折线(折角恒 45°),
  站点 = 头部项目(圆圈大小按 Star),HN 共振成员画双环 = 换乘;
  远处两条暗线衬托本线最亮。
- **字模框状态**:增速数字的框——实线 = 实测,虚线 = 估算(配 ≈ 前缀),删除线 = 停运(撤)。
- **今日首发卡**:替代报眼;猩红角签 + 当日新增 STAR 大数。
- **hairline seam**:面板间 1px 线分隔,外阴影零使用;站点网格点阵作地纹。

## Charts

描边 `currentColor`(容器 color = `var(--accent)`),填充 `var(--accent-soft)`,无渐变;
同一榜单内所有 sparkline 共享 y 域;详情/赛道大图 y 轴自适应数据区间;轴刻度走 token。

## Motion

一个签名时刻:线段卡与榜单的错峰入场(30ms 步进,上限 0.5s);线路图静态呈现。
`prefers-reduced-motion` 下全部动画归零。

## Surfaces & themes

暗主题 = 午夜珐琅墙面,明主题 = 白天的口袋地图。切换经 `data-theme` 持久化。
圆角纪律:控件 2px,面板方形,不用胶囊。

## Bans in force

渐变文字、眉题(eyebrow)、零偏移彩色光晕、彩色 border-left、幽灵卡、
图表渐变填充、mono 用于非数据文本、把线网图当布局用(它只是签名动作)。
