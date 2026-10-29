# StarRadar · 开源趋势雷达

> 每天自动观测 GitHub:按「真实增速」而非总量排行,新秀、黑马、赛道聚类、中文点评,一页看懂开源世界正在发生什么。

![tech](https://img.shields.io/badge/FastAPI-SQLite-0aa?logo=fastapi) ![tech](https://img.shields.io/badge/React-Recharts-7bd?logo=react) ![tech](https://img.shields.io/badge/LLM-GLM--4.6-8b5cf6)

## 它能告诉你什么

- **增速榜**:按近 24 小时 / 7 天 / 28 天的新增 Star 排序 —— 比总量榜更早发现趋势。
- **新秀榜**:创建 ≤ 30 天就起量的项目,早期项目的第一现场。
- **黑马标记** 🔥:日增速 > 3× 同语言中位基线的爆发者(最多标 8 个,防止通胀)。
- **实时赛道**:新锐项目自动聚合成「Agent 框架」「语音与音频」等赛道,热度 = 赛道内近 7 日 Star 占比。
- **AI 中文点评** ✦:每个项目一句话「这是什么 + 为什么火」(需配置 LLM API Key,见下文)。
- **每日快照**:每次观测自动存档,star 曲线随时间自动生长;回看历史热榜有数据可依。

## 30 秒启动

```bash
# Windows
start.bat

# macOS / Linux
./start.sh
```

打开 **http://127.0.0.1:8000** 即可(已内置 817 个真实项目的种子数据库,开箱即有内容)。

手动构建前端(仅改了前端代码时需要):

```bash
cd frontend && npm install && npm run build
```

## 数据从哪来

| 环节 | 无凭证(默认) | 配置凭证后 |
|---|---|---|
| 项目发现 | GitHub Search API(9 组动态日期查询,ETag 缓存省配额) | 同左,可加大页数 |
| 增速测量 | 总量 ÷ 仓库年龄 估算,UI 标注 `≈`;每日快照差值自动校准 | stargazers `starred_at` 末页采样,**精确测量**近 100 次 Star 时间,并生成星标节奏曲线 |
| 中文点评/赛道 | 无(点评区显示待生成) | GLM 批量生成 + embedding 语义聚类 |

配 token 的方式(二选一,重启生效):

```bash
# 环境变量
export GITHUB_TOKEN=ghp_xxx        # GitHub,精确增速采样
export ZHIPU_API_KEY=xxx           # 智谱开放平台,中文点评 + 语义赛道
```

或者:网页右上角 **设置面板** 粘贴智谱 API Key(仅存内存,即时生效,可一键为缺失项目生成点评)。

## API

```
GET  /api/board?board=velocity|fresh|total&window=1d|7d|28d&lang=&q=&ai_only=&track_id=
GET  /api/tracks              赛道列表(含热度、代表项目)
GET  /api/repos/{full_name}   项目详情(含每日快照)
GET  /api/stats               仪表盘统计
POST /api/refresh             立即观测一轮
POST /api/llm/enable          注入 LLM key(运行时)
POST /api/llm/comment         为缺失项目生成点评
POST /api/llm/tracks          重做语义赛道聚类
```

## 定时观测

服务启动时自动检查数据新鲜度,超过 6 小时立即观测一轮,之后每 30 分钟巡检、按间隔自动抓取。全流程无需人工参与。

## 目录结构

```
star-radar/
├── start.bat / start.sh        一键启动
├── data/star-radar.db          SQLite(种子数据随包附带)
├── backend/
│   ├── app/
│   │   ├── config.py           全部环境变量配置
│   │   ├── github.py           GitHub 客户端(ETag 缓存 / 限流感知 / star 采样)
│   │   ├── fetcher.py          抓取编排:搜索→增速→快照→黑马→点评→赛道
│   │   ├── ai.py               GLM 点评 / embedding / 赛道命名
│   │   ├── tracks.py           语义聚类 + 主题词典退化路径
│   │   └── main.py             FastAPI + 调度 + 静态托管
│   └── scripts/
│       ├── fetch_once.py       CLI 手动抓取
│       ├── apply_seed_polish.py  写入种子点评、重算黑马
│       └── seed_commentary.json  构建期点评数据(可自行增删)
└── frontend/                   React + Recharts(构建产物已就位 backend 直接托管)
```

## 设计取舍备忘

- **诚实标注**:所有估算值在 UI 上都有 `≈` 前缀,评论区的增量口径在页脚有说明;不把估算伪装成测量。
- **黑马防通胀**:相对倍率 + 绝对增量双重门槛,且全局最多 8 个。
- **赛道退化路径**:无 LLM 时用主题词典聚类,保证功能永不空白。
- **配额友好**:ETag 条件请求(304 不计费)、搜索结果去重合并、采样预算上限(默认 160 项目)。

## 已知边界

- 未认证 GitHub API 限流(核心 60 次/时、搜索 10 次/分),抓取器遇到限流会自动等待重试;想要完整体验请配置 token。
- star 曲线需要时间生长:首次部署只有估算增速,快照逐日积累后曲线与精度自动提升(token 用户立得精确曲线)。
