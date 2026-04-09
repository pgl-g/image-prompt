# VisionPrompt Workspace

> 项目维护日志，记录每次审查和更新的内容。

---

## 2026-04-09 代码审查报告

### 一、冗余 / 重复代码

#### 1. 视觉 API 调用逻辑重复 [高优先级]

`popup.tsx:74-120` 的 `analyzeImage()` 和 `background.ts:75-121` 的 `generatePromptByVision()` 存在大量重复：

- 相同的 API 请求结构（endpoint、headers、body format）
- 相同的响应解析逻辑（`data?.choices?.[0]?.message?.content?.trim()`）
- 仅 system prompt 和 message content 顺序存在细微差异

**建议**：抽取公共函数到 `src/utils/vision.ts` 或 `src/services/api.ts`，两端复用。

#### 2. System Prompt 不一致

| 文件 | System Prompt |
|------|---------------|
| `popup.tsx:91` | "...请根据图片内容生成一段中文文生图提示词，包含主体、环境、光线、构图、风格。只输出提示词本身，不要解释。" |
| `background.ts:92` | "...仔细观察图片中的所有视觉细节，然后输出一段准确的中文文生图提示词。只输出提示词本身，不要任何解释或前缀。" |

同一功能两处 prompt 不同，会导致右键生成和上传生成的提示词风格不一致。应统一维护在一处。

#### 3. Message Content 字段顺序不同

- `popup.tsx:95-98`：`image_url` 在前，`text` 在后
- `background.ts:97-104`：`text` 在前，`image_url` 在后

虽然不影响功能，但不一致的写法增加维护成本。

#### 4. `detail: "high"` 参数不一致

- `popup.tsx:96`：设置了 `detail: "high"`
- `background.ts:103`：未设置 `detail` 参数

可能导致两端图片识别精度不同。

#### 5. `temperature` 参数不一致

- `background.ts:108`：设置了 `temperature: 0.7`
- `popup.tsx`：未设置 `temperature`（使用模型默认值）

#### 6. `currentTier || DEFAULT_TIER` 冗余

`popup.tsx:42` 中 `getTierConfig(currentTier || DEFAULT_TIER)` —— `currentTier` 已在 `useStorage` 中设置默认值 `DEFAULT_TIER`，`|| DEFAULT_TIER` 是冗余的。

#### 7. `TIER_ORDER` 未使用

`config/models.ts:79` 导出了 `TIER_ORDER` 数组，但项目中无任何地方引用。

#### 8. 三个套餐配置高度重复

`config/models.ts:41-75` 中 `free`、`basic`、`premium` 三个配置除 `label`、`description`、`dailyLimit` 外完全相同，存在大量重复字段。

**建议**：使用基础配置 + 覆盖的方式减少重复：
```ts
const BASE_CONFIG = { visionApi, visionModel, imageGenApi, imageGenModel, apiKey, imageSize }
export const MODEL_TIERS = {
  free: { ...BASE_CONFIG, label: "免费版", dailyLimit: 10, ... },
  // ...
}
```

---

### 二、Bug / 潜在问题

#### 1. `dailyLimit` 未实现 [严重]

`config/models.ts` 定义了每日使用限制（free: 10次, basic: 50次, premium: 无限），但 **代码中无任何地方检查或执行此限制**。用户实际上可以无限次使用，分级形同虚设。

**影响**：API 额度可能被快速耗尽。

**建议**：在 `popup.tsx` 的 `generateImage()` 和 `analyzeImage()` 中添加计数和校验逻辑，使用 `chrome.storage.local` 存储每日使用计数。

#### 2. API Key 硬编码 [严重 - 安全]

`config/models.ts:37` 将 SiliconFlow API Key 直接硬编码在源码中。Chrome 扩展的代码对用户完全可见，任何人安装后都可以提取并滥用该密钥。

**建议**：上线前必须通过后端代理转发 API 请求，扩展端不直接持有密钥。

#### 3. `chrome.action.openPopup()` 可能失败 [中等]

`background.ts:33` 在收到 content script 消息后调用 `chrome.action.openPopup()`。该 API：
- 需要 Chrome 99+
- 在某些上下文中需要用户手势（user gesture）才能调用
- content script 发来的 message 可能不被视为用户手势

