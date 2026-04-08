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
  /** API 密钥 */
  apiKey: string
  /** 套餐显示名称 */
  label: string
  /** 套餐描述文案 */
  description: string
  /** 每日使用次数限制，-1 表示不限 */
  dailyLimit: number
  /** 生成图片分辨率 */
  imageSize: string
}

// ======================== API 密钥 ========================

const SILICONFLOW_API_KEY = "sk-gdiamfgbkdmmeazdmqzgbjilaicxynggkjulbstylytjojqz"

// ======================== 套餐配置 ========================

export const MODEL_TIERS: Record<TierLevel, ModelConfig> = {
  free: {
    visionApi: "https://api.siliconflow.cn/v1/chat/completions",
    visionModel: "Qwen/Qwen2.5-VL-72B-Instruct",
    imageGenApi: "https://api.siliconflow.cn/v1/images/generations",
    imageGenModel: "Qwen/Qwen-Image",
    apiKey: SILICONFLOW_API_KEY,
    label: "免费版",
    description: "Qwen-Image 生图 + Qwen2.5-VL 识图",
    dailyLimit: 10,
    imageSize: "1024x1024"
  },
  basic: {
    visionApi: "https://api.siliconflow.cn/v1/chat/completions",
    visionModel: "Qwen/Qwen2.5-VL-72B-Instruct",
    imageGenApi: "https://api.siliconflow.cn/v1/images/generations",
    imageGenModel: "Qwen/Qwen-Image",
    apiKey: SILICONFLOW_API_KEY,
    label: "基础版",
    description: "Qwen-Image 生图 + Qwen2.5-VL 识图",
    dailyLimit: 50,
    imageSize: "1024x1024"
  },
  premium: {
    visionApi: "https://api.siliconflow.cn/v1/chat/completions",
    visionModel: "Qwen/Qwen2.5-VL-72B-Instruct",
    imageGenApi: "https://api.siliconflow.cn/v1/images/generations",
    imageGenModel: "Qwen/Qwen-Image",
    apiKey: SILICONFLOW_API_KEY,
    label: "高级版",
    description: "Qwen-Image 生图 + Qwen2.5-VL 识图",
    dailyLimit: -1,
    imageSize: "1024x1024"
  }
}

// ======================== 工具函数 ========================

export const TIER_ORDER: TierLevel[] = ["free", "basic", "premium"]

export const DEFAULT_TIER: TierLevel = "free"

/** 根据套餐等级获取对应模型配置，无效等级自动降级为 free */
export const getTierConfig = (tier: TierLevel): ModelConfig => {
  return MODEL_TIERS[tier] || MODEL_TIERS[DEFAULT_TIER]
}
