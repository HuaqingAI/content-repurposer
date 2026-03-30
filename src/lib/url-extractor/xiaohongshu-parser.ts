import type { ExtractResult } from './extractor'

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9',
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function extractXhsContent(html: string): string | null {
  // 尝试 #detail-desc
  let match = html.match(/id=["']detail-desc["'][^>]*>([\s\S]*?)<\//)
  if (match) {
    const text = stripHtml(match[1])
    if (text.length >= 10) return text
  }

  // 尝试 note-content class（小红书反爬，class 名可能混淆）
  match = html.match(/class=["'][^"']*note-content[^"']*["'][^>]*>([\s\S]*?)<\//)
  if (match) {
    const text = stripHtml(match[1])
    if (text.length >= 10) return text
  }

  // 尝试 desc class
  match = html.match(/class=["'][^"']*\bdesc\b[^"']*["'][^>]*>([\s\S]*?)<\//)
  if (match) {
    const text = stripHtml(match[1])
    if (text.length >= 10) return text
  }

  return null
}

export async function extractXiaohongshu(
  url: string,
  signal?: AbortSignal
): Promise<ExtractResult> {
  try {
    // xhslink.com 短链需要跟随重定向
    const res = await fetch(url, {
      signal,
      headers: BROWSER_HEADERS,
      redirect: 'follow',
    })
    if (!res.ok) {
      return { success: false, error: '无法提取小红书内容，请手动粘贴' }
    }
    const html = await res.text()
    const text = extractXhsContent(html)
    if (!text) {
      // 小红书反爬强，失败属预期行为
      return { success: false, error: '无法提取小红书内容，请手动粘贴' }
    }
    return { success: true, text }
  } catch {
    return { success: false, error: '无法提取小红书内容，请手动粘贴' }
  }
}
