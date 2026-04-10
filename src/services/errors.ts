/**
 * 错误信息优化
 *
 * 将 API 错误码和网络异常映射为用户友好的中文提示。
 */

/** 根据 HTTP 状态码返回用户友好的错误描述 */
function describeHttpError(status: number): string {
  switch (status) {
    case 400:
      return "请求参数有误，请检查输入"
    case 401:
    case 403:
      return "请求验证失败，请更新扩展版本"
    case 429:
      return "请求过于频繁，请稍后再试"
    case 500:
      return "服务器内部错误，请稍后重试"
    case 502:
    case 503:
    case 504:
      return "服务暂时不可用，请稍后重试"
    default:
      return `请求失败 (${status})，请稍后重试`
  }
}

/** 将任意错误对象转为用户友好的中文消息 */
export function formatError(error: unknown): string {
  // 网络错误
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "网络连接失败，请检查网络后重试"
  }

  if (error instanceof Error) {
    const msg = error.message

    // 已经是用户友好消息的直接返回
    if (msg.includes("使用上限") || msg.includes("请明天再试")) return msg
    if (msg.includes("未返回")) return "模型未返回结果，请重试"

    // 尝试从消息中提取 HTTP 状态码
    const statusMatch = msg.match(/(\d{3})/)
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10)
      if (status >= 400 && status < 600) return describeHttpError(status)
    }

    return msg
  }

  return "未知错误，请重试"
}
