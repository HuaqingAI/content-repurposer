'use client'

import { useState, useEffect } from 'react'
import { StreamingText } from './streaming-text'
import { CopyButton } from '@/components/copy-button'

interface ContentPackageProps {
  body: string
  isStreaming?: boolean
  titles?: string[]
  tags?: string[]
  hook?: string
  resultId?: string
  onRewrite?: () => void
}

export function ContentPackage({
  body,
  isStreaming = false,
  titles,
  tags,
  hook,
  resultId,
  onRewrite,
}: ContentPackageProps) {
  const [titlesOpen, setTitlesOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [hookOpen, setHookOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  // null = 未编辑过（回退到 body）；'' = 用户主动清空
  const [editedBody, setEditedBody] = useState<string | null>(null)

  // 反馈相关本地状态（每平台独立，天然隔离）
  const [feedbackState, setFeedbackState] = useState<'helpful' | 'not_helpful' | null>(null)
  const [commentText, setCommentText] = useState('')
  const [showCommentBox, setShowCommentBox] = useState(false)

  // Decision #2: 新 body 到达（新改写结果）时，重置编辑状态，避免旧编辑叠加新内容
  useEffect(() => {
    setEditedBody(null)
    setIsEditing(false)
  }, [body])

  // P11 fix: 依赖 resultId 变化重置反馈状态，而非 body 变化
  // 保证 tab A→B→A 切换时 A 的已选反馈状态不丢失（AC4），
  // 同时 resultId 变为 undefined（新改写启动清空 store）时自动关闭 commentBox（P8 fix）
  useEffect(() => {
    setFeedbackState(null)
    setCommentText('')
    setShowCommentBox(false)
  }, [resultId])

  // Task 2.1: 统一使用 displayText，确保复制和展示始终一致
  // null 哨兵：editedBody 为 null 时回退到原始 body
  const displayText = editedBody !== null ? editedBody : body

  const handleHelpful = async () => {
    if (!resultId) return
    try {
      // P1 fix: 检查 response.ok，HTTP 错误时不更新状态
      const response = await fetch(`/api/rewrite/${resultId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: 'helpful' }),
      })
      if (!response.ok) return
      setFeedbackState('helpful')
      setShowCommentBox(false)
    } catch {
      // 网络失败时静默，不影响用户使用
    }
  }

  const handleNotHelpful = () => {
    if (!resultId) return
    // P6 fix: showCommentBox 打开后按钮进入禁用状态（见 disabled 条件），防止重复触发
    setShowCommentBox(true)
  }

  const handleSubmitComment = async () => {
    if (!resultId) return
    try {
      // P1 fix: 检查 response.ok，HTTP 错误时不更新状态
      const response = await fetch(`/api/rewrite/${resultId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: 'not_helpful',
          comment: commentText || undefined,
        }),
      })
      if (!response.ok) return
      setFeedbackState('not_helpful')
      setShowCommentBox(false)
    } catch {
      // 网络失败时静默
    }
  }

  const handleRewrite = () => {
    setFeedbackState(null)
    setCommentText('')
    setShowCommentBox(false)
    onRewrite?.()
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 文案主体：streaming 时用 StreamingText；结束后可行内编辑 */}
      <div>
        {isStreaming ? (
          // Task 2.2: streaming 期间锁定，不允许进入编辑模式
          <StreamingText text={body} isStreaming={isStreaming} />
        ) : isEditing ? (
          // Task 1.3: 编辑状态 — textarea，预填 editedBody（null 时回退到 body），autoFocus
          <textarea
            value={displayText}
            onChange={(e) => setEditedBody(e.target.value)}
            // Task 1.4: onBlur 退出编辑，不清除 editedBody
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') setIsEditing(false) }}
            autoFocus
            rows={Math.max(4, displayText.split('\n').length + 1)}
            className="w-full resize-none outline-none rounded-lg border border-accent bg-surface-2 p-4 text-[13.5px] leading-[1.7] text-gray-800"
          />
        ) : (
          // Task 1.2: 非编辑状态 — 可点击 div，点击进入编辑
          <div
            onClick={body ? () => setIsEditing(true) : undefined}
            role={body ? 'button' : undefined}
            tabIndex={body ? 0 : undefined}
            aria-label={body ? '点击编辑内容' : undefined}
            onKeyDown={body ? (e) => {
              if ((e.key === 'Enter' && !e.nativeEvent.isComposing) || e.key === ' ') {
                e.preventDefault()
                setIsEditing(true)
              }
            } : undefined}
            className={[
              'min-h-[120px] rounded-lg border border-border-default bg-surface-2 p-4',
              'text-[13.5px] leading-[1.7] text-gray-800 whitespace-pre-wrap break-words',
              body ? 'cursor-text' : '',
            ].join(' ')}
          >
            {displayText}
          </div>
        )}
        {!isStreaming && body && (
          <div className="flex justify-end mt-1">
            {/* Task 1.5: 复制按钮使用 displayText，确保复制编辑后内容 */}
            <CopyButton text={displayText} />
          </div>
        )}
      </div>

      {/* 反馈按钮区域：仅在非 streaming 时渲染（AC5） */}
      {!isStreaming && body && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-secondary">这次改写</span>
            <button
              type="button"
              onClick={handleHelpful}
              disabled={!resultId}
              className={[
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                feedbackState === 'helpful'
                  ? 'bg-accent text-white border-accent'
                  : 'bg-surface-2 text-text-secondary border-border-default hover:border-accent hover:text-accent',
                !resultId ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              有帮助
            </button>
            <button
              type="button"
              onClick={handleNotHelpful}
              // P6 fix: showCommentBox 打开期间禁用，防止重复触发
              disabled={!resultId || feedbackState === 'not_helpful' || showCommentBox}
              className={[
                'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
                // P10 fix: showCommentBox 打开时按钮也高亮（表示处于激活状态），符合 AC2
                feedbackState === 'not_helpful' || showCommentBox
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-surface-2 text-text-secondary border-border-default hover:border-red-400 hover:text-red-500',
                !resultId || feedbackState === 'not_helpful' || showCommentBox ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              没帮助
            </button>
            {onRewrite && (
              <button
                type="button"
                onClick={handleRewrite}
                className="px-3 py-1 rounded-full text-xs font-medium border border-border-default bg-surface-2 text-text-secondary hover:border-accent hover:text-accent transition-colors cursor-pointer"
              >
                重新改写
              </button>
            )}
          </div>

          {/* 没帮助评论框（showCommentBox 时显示） */}
          {showCommentBox && (
            <div className="flex flex-col gap-2 p-3 rounded-lg border border-border-default bg-surface-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="请说明原因（选填）"
                rows={3}
                className="w-full resize-none outline-none bg-transparent text-[13px] leading-[1.6] text-gray-800 placeholder:text-text-caption"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCommentBox(false)}
                  className="px-3 py-1 text-xs text-text-secondary hover:text-gray-800 transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSubmitComment}
                  className="px-3 py-1 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
                >
                  提交
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 备选标题：不传 copyText（AC 要求单条复制，无"复制全部"按钮） */}
      <CollapsibleSection
        label="备选标题"
        isOpen={titlesOpen}
        onToggle={() => setTitlesOpen((v) => !v)}
        isEmpty={!titles || titles.length === 0}
      >
        {titles?.map((title, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-1 border-b border-border-default last:border-0"
          >
            <span className="text-[13.5px] text-gray-800 flex-1 mr-2">
              {i + 1}. {title}
            </span>
            <CopyButton text={title} />
          </div>
        ))}
      </CollapsibleSection>

      {/* 推荐标签：copyText = 所有标签逗号分隔 */}
      <CollapsibleSection
        label="推荐标签"
        isOpen={tagsOpen}
        onToggle={() => setTagsOpen((v) => !v)}
        isEmpty={!tags || tags.length === 0}
        copyText={tags ? tags.join(', ') : undefined}
      >
        <div className="flex flex-wrap gap-1.5">
          {tags?.map((tag, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full bg-accent-light text-accent text-xs font-medium"
            >
              #{tag}
            </span>
          ))}
        </div>
      </CollapsibleSection>

      {/* 互动引导语：copyText = hook 全文 */}
      <CollapsibleSection
        label="互动引导语"
        isOpen={hookOpen}
        onToggle={() => setHookOpen((v) => !v)}
        isEmpty={!hook}
        copyText={hook}
      >
        <p className="text-[13.5px] text-gray-800 leading-[1.7]">{hook}</p>
      </CollapsibleSection>
    </div>
  )
}

interface CollapsibleSectionProps {
  label: string
  isOpen: boolean
  onToggle: () => void
  /** true = 数据尚未到达，显示"生成中..."，禁用点击 */
  isEmpty: boolean
  /** 若提供且 !isEmpty，在头部显示复制按钮 */
  copyText?: string
  children: React.ReactNode
}

function CollapsibleSection({ label, isOpen, onToggle, isEmpty, copyText, children }: CollapsibleSectionProps) {
  return (
    <div className="rounded-lg border border-border-default overflow-hidden">
      {/* 头部 flex 行：展开按钮（flex-1）+ 可选复制按钮（不得嵌套 button） */}
      <div className="flex items-center bg-surface-2">
        <button
          type="button"
          onClick={isEmpty ? undefined : onToggle}
          disabled={isEmpty}
          aria-expanded={isEmpty ? undefined : isOpen}
          className={[
            'flex-1 flex items-center justify-between px-3 py-2',
            'text-xs font-medium text-text-secondary',
            isEmpty ? 'cursor-default' : 'hover:bg-accent-light transition-colors cursor-pointer',
          ].join(' ')}
        >
          <span>{label}</span>
          {isEmpty ? (
            <span className="text-text-caption">生成中...</span>
          ) : (
            <span
              className={[
                'transition-transform duration-150 inline-block',
                isOpen ? 'rotate-180' : '',
              ].join(' ')}
              aria-hidden="true"
            >
              ▾
            </span>
          )}
        </button>
        {/* 复制按钮：仅在数据就绪时显示 */}
        {!isEmpty && !!copyText && (
          <CopyButton text={copyText} className="mr-2 shrink-0" />
        )}
      </div>
      {!isEmpty && isOpen && (
        <div className="px-3 py-2 bg-white">
          {children}
        </div>
      )}
    </div>
  )
}
