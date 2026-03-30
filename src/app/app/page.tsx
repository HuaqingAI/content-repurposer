import { Suspense } from 'react'
import { RewriteWorkspace } from '@/features/rewrite/rewrite-workspace'

// Suspense 包裹：RewriteWorkspace 内使用 useSearchParams()，需要 Suspense boundary
export default function AppPage() {
  return (
    <Suspense fallback={null}>
      <RewriteWorkspace />
    </Suspense>
  )
}
