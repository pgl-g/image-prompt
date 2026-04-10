/**
 * 模型分级配置
 *
 * 定义 free / basic / premium 三个套餐等级，
 * 每个等级对应不同的视觉理解模型和图片生成模型。
 * background.ts 与 popup.tsx 共用此配置，通过 chrome.storage 中的
 * "currentTier" 字段读取当前用户等级。
 */

// ======================== 类型定义 ========================

export type TierLevel = "free" | "basic" | "premium"

export interface ModelConfig {
  /** 视觉理解 API 地址（OpenAI 兼容格式） */
  visionApi: string
  /** 视觉理解模型名称 */
  visionModel: string
  /** 图片生成 API 地址 */
  imageGenApi: string
  /** 图片生成模型名称 */
  imageGenModel: string
  /** 套餐显示名称 */
  label: string
  /** 套餐描述文案 */
  description: string
  /** 每日使用次数限制，-1 表示不限 */
  dailyLimit: number
  /** 生成图片分辨率 */
  imageSize: string
}

// ======================== 后端代理地址 ========================

// Vercel 部署地址，所有 API 请求通过后端代理转发，API Key 存储在服务端
const API_BASE = "image-prompt-beta.vercel.app"

// ======================== 套餐配置 ========================

/** 三个套餐共用的基础模型配置 */
const BASE_CONFIG = {
  visionApi: `${API_BASE}/api/vision`,
  visionModel: "Qwen/Qwen2.5-VL-72B-Instruct",
  imageGenApi: `${API_BASE}/api/image-gen`,
  imageGenModel: "Qwen/Qwen-Image",
  imageSize: "1024x1024"
} as const

export const MODEL_TIERS: Record<TierLevel, ModelConfig> = {
  free: {
    ...BASE_CONFIG,
    label: "免费版",
    description: "Qwen-Image 生图 + Qwen2.5-VL 识图",
    dailyLimit: 10
  },
  basic: {
    ...BASE_CONFIG,
    label: "基础版",
    description: "Qwen-Image 生图 + Qwen2.5-VL 识图",
    dailyLimit: 50
  },
  premium: {
    ...BASE_CONFIG,
    label: "高级版",
    description: "Qwen-Image 生图 + Qwen2.5-VL 识图",
    dailyLimit: -1
  }
}

// ======================== 工具函数 ========================

export const DEFAULT_TIER: TierLevel = "free"

/** 根据套餐等级获取对应模型配置，无效等级自动降级为 free */
export const getTierConfig = (tier: TierLevel): ModelConfig => {
  return MODEL_TIERS[tier] || MODEL_TIERS[DEFAULT_TIER]
}
