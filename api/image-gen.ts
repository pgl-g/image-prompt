import type { VercelRequest, VercelResponse } from "@vercel/node"

const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY!
const IMAGE_GEN_API = "https://api.siliconflow.cn/v1/images/generations"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const { prompt, model, image_size } = req.body

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" })
  }

  try {
    const response = await fetch(IMAGE_GEN_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SILICONFLOW_API_KEY}`
      },
      body: JSON.stringify({
        model: model || "Qwen/Qwen-Image",
        prompt,
        image_size: image_size || "1024x1024"
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