**表现**：复制提示词后 popup 可能不会自动弹出，但无报错提示。

**建议**：添加 `.catch()` 处理失败情况，或者在浮层中添加手动打开 popup 的提示。

#### 4. 大图存储可能超限 [低]

`popup.tsx:129` 将 base64 图片存入 `chrome.storage.local`，但未检查大小。`chrome.storage.local` 默认限制为 10MB（可通过 `unlimitedStorage` 权限解除）。高分辨率图片的 base64 可能超过限制。

**建议**：添加文件大小校验，或者在 manifest 中添加 `unlimitedStorage` 权限。

#### 5. 图片下载 CORS 问题 [低]

`popup.tsx:180-194` 的 `handleDownload()` 通过 `fetch(imageUrl)` 下载图片，可能因 CORS 策略失败。虽有 `window.open` 兜底，但用户体验不佳。

**建议**：使用 `chrome.downloads.download()` API 或在 background 中代理下载。

#### 6. 版本号硬编码

`popup.tsx:374` 中底部版本号 `v0.0.1` 是硬编码的字符串，与 `package.json` 中的 version 不联动，后续升级容易遗漏。

---

### 三、代码质量建议

| 类别 | 建议 |
|------|------|
| 结构 | 将 API 调用逻辑抽取到 `src/services/api.ts`，popup 和 background 共用 |
| 结构 | 将 system prompt 统一维护在 `src/config/prompts.ts` |
| 健壮性 | 为 `generateImage` 和 `analyzeImage` 添加每日使用限制检查 |
| 安全 | 上线前通过后端代理 API 请求，移除客户端 API Key |
| 体验 | `chrome.action.openPopup()` 添加失败兜底 |
| 维护 | 清理未使用的 `TIER_ORDER` 导出 |

---

## 更新记录

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2026-04-09 | - | 首次代码审查：发现 8 处冗余 / 重复，6 处 Bug / 潜在问题 |
| 2026-04-09 | - | 修复：抽取公共 API 服务、消除重复调用、实现每日限制、加固错误处理 |

---

## 2026-04-09 代码修复记录

### 修复清单

| # | 问题 | 修复方式 | 涉及文件 |
|---|------|----------|----------|
| 1 | 视觉 API 调用逻辑重复 | 抽取到 `src/services/api.ts` 的 `callVisionModel()`，popup 和 background 共用 | `services/api.ts` (新), `popup.tsx`, `background.ts` |
| 2 | System Prompt 不一致 | 统一维护在 `services/api.ts` 中的 `VISION_SYSTEM_PROMPT` 常量 | `services/api.ts` |
| 3 | Message Content 字段顺序不同 | 统一为 `image_url` 在前、`text` 在后 | `services/api.ts` |
| 4 | `detail: "high"` 参数不一致 | 统一设置 `detail: "high"` | `services/api.ts` |
| 5 | `temperature` 参数不一致 | 统一设置 `temperature: 0.7` | `services/api.ts` |
| 6 | 未使用的 `TIER_ORDER` | 移除 | `config/models.ts` |
| 7 | 三个套餐配置高度重复 | 抽取 `BASE_CONFIG`，各套餐使用展开运算符覆盖差异字段 | `config/models.ts` |
| 8 | `dailyLimit` 未实现 | 新增 `checkUsageLimit()` 函数，在 popup 和 background 的每次 API 调用前校验 | `services/api.ts`, `popup.tsx`, `background.ts` |
| 9 | `chrome.action.openPopup()` 无错误处理 | 添加 `.catch(() => {})` 静默处理失败 | `background.ts` |
| 10 | 大图存储可能超限 | 上传预览仅在 base64 < 5MB 时持久化到 storage | `popup.tsx` |
| 11 | API Key 硬编码 | 添加安全警告注释，上线前需接入后端代理（需后续架构调整） | `config/models.ts` |

### 未修复项（需后续处理）

| 问题 | 原因 |
|------|------|
| API Key 硬编码 | 需要搭建后端代理服务，属于架构级改动 |
| 版本号硬编码 | Plasmo 框架不直接支持 import package.json，需配置额外 loader |
| 图片下载 CORS | 扩展已有 `host_permissions: https://*/*`，实际影响较小 |
