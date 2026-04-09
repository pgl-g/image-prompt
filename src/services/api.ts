/**
 * 公共 API 服务
 *
 * 统一视觉模型调用逻辑，供 popup.tsx 和 background.ts 共用。
 * 包含每日使用限制检查。
 */

import type { ModelConfig } from "~config/models"

// ======================== 统一 Prompt ========================

const VISION_SYSTEM_PROMPT =
  "你是专业提示词工程师。仔细观察图片中的所有视觉细节，生成一段准确的中文文生图提示词，包含主体、环境、光线、构图、色彩、风格。只输出提示词本身，不要任何解释或前缀。"

const VISION_USER_TEXT = "请根据这张图片生成高质量中文提示词。"

// ======================== 视觉模型调用 ========================

/** 调用视觉模型，将图片 base64 转为中文提示词 */
export async function callVisionModel(
  base64Url: string,
  config: ModelConfig
): Promise<string> {
  const res = await fetch(config.visionApi, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.visionModel,
      messages: [
        {
          role: "system",
          content: VISION_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: base64Url, detail: "high" }
            },
            { type: "text", text: VISION_USER_TEXT }
          ]
        }
      ],
      temperature: 0.7
    })
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`视觉分析失败: ${res.status} ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error("模型未返回提示词")
  return content
}

// ======================== 每日使用限制 ========================

/**
 * 检查是否超出每日使用限制，未超出则自动递增计数。
 * @returns true = 可以使用，false = 已达上限
 */
export async function checkUsageLimit(dailyLimit: number): Promise<boolean> {
  if (dailyLimit === -1) return true

  const today = new Date().toISOString().slice(0, 10)
  const data = await chrome.storage.local.get(["usageCount", "usageDate"])

  let count: number = data.usageCount || 0
  if (data.usageDate !== today) {
    count = 0
  }

  if (count >= dailyLimit) return false

  await chrome.storage.local.set({ usageCount: count + 1, usageDate: today })
  return true
}
