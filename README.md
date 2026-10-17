# mixmood

An AI-powered cocktail recommender built with MoonBit.

**Your mood. Your cocktail.**

MixMood 是面向 2026 MoonBit 黑客松的开源 AI 调酒助手。目标是让用户从心情或已有材料出发，在经过核实的真实配方中发现可以制作的一杯。

当前进度：**Milestone 2，本地酒柜与真实配方推荐**。已实现六种心情选择、18 款经典配方、材料搜索与增删、localStorage 持久化、配方用量与步骤详情。MoonBit 负责库存状态、材料别名、缺失材料与排序。AI、账号、云数据库、收藏和社交尚未实现。

> 正式页面使用 18 款有来源的真实配方；原有 3 条 M1 示例仅用于回归测试。匹配只检查是否拥有必需材料，不判断数量、工具或冷却条件，装饰不参与匹配。未录入酒柜时只展示灵感，绝不声称材料齐全。配方难度和制作时间为 MixMood 估计，来源未定量的项目保持原说明，不编造 ml。

## 目录

```text
engine/                    MoonBit 模块（moon.mod，新版清单格式）
  src/recommend.mbt        数据结构、匹配、评分、排序、JSON 导出接口
  src/recommend_wbtest.mbt MoonBit 单元测试
  src/inventory.mbt        M2 库存状态、别名、缺失材料、优先级与 JSON 接口
  src/inventory_wbtest.mbt M2 单元测试
web/                       React + TypeScript + Vite
  src/engine.ts            数据序列化与调用接口，不包含推荐算法
  src/generated/           编译产物（.mjs 不提交）及接口类型声明
data/                      18 款真实配方、材料别名、来源核对记录与 M1 测试夹具
scripts/                   跨平台 MoonBit 编译、测试脚本
tests/                     编译产物集成测试与浏览器测试
```

保留初始 README 内容、MIT LICENSE 和 Git 历史。`engine/src/` 符合当前 MoonBit 的 `source = "src"` 目录配置；无需独立后端、数据库或 WASM 加载层。

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

浏览器访问 **http://127.0.0.1:5173/**。启动脚本会先编译 MoonBit，再启动 Vite；5173 端口已设为固定端口，冲突时会明确报错。macOS / Linux 使用 `npm` 代替 `npm.cmd`。

修改 MoonBit 后，另开终端执行 `npm.cmd run build:engine`，Vite 会自动更新页面；普通启动和生产构建均会重新编译，不会使用遗漏的旧产物。

## MoonBit 如何参与核心逻辑

`data/recipes.json` + `data/ingredients.json` + localStorage 库存 → React 序列化 → **MoonBit `recommend_inventory_json`** → 别名归一化 → 库存状态与缺失材料 → 材料齐全优先、口味排序 → JSON 输出 → React 展示。

- MoonBit 使用 JS 编译目标、`pkgtype(kind: "foreign_library")` 与 `#export_name` 导出 ESM。M2 使用新接口，M1 的 `recommend_json` 保留用于兼容性测试。
- JS 目标的 MoonBit `String` 对应 JS `string`；接口使用 JSON 字符串，不依赖 MoonBit 内部 Array / struct 的 ABI。
- TypeScript 只提供页面、搜索列表过滤、存储、序列化和配方展示元数据关联，不执行匹配或排序。
- 材料输入会在 MoonBit 中去空白、转小写和去重；匹配采用材料 ID，展示采用材料名称。
- M2 按四级规则排序：材料齐全优先 → 匹配标签数降序 → 缺失必需材料数升序 → 配方 ID 升序。材料齐全是独立的第一排序键，任何口味分数都不能将缺料配方排在材料齐全者之前。重复标签只计一次。
- 未录入库存时不推断缺失材料，`can_make` 始终为 false；明确确认空酒柜后，才返回所有必需材料缺失。未知材料单独报告，不算作已拥有。
- 「来点新鲜的」传入空标签，仍按材料情况排序，不调用 AI 或随机生成配方。未匹配的口味也可出现在结果中。
- 非法 JSON 或不符合结构的输入返回明确错误和空结果；不会回退到 TypeScript 模拟结果。

官方参考：[模块与 JS ESM 配置](https://docs.moonbitlang.com/en/stable/toolchain/moon/package.html)、[导出与 JS 类型互操作](https://docs.moonbitlang.com/en/stable/language/ffi.html)。

## 验证命令

在仓库根目录执行：

```powershell
npm.cmd test                 # 编译 + MoonBit 单测 + 实际 ESM 集成测试
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

## 后续阶段

本阶段止于本地酒柜与可追溯配方。后续可在另行确认范围后接入 AI，将自然语言转换为结构化偏好；AI 不生成或改写未经核实的配方用量。

## License

MIT，见 [LICENSE](LICENSE)。
