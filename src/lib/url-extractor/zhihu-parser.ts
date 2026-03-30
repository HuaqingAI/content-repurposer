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

function extractZhihuContent(html: string): string | null {
  // 尝试匹配 Post-RichTextContainer
  let match = html.match(
    /class=["'][^"']*Post-RichTextContainer[^"']*["'][^>]*>([\s\S]*?)<\/div>/
  )
  if (match) {
    const text = stripHtml(match[1])
    if (text.length >= 10) return text
  }

  // 备用：articleBody
  match = html.match(/itemprop=["']articleBody["'][^>]*>([\s\S]*?)<\/article>/)
  if (match) {
    const text = stripHtml(match[1])
    if (text.length >= 10) return text
  }

  return null
}

export async function extractZhihu(
  url: string,
  signal?: AbortSignal
): Promise<ExtractResult> {
  try {
    const res = await fetch(url, { signal, headers: BROWSER_HEADERS })
    if (!res.ok) {
      return { success: false, error: '无法访问该知乎文章，请手动粘贴内容' }
    }
    const html = await res.text()
    const text = extractZhihuContent(html)
    if (!text) {
      return { success: false, error: '无法提取知乎文章内容，请手动粘贴内容' }
    }
    return { success: true, text }
  } catch {
    return { success: false, error: '提取知乎文章失败，请手动粘贴内容' }
  }
}
