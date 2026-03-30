// @jest-environment jsdom

import { render, screen, fireEvent } from '@testing-library/react'
import { TextInput } from '../text-input'

describe('TextInput', () => {
  it('初始渲染（空文本）显示 0 / 5000 字', () => {
    render(<TextInput value="" onChange={() => {}} />)
    expect(screen.getByText('0 / 5000 字')).toBeInTheDocument()
  })

  it('少于 50 字时显示错误提示"原文至少需要 50 字"', () => {
    render(<TextInput value="太短" onChange={() => {}} />)
    expect(screen.getByText('原文至少需要 50 字')).toBeInTheDocument()
  })

  it('少于 50 字时字数提示变为警告色（text-amber-500）', () => {
    render(<TextInput value="太短" onChange={() => {}} />)
    const countEl = screen.getByText('2 / 5000 字')
    expect(countEl).toHaveClass('text-amber-500')
  })

  it('1 字时触发 isUnder，显示错误提示', () => {
    render(<TextInput value="一" onChange={() => {}} />)
    expect(screen.getByText('原文至少需要 50 字')).toBeInTheDocument()
  })

  it('49 字时触发 isUnder，显示错误提示', () => {
    const text = '一'.repeat(49)
    render(<TextInput value={text} onChange={() => {}} />)
    expect(screen.getByText('原文至少需要 50 字')).toBeInTheDocument()
  })

  it('刚好 50 字时无错误提示', () => {
    const text = '一'.repeat(50)
    render(<TextInput value={text} onChange={() => {}} />)
    expect(screen.queryByText('原文至少需要 50 字')).not.toBeInTheDocument()
    expect(screen.queryByText('原文超出 5000 字限制')).not.toBeInTheDocument()
  })

  it('200 字正常范围无错误提示，字数正确显示', () => {
    const text = '你好'.repeat(100) // 200 字
    render(<TextInput value={text} onChange={() => {}} />)
    expect(screen.getByText('200 / 5000 字')).toBeInTheDocument()
    expect(screen.queryByText('原文至少需要 50 字')).not.toBeInTheDocument()
    expect(screen.queryByText('原文超出 5000 字限制')).not.toBeInTheDocument()
  })

  it('超过 5000 字时显示"原文超出 5000 字限制"', () => {
    const text = '一'.repeat(5001)
    render(<TextInput value={text} onChange={() => {}} />)
    expect(screen.getByText('原文超出 5000 字限制')).toBeInTheDocument()
  })

  it('disabled=true 时 textarea 不可交互', () => {
    render(<TextInput value="测试内容" onChange={() => {}} disabled />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('onChange 在输入时被调用', () => {
    const handleChange = jest.fn()
    render(<TextInput value="" onChange={handleChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '新内容' } })
    expect(handleChange).toHaveBeenCalledWith('新内容')
  })

  it('字数超出 5000 时字数显示为红色（text-red-500）', () => {
    const text = '一'.repeat(5001)
    render(<TextInput value={text} onChange={() => {}} />)
    const countEl = screen.getByText(`${[...text].length} / 5000 字`)
    expect(countEl).toHaveClass('text-red-500')
  })
})
