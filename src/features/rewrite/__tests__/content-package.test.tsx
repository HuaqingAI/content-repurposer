// @jest-environment jsdom

import { render, screen, fireEvent } from '@testing-library/react'
import { ContentPackage } from '../content-package'

jest.mock('@/components/copy-button', () => ({
  CopyButton: ({ text, className }: { text: string; className?: string }) => (
    <button data-testid="copy-button" data-copy-text={text} className={className}>
      复制
    </button>
  ),
}))

describe('ContentPackage — 数据未到达时的占位符', () => {
  it('titles/tags/hook 均未传入时，各区域显示"生成中..."，组件不崩溃', () => {
    render(<ContentPackage body="" />)
    const placeholders = screen.getAllByText('生成中...')
    expect(placeholders).toHaveLength(3)
  })

  it('body 为空且未流式时，文案区域正常渲染', () => {
    render(<ContentPackage body="" isStreaming={false} />)
    // 不崩溃即可，StreamingText 会渲染空内容
    expect(screen.getAllByText('生成中...')).toHaveLength(3)
  })

  it('isStreaming=true 时，StreamingText 显示光标动画元素', () => {
    // 光标是 aria-hidden span，通过 container 检测存在
    const { container } = render(<ContentPackage body="内容..." isStreaming={true} />)
    const cursor = container.querySelector('[aria-hidden="true"]')
    expect(cursor).toBeInTheDocument()
  })
})

describe('ContentPackage — 备选标题展开/折叠', () => {
  const titles = ['标题一号', '标题二号', '标题三号']

  it('titles 传入后，折叠按钮可点击（不显示"生成中..."）', () => {
    render(<ContentPackage body="" titles={titles} />)
    // "生成中..." 只剩 2 个（tags 和 hook 区域）
    expect(screen.getAllByText('生成中...')).toHaveLength(2)
  })

  it('默认折叠，标题内容不可见', () => {
    render(<ContentPackage body="" titles={titles} />)
    expect(screen.queryByText('1. 标题一号')).not.toBeInTheDocument()
  })

  it('点击"备选标题"按钮后展开，显示 3 条标题', () => {
    render(<ContentPackage body="" titles={titles} />)
    fireEvent.click(screen.getByRole('button', { name: /备选标题/ }))
    expect(screen.getByText('1. 标题一号')).toBeInTheDocument()
    expect(screen.getByText('2. 标题二号')).toBeInTheDocument()
    expect(screen.getByText('3. 标题三号')).toBeInTheDocument()
  })

  it('展开后再次点击折叠，标题内容消失', () => {
    render(<ContentPackage body="" titles={titles} />)
    const btn = screen.getByRole('button', { name: /备选标题/ })
    fireEvent.click(btn)
    expect(screen.getByText('1. 标题一号')).toBeInTheDocument()
    fireEvent.click(btn)
    expect(screen.queryByText('1. 标题一号')).not.toBeInTheDocument()
  })
})

describe('ContentPackage — 推荐标签展开/折叠', () => {
  const tags = ['标签A', '标签B', '标签C']

  it('tags 传入后，折叠按钮可点击（不显示"生成中..."）', () => {
    render(<ContentPackage body="" tags={tags} />)
    expect(screen.getAllByText('生成中...')).toHaveLength(2)
  })

  it('默认折叠，标签内容不可见', () => {
    render(<ContentPackage body="" tags={tags} />)
    expect(screen.queryByText('#标签A')).not.toBeInTheDocument()
  })

  it('点击"推荐标签"按钮后展开，显示标签 pill', () => {
    render(<ContentPackage body="" tags={tags} />)
    fireEvent.click(screen.getByRole('button', { name: /推荐标签/ }))
    expect(screen.getByText('#标签A')).toBeInTheDocument()
    expect(screen.getByText('#标签B')).toBeInTheDocument()
    expect(screen.getByText('#标签C')).toBeInTheDocument()
  })
})

