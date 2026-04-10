import type { VercelRequest, VercelResponse } from "@vercel/node"

const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY!
const VISION_API = "https://api.siliconflow.cn/v1/chat/completions"

const VISION_SYSTEM_PROMPT =
  "你是专业提示词工程师。仔细观察图片中的所有视觉细节，生成一段准确的中文文生图提示词，包含主体、环境、光线、构图、色彩、风格。只输出提示词本身，不要任何解释或前缀。"

const VISION_USER_TEXT = "请根据这张图片生成高质量中文提示词。"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { base64Url, model } = req.body

  if (!base64Url) {
    return res.status(400).json({ error: "Missing base64Url" })
  }

  try {
    const response = await fetch(VISION_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SILICONFLOW_API_KEY}`
      },
      body: JSON.stringify({
        model: model || "Qwen/Qwen2.5-VL-72B-Instruct",
        messages: [
          { role: "system", content: VISION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: base64Url, detail: "high" } },
              { type: "text", text: VISION_USER_TEXT }
            ]
          }
        ],
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const text = await response.text()
      return res.status(response.status).json({ error: text })
    }

    const data = await response.json()
    return res.status(200).json(data)
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Internal server error" })
  }
}
