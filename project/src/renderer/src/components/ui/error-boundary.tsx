/**
 * ViewErrorBoundary —— UI-1 健壮性批（2026-08-21 诊断 C1）
 * 视图级错误边界：渲染期异常只毁当前视图（兜底 UI + 重试），不再整页白屏。
 * 实测背景：mock 环境下一个订阅清理抛错即白屏（无任何恢复入口）。
 * 兜底复用 EmptyState error 态；重试 = 清空 error 重挂子树。
 */
import { Component, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from './empty-state'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** 兜底 UI（函数组件自取 i18n；class 组件内不能调 hook） */
function BoundaryFallback({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState
        error
        title={t('common.viewCrashed')}
        desc={t('common.viewCrashedDesc')}
        secondary={{ label: t('common.retry'), onClick: onRetry }}
      />
    </div>
  )
}

export class ViewErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown): void {
    // 堆栈进 console 便于 dev 定位；生产环境用户可见的是兜底 UI 而非白屏
    console.error('[view-crash]', error, info)
  }

  componentDidUpdate(prevProps: Props): void {
    // children 变化 = 用户已离开崩溃视图（或异常源已被替换）→ 自动清除残留错误，
    // 否则二次捕获的 error 会永久残留、切回正常视图也无法恢复（TDD 测试实证的真 bug）
    if (prevProps.children !== this.props.children && this.state.error !== null) {
      this.setState({ error: null })
    }
  }

  private retry = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      return <BoundaryFallback onRetry={this.retry} />
    }
    return this.props.children
  }
}
