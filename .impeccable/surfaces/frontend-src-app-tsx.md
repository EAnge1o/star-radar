---
version: 1
slug: "frontend-src-app-tsx"
primary_target: "frontend/src/App.tsx"
related_targets: []
---

# Surface brief — 主榜单界面(frontend/src/App.tsx)

## Scope & mode
整站工作面(榜单/赛道/Watchlist/报告),Operate 模式,web。

## Audience / job / constraints
见 PRODUCT.md;硬约束:高信息密度、中文为主、等宽数据字体、键盘可达、诚实标注估算。

## Direction contract
THESIS: 榜单是一块每天被重新拣字的排字石——数据即铅字,观测即重新排字;拒绝品类默认的"玻璃卡+光晕仪表盘"。
OWN-WORLD: 冷排字石灰板底;骨白铅字色;朱砂仅给报眼/黑马;铜金给选中与热力;hairline 分隔取代阴影;字模 chip(墨底骨字小方框)是组件基本单位;宋体标题×等宽数据。
STORY: 打开三秒内读出"今天铅字盘上换了谁",每个数字读得出涨跌,每个字模读得出实测还是估算。
FIRST VIEWPORT: 窄 masthead 条(宋体报名+日期+重新排字时间+键盘提示)→ 报眼一格(今日最热,朱砂记号)→ 紧凑 KPI 字模条 → 主榜排字石(汉字序号 壹贰叁…,行=字模组)。无大 hero、无雷达动画(旧世界退役)。
FORM: assigned #5 of my grounded list; seed:e64abb6b31d6f818.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Raises(裁决后注入)
- from C1 emission-line-rail:状态用线的形态表达——估算=虚线框,实测=实线框,停滞=半高/删除记号(状态不靠色相)。
- from C3 dark console:面板用 hairline seam 分隔与一级抬升,不用阴影堆叠。
- from C6 transit diagram:正交纪律(45°/90° 折角、固定尺寸标签),选中线路最亮;榜单区仍是标准表格。
- from C2 ticket wallet:项目不下架,只销户——降温/过气用删除线与「撤」记号。
- from C5 botanical folio:同一表面所有图线共用固定比例尺与同一地面,保证可比。

## Verdicts
C1 competitive(受众认同强);C6 competitive(同上);C2/C3/C4 declined,贡献如上 raise。

## Unresolved
推送通道与 API key 仍未配置(不阻塞视觉);新世界的 DESIGN.md 在 finish 时由 documenter 生成。
