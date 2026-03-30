/**
 * @jest-environment node
 */

jest.mock('../wechat-parser', () => ({
  extractWechat: jest.fn(),
}))

jest.mock('../zhihu-parser', () => ({
  extractZhihu: jest.fn(),
}))

jest.mock('../xiaohongshu-parser', () => ({
  extractXiaohongshu: jest.fn(),
}))

import { extractUrl } from '../extractor'
import { extractWechat } from '../wechat-parser'
import { extractZhihu } from '../zhihu-parser'
import { extractXiaohongshu } from '../xiaohongshu-parser'

const mockExtractWechat = jest.mocked(extractWechat)
const mockExtractZhihu = jest.mocked(extractZhihu)
const mockExtractXiaohongshu = jest.mocked(extractXiaohongshu)

beforeEach(() => {
  jest.clearAllMocks()
})

describe('extractUrl - 支持域名路由', () => {
  it('微信公众号 URL 路由到 wechat-parser，返回成功', async () => {
    mockExtractWechat.mockResolvedValue({ success: true, text: '微信文章内容' })
    const result = await extractUrl('https://mp.weixin.qq.com/s/abc123')
    expect(mockExtractWechat).toHaveBeenCalledTimes(1)
    expect(mockExtractZhihu).not.toHaveBeenCalled()
    expect(mockExtractXiaohongshu).not.toHaveBeenCalled()
    expect(result).toEqual({ success: true, text: '微信文章内容' })
  })

  it('知乎专栏 URL（zhuanlan.zhihu.com）路由到 zhihu-parser', async () => {
    mockExtractZhihu.mockResolvedValue({ success: true, text: '知乎文章内容' })
    const result = await extractUrl('https://zhuanlan.zhihu.com/p/12345')
    expect(mockExtractZhihu).toHaveBeenCalledTimes(1)
    expect(mockExtractWechat).not.toHaveBeenCalled()
    expect(result).toEqual({ success: true, text: '知乎文章内容' })
  })

  it('知乎 URL（www.zhihu.com）路由到 zhihu-parser', async () => {
    mockExtractZhihu.mockResolvedValue({ success: true, text: '知乎内容' })
    const result = await extractUrl('https://www.zhihu.com/question/12345/answer/67890')
    expect(mockExtractZhihu).toHaveBeenCalledTimes(1)
    expect(result.success).toBe(true)
  })

  it('小红书 URL（www.xiaohongshu.com）路由到 xiaohongshu-parser', async () => {
    mockExtractXiaohongshu.mockResolvedValue({ success: true, text: '小红书内容' })
    const result = await extractUrl('https://www.xiaohongshu.com/explore/abc')
    expect(mockExtractXiaohongshu).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ success: true, text: '小红书内容' })
  })

  it('小红书短链（xhslink.com）路由到 xiaohongshu-parser', async () => {
    mockExtractXiaohongshu.mockResolvedValue({ success: true, text: '小红书内容' })
    const result = await extractUrl('https://xhslink.com/abc123')
    expect(mockExtractXiaohongshu).toHaveBeenCalledTimes(1)
    expect(result.success).toBe(true)
  })
})

describe('extractUrl - 不支持域名', () => {
  it('不支持的域名直接返回失败，不调用任何 parser', async () => {
    const result = await extractUrl('https://www.bilibili.com/video/BV1234')
    expect(mockExtractWechat).not.toHaveBeenCalled()
    expect(mockExtractZhihu).not.toHaveBeenCalled()
    expect(mockExtractXiaohongshu).not.toHaveBeenCalled()
    expect(result).toEqual({ success: false, error: '不支持该链接来源，请手动粘贴内容' })
  })

  it('无效 URL 抛异常时返回失败', async () => {
    const result = await extractUrl('not-a-valid-url')
    expect(result.success).toBe(false)
    expect(typeof (result as { success: false; error: string }).error).toBe('string')
  })
})

describe('extractUrl - parser 异常统一捕获', () => {
  it('parser 抛出异常时统一捕获，返回失败', async () => {
    mockExtractWechat.mockRejectedValue(new Error('网络错误'))
    const result = await extractUrl('https://mp.weixin.qq.com/s/abc')
    expect(result.success).toBe(false)
  })
})

describe('extractUrl - AbortSignal 传递', () => {
  it('将 signal 传递给对应 parser', async () => {
    mockExtractWechat.mockResolvedValue({ success: true, text: '内容' })
    const signal = AbortSignal.timeout(5000)
    await extractUrl('https://mp.weixin.qq.com/s/abc', signal)
    expect(mockExtractWechat).toHaveBeenCalledWith(
      'https://mp.weixin.qq.com/s/abc',
      signal
    )
  })
})