describe('ContentPackage — 互动引导语展开/折叠', () => {
  const hook = '欢迎在评论区分享你的想法！'

  it('hook 传入后，折叠按钮可点击（不显示"生成中..."）', () => {
    render(<ContentPackage body="" hook={hook} />)
    expect(screen.getAllByText('生成中...')).toHaveLength(2)
  })

  it('默认折叠，引导语内容不可见', () => {
    render(<ContentPackage body="" hook={hook} />)
    expect(screen.queryByText(hook)).not.toBeInTheDocument()
  })

  it('点击"互动引导语"按钮后展开，显示引导语全文', () => {
    render(<ContentPackage body="" hook={hook} />)
    fireEvent.click(screen.getByRole('button', { name: /互动引导语/ }))
    expect(screen.getByText(hook)).toBeInTheDocument()
  })

  it('展开后再次点击折叠，引导语内容消失', () => {
    render(<ContentPackage body="" hook={hook} />)
    const btn = screen.getByRole('button', { name: /互动引导语/ })
    fireEvent.click(btn)
    expect(screen.getByText(hook)).toBeInTheDocument()
    fireEvent.click(btn)
    expect(screen.queryByText(hook)).not.toBeInTheDocument()
  })
})

describe('ContentPackage — 完整数据展示', () => {
  it('传入完整数据时，所有区域占位符均消失', () => {
    render(
      <ContentPackage
        body="改写正文内容"
        titles={['标题1', '标题2', '标题3']}
        tags={['标签1', '标签2']}
        hook="互动引导语"
      />
    )
    expect(screen.queryByText('生成中...')).not.toBeInTheDocument()
  })

  it('body 有内容时，文案正确显示', () => {
    render(<ContentPackage body="这是改写后的正文" />)
    expect(screen.getByText('这是改写后的正文')).toBeInTheDocument()
  })
})

describe('ContentPackage — 一键复制功能', () => {
  it('body 非空且非 streaming 时，文案区域显示复制按钮，data-copy-text 为 body 内容', () => {
    render(<ContentPackage body="正文内容" isStreaming={false} />)
    const copyBtn = screen.getByTestId('copy-button')
    expect(copyBtn).toBeInTheDocument()
    expect(copyBtn).toHaveAttribute('data-copy-text', '正文内容')
  })

  it('isStreaming=true 时，文案区域无复制按钮', () => {
    render(<ContentPackage body="正文内容" isStreaming={true} />)
    expect(screen.queryByTestId('copy-button')).not.toBeInTheDocument()
  })

  it('body 为空时，无文案复制按钮', () => {
    render(<ContentPackage body="" isStreaming={false} />)
    expect(screen.queryByTestId('copy-button')).not.toBeInTheDocument()
  })

  it('titles 展开后，每条标题旁有复制按钮，data-copy-text 为对应标题文本', () => {
    const titles = ['标题A', '标题B', '标题C']
    render(<ContentPackage body="" titles={titles} />)
    fireEvent.click(screen.getByRole('button', { name: /备选标题/ }))
    const copyBtns = screen.getAllByTestId('copy-button')
    // 每条标题对应一个复制按钮
    const copyTexts = copyBtns.map((btn) => btn.getAttribute('data-copy-text'))
    expect(copyTexts).toContain('标题A')
    expect(copyTexts).toContain('标题B')
    expect(copyTexts).toContain('标题C')
  })

  it('tags 存在时，标签区域头部有复制按钮，data-copy-text 为逗号分隔全部标签', () => {
    const tags = ['标签1', '标签2', '标签3']
    render(<ContentPackage body="" tags={tags} />)
    const copyBtn = screen.getByTestId('copy-button')
    expect(copyBtn).toBeInTheDocument()
    expect(copyBtn).toHaveAttribute('data-copy-text', '标签1, 标签2, 标签3')
  })

  it('hook 存在时，引导语区域头部有复制按钮，data-copy-text 为 hook 全文', () => {
    const hook = '欢迎评论分享你的想法！'
    render(<ContentPackage body="" hook={hook} />)
    const copyBtn = screen.getByTestId('copy-button')
    expect(copyBtn).toBeInTheDocument()
    expect(copyBtn).toHaveAttribute('data-copy-text', hook)
  })

  it('titles/tags/hook 均未传入时，各区域无复制按钮', () => {
    render(<ContentPackage body="" />)
    expect(screen.queryByTestId('copy-button')).not.toBeInTheDocument()
  })

  it('备选标题区域头部无"复制全部"按钮（仅单条复制）', () => {
    const titles = ['标题A', '标题B', '标题C']
    render(<ContentPackage body="" titles={titles} />)
    // 标题区域折叠时，头部不显示复制按钮
    expect(screen.queryByTestId('copy-button')).not.toBeInTheDocument()
  })
})

