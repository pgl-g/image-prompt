/**
 * 请求签名验证
 *
 * 验证客户端发送的 HMAC-SHA256 签名，防止 API 被直接滥用。
 * 签名算法：HMAC-SHA256(timestamp + "." + JSON.stringify(body), secret)
 *
 * 需要在 Vercel 环境变量中配置：
 *   - SIGN_SECRET（可选，有默认值）
 */

import crypto from "crypto"
import type { VercelRequest, VercelResponse } from "@vercel/node"

const SIGN_SECRET = process.env.SIGN_SECRET || "vp_s1gn_k3y_2026_x7m"
const TIME_WINDOW_MS = 5 * 60 * 1000 // ±5 分钟

/**
 * 验证请求签名。
 * @returns true = 签名有效，false = 签名无效（已写入 401 响应）
 */
export function verifySignature(
  req: VercelRequest,
  res: VercelResponse
): boolean {
  const signature = req.headers["x-signature"] as string | undefined
  const timestamp = req.headers["x-timestamp"] as string | undefined

  if (!signature || !timestamp) {
    res.status(401).json({ error: "缺少签名信息" })
    return false
  }

  // 检查时间窗口
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts) || Math.abs(Date.now() - ts) > TIME_WINDOW_MS) {
    res.status(401).json({ error: "签名已过期" })
    return false
  }

  // 重新计算签名
  const message = `${timestamp}.${JSON.stringify(req.body)}`
  const expected = crypto
    .createHmac("sha256", SIGN_SECRET)
    .update(message)
    .digest("hex")

  // 安全比较
  try {
    const sigBuf = Buffer.from(signature, "utf8")
    const expBuf = Buffer.from(expected, "utf8")
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      res.status(401).json({ error: "签名验证失败" })
      return false
    }
  } catch {
    res.status(401).json({ error: "签名格式错误" })
    return false
  }

  return true
}
