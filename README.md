# mixmood

An AI-powered cocktail recommender built with MoonBit.

**Your mood. Your cocktail.**

MixMood 是面向 2026 MoonBit 黑客松的开源 AI 调酒助手。目标是让用户从心情或已有材料出发，在经过核实的真实配方中发现可以制作的一杯。

当前进度：**Milestone 3，AI 自然语言口味理解**。已实现轻量 Node.js AI 接口、结构化偏好校验和 MoonBit 难度排序，并保留六种心情、18 款真实配方与本地酒柜。未配置 AI 时明确提示，不生成假 AI 结果；账号、云数据库、收藏和社交尚未实现。

> 正式页面使用 18 款有来源的真实配方；原有 3 条 M1 示例仅用于回归测试。匹配只检查是否拥有必需材料，不判断数量、工具或冷却条件，装饰不参与匹配。未录入酒柜时只展示灵感，绝不声称材料齐全。配方难度和制作时间为 MixMood 估计，来源未定量的项目保持原说明，不编造 ml。

## 目录

```text
engine/                    MoonBit 模块（moon.mod，新版清单格式）
  src/recommend.mbt        数据结构、匹配、评分、排序、JSON 导出接口
  src/recommend_wbtest.mbt MoonBit 单元测试
  src/inventory.mbt        M2 库存状态、别名、缺失材料、优先级与 JSON 接口
  src/inventory_wbtest.mbt M2 单元测试
  src/preferences.mbt     M3 偏好校验与难度排序接口
  src/preferences_wbtest.mbt M3 单元测试
web/                       React + TypeScript + Vite
  src/engine.ts            数据序列化与调用接口，不包含推荐算法
  src/generated/           编译产物（.mjs 不提交）及接口类型声明
server/                    Node 内置 HTTP + fetch，AI 密钥只在此进程读取
data/                      配方、材料、偏好标签契约、来源记录与 M1 测试夹具
scripts/                   跨平台 MoonBit 编译、测试脚本
tests/                     编译产物集成测试与浏览器测试
```

保留初始 README 内容、MIT LICENSE 和 Git 历史。`engine/src/` 沿用 MoonBit 的 `source = "src"` 配置；M3 仅增加本地 Node HTTP 服务，不增加服务框架、数据库或 WASM 加载层。

## 环境与安装

