# mixmood

An AI-powered cocktail recommender built with MoonBit.

**Your mood. Your cocktail.**

MixMood 是面向 2026 MoonBit 黑客松的开源 AI 调酒助手。目标是让用户从心情或已有材料出发，在经过核实的真实配方中发现可以制作的一杯。

当前进度：**Milestone 1，可运行的最小骨架**。已经实现六种心情选择、材料勾选演示、MoonBit 配方匹配、缺失材料计算和口味排序。AI 自然语言理解、真实配方数据、配方详情、完整库存管理和收藏尚未实现。

> 当前 3 条配方均为临时技术示例，未经真实配方核对，不提供调制用量或制作步骤，不应作为调制指导。MoonBit 匹配仅判断是否拥有材料，不判断剩余用量是否足够。

## 目录

```text
engine/                    MoonBit 模块（moon.mod，新版清单格式）
  src/recommend.mbt        数据结构、匹配、评分、排序、JSON 导出接口
  src/recommend_wbtest.mbt MoonBit 单元测试
web/                       React + TypeScript + Vite
  src/engine.ts            数据序列化与调用接口，不包含推荐算法
  src/generated/           编译产物（.mjs 不提交）及接口类型声明
data/                      3 条示例 JSON 配方与数据说明
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

`data/recipes.example.json` → React 序列化输入 → **MoonBit `recommend_json`** → MoonBit 解析 Recipe / Ingredient → 库存匹配 → 缺失材料 → 口味评分和排序 → JSON 输出 → React 展示。

- MoonBit 使用 JS 编译目标，`pkgtype(kind: "foreign_library")` 和 `#export_name("recommend_json")` 导出 ESM。
- JS 目标的 MoonBit `String` 对应 JS `string`；接口使用 JSON 字符串，不依赖 MoonBit 内部 Array / struct 的 ABI。
- TypeScript 仅提供类型、心情对应的标签、展示用材料列表和序列化接口，不执行配方匹配或推荐排序。
- 材料输入会在 MoonBit 中去空白、转小写和去重；匹配采用材料 ID，展示采用材料名称。
- 评分：`10 × 匹配口味标签数 − 2 × 缺失材料数 +（材料齐全时加 5）`。重复口味标签只计一次。同分按配方 ID 升序。
- 保留所有示例配方并按分数排序，因此没有口味匹配的记录也可能出现；「来点新鲜的」传入空标签，按材料情况排序，不调用 AI 或随机生成配方。
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

构建产物：`engine/_build/`、`web/src/generated/engine.mjs`、`web/dist/`，均忽略提交。依赖使用根目录 npm workspaces 和单个 `package-lock.json` 锁定；新克隆需先执行 `npm ci`，再运行开发或构建命令。

## 后续阶段

核对真实配方及数据使用许可，补充准确用量与来源；扩展 MoonBit 的输入校验、材料别名和推荐规则；再接入 AI 将自然语言转换为结构化偏好。AI 不生成或改写未经核实的配方用量。

## License

MIT，见 [LICENSE](LICENSE)。