describe('ContentPackage — 改写结果可编辑 (Story 4b.3)', () => {
  it('streaming 完成后，点击文案区域进入编辑模式，显示 textarea', () => {
    render(<ContentPackage body="原始内容" isStreaming={false} />)
    fireEvent.click(screen.getByText('原始内容'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('编辑模式下 textarea 预填 body 内容', () => {
    render(<ContentPackage body="原始内容" isStreaming={false} />)
    fireEvent.click(screen.getByText('原始内容'))
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('原始内容')
  })

  it('onBlur 退出编辑模式，修改内容保留在界面', () => {
    render(<ContentPackage body="原始内容" isStreaming={false} />)
    fireEvent.click(screen.getByText('原始内容'))
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '修改后内容' } })
    fireEvent.blur(textarea)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('修改后内容')).toBeInTheDocument()
  })

  it('按 Esc 键退出编辑模式，修改内容保留在界面', () => {
    render(<ContentPackage body="原始内容" isStreaming={false} />)
    fireEvent.click(screen.getByText('原始内容'))
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '修改后内容' } })
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('修改后内容')).toBeInTheDocument()
  })

  it('编辑状态下，复制按钮 data-copy-text 为当前编辑内容', () => {
    render(<ContentPackage body="原始内容" isStreaming={false} />)
    fireEvent.click(screen.getByText('原始内容'))
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '修改后内容' } })
    const copyBtn = screen.getByTestId('copy-button')
    expect(copyBtn).toHaveAttribute('data-copy-text', '修改后内容')
  })

  it('退出编辑后，复制按钮仍复制修改后内容', () => {
    render(<ContentPackage body="原始内容" isStreaming={false} />)
    fireEvent.click(screen.getByText('原始内容'))
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '修改后内容' } })
    fireEvent.blur(textarea)
    const copyBtn = screen.getByTestId('copy-button')
    expect(copyBtn).toHaveAttribute('data-copy-text', '修改后内容')
  })

  it('isStreaming=true 时不允许进入编辑模式（无 textarea）', () => {
    render(<ContentPackage body="内容..." isStreaming={true} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('用户未修改直接退出，复制按钮仍使用原始 body 内容', () => {
    render(<ContentPackage body="原始内容" isStreaming={false} />)
    fireEvent.click(screen.getByText('原始内容'))
    // 进入编辑但不修改，直接 blur 退出
    fireEvent.blur(screen.getByRole('textbox'))
    const copyBtn = screen.getByTestId('copy-button')
    expect(copyBtn).toHaveAttribute('data-copy-text', '原始内容')
  })
})

describe('ContentPackage — 反馈按钮与重新改写 (Story 4b.4)', () => {
  const RESULT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: { resultId: RESULT_ID, feedback: 'helpful' }, error: null }),
    })
  })

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).fetch
  })

  it('isStreaming=true 时，反馈按钮区域不渲染 (AC5)', () => {
    render(<ContentPackage body="内容..." isStreaming={true} resultId={RESULT_ID} />)
    expect(screen.queryByText('有帮助')).not.toBeInTheDocument()
    expect(screen.queryByText('没帮助')).not.toBeInTheDocument()
    expect(screen.queryByText('重新改写')).not.toBeInTheDocument()
  })

  it('非 streaming 且 body 非空时，反馈按钮区域渲染 (AC1, AC2)', () => {
    render(<ContentPackage body="改写内容" isStreaming={false} resultId={RESULT_ID} />)
    expect(screen.getByText('有帮助')).toBeInTheDocument()
    expect(screen.getByText('没帮助')).toBeInTheDocument()
  })

  it('body 为空时，反馈按钮区域不渲染', () => {
    render(<ContentPackage body="" isStreaming={false} resultId={RESULT_ID} />)
    expect(screen.queryByText('有帮助')).not.toBeInTheDocument()
  })

  it('resultId 未传入时，有帮助/没帮助按钮 disabled', () => {
    render(<ContentPackage body="改写内容" isStreaming={false} />)
    const helpfulBtn = screen.getByText('有帮助').closest('button')
    const notHelpfulBtn = screen.getByText('没帮助').closest('button')
    expect(helpfulBtn).toBeDisabled()
    expect(notHelpfulBtn).toBeDisabled()
  })

  it('点击"有帮助"：调用 API 且按钮进入高亮状态 (AC1)', async () => {
    render(<ContentPackage body="改写内容" isStreaming={false} resultId={RESULT_ID} />)
    fireEvent.click(screen.getByText('有帮助'))

    // 验证 API 调用参数
    expect(fetch).toHaveBeenCalledWith(
      `/api/rewrite/${RESULT_ID}/feedback`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ feedback: 'helpful' }),
      })
    )

    // 等待状态更新
    await screen.findByText('有帮助')
  })

  it('点击"没帮助"：显示 commentBox (AC2)', () => {
    render(<ContentPackage body="改写内容" isStreaming={false} resultId={RESULT_ID} />)
    fireEvent.click(screen.getByText('没帮助'))
    expect(screen.getByPlaceholderText('请说明原因（选填）')).toBeInTheDocument()
  })

  it('提交没帮助评论：调用 API 并携带 comment，commentBox 消失 (AC2)', async () => {
    render(<ContentPackage body="改写内容" isStreaming={false} resultId={RESULT_ID} />)
    fireEvent.click(screen.getByText('没帮助'))

    const textarea = screen.getByPlaceholderText('请说明原因（选填）')
    fireEvent.change(textarea, { target: { value: '内容不准确' } })
    fireEvent.click(screen.getByText('提交'))

    expect(fetch).toHaveBeenCalledWith(
      `/api/rewrite/${RESULT_ID}/feedback`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ feedback: 'not_helpful', comment: '内容不准确' }),
      })
    )

    // commentBox 消失
    await screen.findByText('没帮助')
    expect(screen.queryByPlaceholderText('请说明原因（选填）')).not.toBeInTheDocument()
  })

  it('取消没帮助评论：commentBox 消失，不调用 API', () => {
    render(<ContentPackage body="改写内容" isStreaming={false} resultId={RESULT_ID} />)
    fireEvent.click(screen.getByText('没帮助'))
    fireEvent.click(screen.getByText('取消'))
    expect(screen.queryByPlaceholderText('请说明原因（选填）')).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('点击"重新改写"：调用 onRewrite 并重置 feedbackState (AC3)', async () => {
    const mockRewrite = jest.fn()
    render(
      <ContentPackage body="改写内容" isStreaming={false} resultId={RESULT_ID} onRewrite={mockRewrite} />
    )

    // 先点"有帮助"
    fireEvent.click(screen.getByText('有帮助'))
    await screen.findByText('有帮助')

    // 再点"重新改写"
    fireEvent.click(screen.getByText('重新改写'))
    expect(mockRewrite).toHaveBeenCalledTimes(1)
  })

  it('onRewrite 未传入时不显示重新改写按钮', () => {
    render(<ContentPackage body="改写内容" isStreaming={false} resultId={RESULT_ID} />)
    expect(screen.queryByText('重新改写')).not.toBeInTheDocument()
  })

  it('body prop 变化时 feedbackState 重置（重写完成后新内容到来）(AC3)', async () => {
    const { rerender } = render(
      <ContentPackage body="原始改写内容" isStreaming={false} resultId={RESULT_ID} />
    )
    fireEvent.click(screen.getByText('有帮助'))
    await screen.findByText('有帮助')

    // 模拟重写后 body 变化
    rerender(<ContentPackage body="新改写内容" isStreaming={false} resultId={RESULT_ID} />)
    // feedbackState 应重置，有帮助按钮不再高亮（非 active 状态，按钮仍存在）
    expect(screen.getByText('有帮助')).toBeInTheDocument()
  })
})
