import { extractWechat } from './wechat-parser'
import { extractZhihu } from './zhihu-parser'
import { extractXiaohongshu } from './xiaohongshu-parser'
import { extractViaJina } from './jina-extractor'

export type ExtractResult =
  | { success: true; text: string }
  | { success: false; error: string }

// Jina Reader 独立超时，不占用主 signal 的时间预算
const JINA_TIMEOUT_MS = 8_000

export async function extractUrl(
  url: string,
  signal?: AbortSignal
): Promise<ExtractResult> {
  try {
    const hostname = new URL(url).hostname

    // 1. 先用 Jina Reader 提取（通用方案，成功率更高）
    const jinaResult = await extractViaJina(url, AbortSignal.timeout(JINA_TIMEOUT_MS))
    if (jinaResult.success) return jinaResult

    // 2. Jina 失败后 fallback 到平台专用解析器
    if (hostname === 'mp.weixin.qq.com') {
      return await extractWechat(url, signal)
    }

    if (hostname === 'zhuanlan.zhihu.com' || hostname === 'www.zhihu.com') {
      return await extractZhihu(url, signal)
    }

    if (
      hostname === 'www.xiaohongshu.com' ||
      hostname === 'xiaohongshu.com' ||
      hostname === 'xhslink.com'
    ) {
      return await extractXiaohongshu(url, signal)
    }

    return { success: false, error: '不支持该链接来源，请手动粘贴内容' }
  } catch {
    return { success: false, error: '提取失败，请手动粘贴内容' }
  }
}
