/**
 * 客户端请求签名
 *
 * 使用 Web Crypto API 生成 HMAC-SHA256 签名，附加到请求头中。
 * 签名算法：HMAC-SHA256(timestamp + "." + JSON.stringify(body), secret)
 */

const SIGN_SECRET = "vp_s1gn_k3y_2026_x7m"

let cachedKey: CryptoKey | null = null

async function getSignKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey

  const encoder = new TextEncoder()
  cachedKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SIGN_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  return cachedKey
}

/**
 * 为请求体生成签名头。
 * 返回包含 Content-Type、X-Timestamp、X-Signature 的 headers 对象。
 */
export async function createSignedHeaders(
  body: object
): Promise<Record<string, string>> {
  const timestamp = String(Date.now())
  const message = `${timestamp}.${JSON.stringify(body)}`

  const encoder = new TextEncoder()
  const key = await getSignKey()
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message))

  const signature = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")

  return {
    "Content-Type": "application/json",
    "X-Timestamp": timestamp,
    "X-Signature": signature,
  }
}
