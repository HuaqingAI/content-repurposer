import { extractWechat } from './wechat-parser'
import { extractZhihu } from './zhihu-parser'
import { extractXiaohongshu } from './xiaohongshu-parser'

export type ExtractResult =
  | { success: true; text: string }
  | { success: false; error: string }

export async function extractUrl(
  url: string,
  signal?: AbortSignal
): Promise<ExtractResult> {
  try {
    const hostname = new URL(url).hostname

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
