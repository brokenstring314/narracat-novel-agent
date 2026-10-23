// 无 WebGL 环境（--disable-gpu、GPU 被驱动黑名单拉黑、远程桌面、部分 Linux 虚拟机）打开「记忆星图」的
// 真实 DOM 回归：three.js 的 WebGLRenderer 拿不到 webgl2 上下文会直接 throw，渲染进程里没有边界接住，
// 整个 #root 被卸载、整窗白屏；navigation-state 又记住了 sectionId=memory-graph，刷新、重启都回到
// 这里再白一次。这里锁住：拿不到上下文时不挂 3D 画布、不抛错，摘要读数照常可读，并告诉用户为什么没图。
//
// happy-dom 全局注册必须先于 @testing-library/react 的加载；查询一律用 container，不用 screen。
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()

const { afterAll, afterEach, beforeEach, describe, expect, test } = await import('bun:test')
const { act, cleanup, render } = await import('@testing-library/react')
const { TooltipProvider } = await import('@/components/ui/tooltip')
const { MemoryGraphView } = await import('./MemoryGraphView')
// 预先载入画布 chunk（three.js 很大，冷载入在慢机上要好几秒）：星图壳在 useEffect 里 import() 它，
// 预热后那次 import() 在一两个微任务内就回来，用例不用靠长时间等待。
await import('./MemoryGraphCanvas')
type MemoryGraphSnapshot = import('@shared/types/memory-graph').MemoryGraphSnapshot

const populatedGraph: MemoryGraphSnapshot = {
  nodes: [
    { id: 'uid-a', kind: 'character', label: '苏见', ownerId: null, predicate: null, predicateLabel: null, factCount: 1, chapter: null },
    { id: 'uid-b', kind: 'character', label: '阿九', ownerId: null, predicate: null, predicateLabel: null, factCount: 0, chapter: null },
    { id: 'f1', kind: 'fact', label: '找到师父下落', ownerId: 'uid-a', predicate: 'goal', predicateLabel: '目标', factCount: 0, chapter: 1 },
  ],
  links: [
    { source: 'uid-a', target: 'uid-b', kind: 'relationship', label: '同门相护' },
    { source: 'uid-a', target: 'f1', kind: 'belongs-to', label: null },
  ],
}

const originalGetContext = HTMLCanvasElement.prototype.getContext
const originalResizeObserver = globalThis.ResizeObserver
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeEach(() => {
  // 模拟无 WebGL：浏览器在 GPU 不可用时 getContext('webgl2'/'webgl') 返回 null（不抛错）
  HTMLCanvasElement.prototype.getContext = function getContext() {
    return null
  } as unknown as typeof HTMLCanvasElement.prototype.getContext
  // happy-dom 不做布局，容器尺寸恒为 0，画布永远不会去建 WebGLRenderer；
  // 这里让 ResizeObserver 报一个真实窗口里的尺寸，走到和真机相同的路径。
  globalThis.ResizeObserver = function FakeResizeObserver(callback: ResizeObserverCallback) {
    return {
      observe() {
        callback([{ contentRect: { width: 800, height: 600 } } as ResizeObserverEntry], this as unknown as ResizeObserver)
      },
      unobserve() {},
      disconnect() {},
    }
  } as unknown as typeof ResizeObserver
  console.error = () => {}
  console.warn = () => {}
})

afterEach(() => {
  cleanup()
  HTMLCanvasElement.prototype.getContext = originalGetContext
  globalThis.ResizeObserver = originalResizeObserver
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

afterAll(async () => {
  await GlobalRegistrator.unregister()
})

async function settle() {
  // 等画布 chunk 的动态 import() 回来并提交渲染（星图壳在 useEffect 里载入画布）
  for (let i = 0; i < 20; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
}

describe('MemoryGraphView（无 WebGL）', () => {
  test('拿不到 WebGL 上下文时不挂 3D 画布、不抛错，摘要仍在，并说明原因', async () => {
    let view: ReturnType<typeof render> | undefined
    await act(async () => {
      view = render(
        <TooltipProvider>
          <MemoryGraphView projectPath="/p" initialGraph={populatedGraph} />
        </TooltipProvider>,
      )
    })
    await settle()

    const container = view!.container
    // 星图外框与摘要读数还在（窗口没有被整个卸载）
    expect(container.querySelector('[data-memory-graph-frame="true"]')).not.toBeNull()
    expect(container.textContent).toContain('人物与事物')
    // 没有去建 3D 画布
    expect(container.querySelector('[data-memory-graph-canvas="true"]')).toBeNull()
    expect(container.querySelector('canvas')).toBeNull()
    // 给出降级说明，而不是一块无解释的黑底
    const notice = container.querySelector('[data-memory-graph-webgl-unavailable="true"]')
    expect(notice).not.toBeNull()
    expect(notice!.textContent).toContain('WebGL')
  })
})