- Node.js 22.12+（推荐 Node.js 24 LTS）和 npm。
- [MoonBit 官方工具链](https://www.moonbitlang.com/download)，本阶段使用 `moon 0.1.20261012` / `moonc v0.10.15` 验证。
- Git；Windows 普通终端推荐安装 [Git for Windows](https://git-scm.com/install/windows)。Codex 内置 Git 可用于 Codex 会话，但不代表系统 PATH 已配置。

Windows 安装 Node.js、MoonBit 后需重新打开终端以加载 PATH。

```powershell
git clone https://github.com/bale54188/mixmood.git
cd mixmood
npm.cmd ci
npm.cmd run dev
```

已有本地工作区可直接执行：

```powershell
cd D:\MixMood
npm.cmd ci
npm.cmd run dev
```

浏览器访问 **http://127.0.0.1:5173/**。`npm run dev`先编译 MoonBit，再同时启动 Node API（3001）与 Vite（5173），Vite 将`/api`代理到 Node。两个进程由脚本统一管理，任一启动失败时停止另一进程，按 Ctrl+C 结束两者。端口固定，冲突时明确报错。macOS / Linux 使用`npm`代替`npm.cmd`。

也可在两个终端分别运行 `npm.cmd run dev:server` 和 `npm.cmd run dev:web`（先执行 `npm.cmd run build:engine`）。仅启动 Vite 时，AI 面板会提示服务未连接，原有本地推荐仍可使用。

生产方式：先执行 `npm.cmd run build`，再 `npm.cmd start`。Node 同时提供 `web/dist/` 静态文件与 API，访问 **http://127.0.0.1:3001/**。开发和生产端口属于不同来源，酒柜记录各自独立。本阶段服务只监听回环地址，不包含公开部署或认证系统。

修改 MoonBit 后，另开终端执行 `npm.cmd run build:engine`，Vite 会自动更新页面；普通启动和生产构建均会重新编译，不会使用遗漏的旧产物。

## MoonBit 如何参与核心逻辑

`data/recipes.json` + `data/ingredients.json` + localStorage 库存 → React 序列化 → **MoonBit `recommend_inventory_json`** → 别名归一化 → 库存状态与缺失材料 → 材料齐全优先、口味排序 → JSON 输出 → React 展示。

- MoonBit 使用 JS 编译目标、`pkgtype(kind: "foreign_library")` 与 `#export_name` 导出 ESM。M2 使用新接口，M1 的 `recommend_json` 保留用于兼容性测试。
- JS 目标的 MoonBit `String` 对应 JS `string`；接口使用 JSON 字符串，不依赖 MoonBit 内部 Array / struct 的 ABI。
- TypeScript 只提供页面、搜索列表过滤、存储、序列化和配方展示元数据关联，不执行匹配或排序。
- 材料输入会在 MoonBit 中去空白、转小写和去重；匹配采用材料 ID，展示采用材料名称。
- M2 按四级规则排序：材料齐全优先 → 匹配标签数降序 → 缺失必需材料数升序 → 配方 ID 升序。材料齐全是独立的第一排序键，任何口味分数都不能将缺料配方排在材料齐全者之前。重复标签只计一次。
- M3 的 `recommend_preferences_json` 在同等口味匹配时加入难度偏好：材料齐全 → 口味 → 偏好难度 → 缺料数 → ID。难度是软偏好，不强制排除进阶配方；ID 沿用 MoonBit 的短字典序比较以保证稳定结果。原 M1/M2 接口和测试保留。
- 未录入库存时不推断缺失材料，`can_make` 始终为 false；明确确认空酒柜后，才返回所有必需材料缺失。未知材料单独报告，不算作已拥有。
- 「来点新鲜的」传入空标签，仍按材料情况排序，不调用 AI 或随机生成配方。未匹配的口味也可出现在结果中。
- 非法 JSON 或不符合结构的输入返回明确错误和空结果；不会回退到 TypeScript 模拟结果。

官方参考：[模块与 JS ESM 配置](https://docs.moonbitlang.com/en/stable/toolchain/moon/package.html)、[导出与 JS 类型互操作](https://docs.moonbitlang.com/en/stable/language/ffi.html)。

## 验证命令

在仓库根目录执行：

```powershell
npm.cmd test                 # 编译 + MoonBit 单测 + 实际 ESM 集成测试
npm.cmd run test:server      # AI HTTP 接口与 mock 供应商测试，无需真实 Key
npm.cmd run build            # MoonBit 编译 + TypeScript 检查 + Vite 生产构建
npm.cmd run test:e2e         # 浏览器交互、实际 ESM 调用、移动端及控制台检查
```

等价的引擎原生命令（在 `engine/` 下）：

```powershell
moon build --target js --release --deny-warn
moon test --target js --deny-warn
```

浏览器测试默认使用本机已安装的 Microsoft Edge，无需额外下载浏览器；其他环境可调整 `playwright.config.ts` 的浏览器 channel。测试会自动启动开发服务器，或复用已运行的本地服务器。

Milestone 2 本地验证：28 项 MoonBit 单元测试、19 项 ESM 集成与配方数据测试、12 项浏览器测试通过，TypeScript 检查与 Vite 生产构建成功。M1 的 12 项 MoonBit 测试和 5 项 ESM 测试保持原样；浏览器回归仍验证原有交互场景，改用真实配方与明确录入的库存，不再依赖默认虚构材料。

M3 新增 AI 服务端 mock、请求错误/超时、严格 JSON 与标签校验、隐私边界、响应脱敏、配方不变性，以及 AI 偏好进入实际 MoonBit 模块的测试。所有 AI 测试使用测试函数注入或 Playwright 路由 mock；运行时没有模拟 AI 开关，不需要真实密钥，也不产生真实供应商请求。

Milestone 3 本地验证：34 项 MoonBit 单元测试、19 项原有集成与配方数据测试、18 项 AI 服务端测试、19 项浏览器测试全部通过；TypeScript、Vite 生产构建和 Node 静态页面验证成功。原有 M1/M2 核心、配方数据及测试文件保持不变。

构建产物：`engine/_build/`、`web/src/generated/engine.mjs`、`web/dist/`，均忽略提交。依赖使用根目录 npm workspaces 和单个 `package-lock.json` 锁定；新克隆需先执行 `npm ci`，再运行开发或构建命令。

## 使用我的酒柜

1. 选择一种心情查看灵感，或点击「看看我的材料能调什么」打开酒柜。
2. 搜索中文名或英文名，勾选确实拥有的材料。已拥有区域可单独删除材料。
3. 没有任何材料时可点「我已确认没有材料」，与尚未录入明确区分；删除最后一项也保留“已确认空”的状态。
4. 更改自动保存至当前浏览器、当前网站来源的 `mixmood.inventory.v1`。关闭页面重开仍可读取；不跨设备同步。`localhost` 与 `127.0.0.1` 是不同来源，请固定使用 README 的地址。
5. 点配方卡查看用量、步骤、可选装饰和原始来源链接。「重置为未录入」删除本地酒柜记录。

localStorage 被禁用时显示保存失败提示，当前页仍可操作；损坏或未知版本记录按未录入处理并提示，不自动覆盖原记录。旧的未知材料不会被当作有效库存。

当前材料库有 30 种材料。青柠与青柠汁共用材料键，但不保证所拥有的水果能榨出足量果汁；苏打水与汤力水、干/甜味美思、方糖/糖浆不混为一谈。来源明确允许的波本/黑麦替代由 MoonBit 检查。

## 配方与来源

收录 Mojito、Margarita、Daiquiri、Gin & Tonic、Negroni 等 18 款。17 款参考 IBA，Gin & Tonic 参考 Sipsmith。详见 [逐款来源记录](data/SOURCES.md) 和 [数据结构说明](data/README.md)。只整理配方事实并自行撰写中文简述，不下载或使用第三方配方图片；页面继续使用原创 SVG 氛围插画。

保留来源的 dash、吧匙、茶匙、份等单位；Mojito 的苏打水、Old Fashioned 的苦精等未量化项目有明确文字说明。时间和难度为编辑估计。品牌配料在详情中保留名称，库存按相应材料类别判断，不验证具体品牌或风味一致性。

## 配置与使用 AI

不配置密钥也能运行完整的心情与酒柜推荐。AI 面板显示「AI 尚未配置」，按钮禁用，不会调用固定假结果。服务未启动时单独显示「AI 服务未连接」。

在仓库根目录复制示例文件，然后在本机编辑（不要把密钥发送到聊天或提交 Git）：

```powershell
Copy-Item .env.example .env
notepad .env
```

仅设置以下三个服务端变量，也可由启动进程的环境直接提供（优先于 `.env`）：

| 变量          | 含义                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------- |
| `AI_BASE_URL` | 供应商 OpenAI 兼容 API 基地址，例如 `https://provider.example/v1`，不包含 `/chat/completions` |
| `AI_API_KEY`  | 供应商密钥，仅在服务端读取                                                                    |
| `AI_MODEL`    | 该供应商提供、支持 JSON mode 的 Chat Completions 模型名称                                     |

示例文件的值都是占位符，复制后不修改仍被视为未配置。配置完成后重启 `npm run dev` 或 `npm start`，刷新页面或点击「重新检查连接」。不要使用 `VITE_` 前缀，不要在 React 代码中填写密钥。`.env`、`.env.*` 已忽略，仅 `.env.example` 可提交。

### API 与数据边界

`GET /api/ai/status` 只返回配置状态；`POST /api/ai/preferences` 只接受 `{ "text": "今天想喝清爽简单一点的酒" }`。不接受酒柜、材料清单或配方字段。描述为 1–600 字，请勿填写个人信息；服务端会拦截常见邮箱和电话号码等明显标识，但不能保证识别所有姓名或个人信息。

浏览器 → 本地 Node → `${AI_BASE_URL}/chat/completions` → 严格偏好校验 → 浏览器 → **MoonBit JS 核心**。上游请求只含固定的标签/难度说明和用户主动输入的文本，不附加完整酒柜、配方库或账户信息；不记录输入、密钥或供应商响应日志，也不持久化 AI 描述与结果。供应商的数据处理规则取决于所配置的服务。

使用标准 `messages`、`model` 和 `response_format: { "type": "json_object" }`，不安装供应商 SDK。供应商须支持该 JSON 模式并返回标准 `choices[0].message.content` 与完成状态 `stop`。依据 [官方 JSON mode 文档](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat)，JSON 模式不能保证字段契约，因此服务端独立校验 JSON、字段类型、额外字段与枚举；未知标签直接拒绝，不静默猜测。配置地址使用 HTTPS，本机回环地址可用 HTTP；拒绝带账号、密码或查询串的地址，不跟随重定向。

允许的口味由 `data/preferences.json` 定义并由测试核对真实配方：`fresh`、`citrus`、`bubbly`、`bitter`、`sweet`、`coffee`、`fruity`、`spirit-forward`、`dry`、`spicy`、`tropical`。当前没有 `sour`；酸爽需求映射为已有 `citrus`。难度为 `any` / `easy` / `intermediate`，分别对应不限 / 简单 / 进阶。

返回值示意（结构示例，运行时不使用固定结果）：

```json
{
  "preferences": {
    "flavors": ["fresh", "citrus", "sweet"],
    "difficulty": "easy",
    "description": "清新、柑橘、甜润、制作简单"
  }
}
```

AI 不能返回酒名、材料、用量或配方字段。为防止自由文字夹带配方或个人信息，模型的 `description` 字段虽会校验，但不会原样返回；公开的描述只由已验证的标签和难度生成。配方及数量始终来自本地真实数据。

接口设 4 KiB 请求体上限、12 秒上游超时、64 KiB 响应上限、最多 2 个并发 AI 请求。浏览器最多等待 18 秒；错误只显示固定安全提示，不回传上游原文或密钥。失败保留原有推荐，用户可重试或切回六种心情。选择心情会取消当前前端请求并忽略迟到的 AI 结果，难度排序完全由 MoonBit 实现。

## 后续阶段

本阶段止于 AI 偏好解析与 MoonBit 推荐的连接。未使用真实密钥验证某家供应商；实际联调需用户在本机配置并体验，不增加账号、数据库、社交或其他功能。

## License

MIT，见 [LICENSE](LICENSE)。
