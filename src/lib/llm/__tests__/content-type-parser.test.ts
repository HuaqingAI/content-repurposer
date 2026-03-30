/**
 * @jest-environment node
 */
import { parseContentType } from '@/lib/llm/content-type-parser'

describe('parseContentType', () => {
  it('观点分析 → opinion', () => {
    expect(parseContentType('[CONTENT_TYPE]: 观点分析')).toBe('opinion')
  })

  it('体验叙事 → narrative', () => {
    expect(parseContentType('[CONTENT_TYPE]: 体验叙事')).toBe('narrative')
  })

  it('教程列表 → tutorial', () => {
    expect(parseContentType('[CONTENT_TYPE]: 教程列表')).toBe('tutorial')
  })

  it('评测对比 → review', () => {
    expect(parseContentType('[CONTENT_TYPE]: 评测对比')).toBe('review')
  })

  it('其他 → other', () => {
    expect(parseContentType('[CONTENT_TYPE]: 其他')).toBe('other')
  })

  it('标签值包含多余空白时仍正确解析', () => {
    expect(parseContentType('[CONTENT_TYPE]:  观点分析 ')).toBe('opinion')
  })

  it('输出中无 [CONTENT_TYPE] 标签时返回 other', () => {
    expect(parseContentType('这是一段没有标签的输出内容。')).toBe('other')
  })

  it('[CONTENT_TYPE] 后接未知文本时返回 other', () => {
    expect(parseContentType('[CONTENT_TYPE]: 未知类型')).toBe('other')
  })

  it('[CONTENT_TYPE] 标签不在第一行（中间位置）时仍能解析', () => {
    const output = `一些前置内容
第二行文字
[CONTENT_TYPE]: 教程列表
正文内容`
    expect(parseContentType(output)).toBe('tutorial')
  })
})
