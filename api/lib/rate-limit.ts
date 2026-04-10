/**
 * 服务端限流中间件
 *
 * 使用 Upstash Redis 实现基于 IP 的滑动窗口限流。
 * 需要在 Vercel 环境变量中配置：
 *   - UPSTASH_REDIS_REST_URL
 *   - UPSTASH_REDIS_REST_TOKEN
 *
 * 若未配置 Redis，限流将被跳过（降级为无限流）。
 */

import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
import type { VercelRequest, VercelResponse } from "@vercel/node"

let ratelimit: Ratelimit | null = null

function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    console.warn("[rate-limit] UPSTASH_REDIS_REST_URL / TOKEN 未配置，跳过限流")
    return null
  }

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(30, "1 d"),
    prefix: "vp:rl",
    analytics: true,
  })

  return ratelimit
}

/** 从请求中提取客户端 IP */
function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"]
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim()
  if (Array.isArray(forwarded)) return forwarded[0]
  return req.headers["x-real-ip"] as string || "unknown"
}

/**
 * 检查请求是否超出限流。
 * @returns true = 允许通过，false = 已超限（已写入 429 响应）
 */
export async function checkRateLimit(
  req: VercelRequest,
  res: VercelResponse
): Promise<boolean> {
  const rl = getRatelimit()
  if (!rl) return true

  const ip = getClientIp(req)

  try {
    const { success, limit, remaining, reset } = await rl.limit(ip)

    res.setHeader("X-RateLimit-Limit", limit)
    res.setHeader("X-RateLimit-Remaining", remaining)
    res.setHeader("X-RateLimit-Reset", reset)

    if (!success) {
      res.status(429).json({
        error: "请求过于频繁，请稍后再试",
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      })
      return false
    }

    return true
  } catch (err) {
    console.error("[rate-limit] Redis 错误，跳过限流:", err)
    return true
  }
}
