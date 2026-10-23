import { Renderer, type RendererOptions } from 'ogl'

/**
 * 建 ogl Renderer；拿不到 WebGL 上下文时返回 null，而不是把异常抛进 React。
 *
 * 无 GPU 加速的环境（`--disable-gpu`、显卡驱动被 Chromium 拉黑、远程桌面、部分 Linux 虚拟机）里
 * `canvas.getContext('webgl2' | 'webgl')` 返回 null，ogl 的 Renderer 构造器只打一行 console.error，
 * 随后在 `this.gl.renderer = this` 处抛 TypeError。这些动效挂在 useEffect 里，渲染进程没有任何
 * 边界接住它，抛出即卸载整个 #root——整窗白屏（首启介绍页第二幕即是）。
 *
 * 本目录的 ogl 动效都是装饰层：拿不到上下文就不画，页面文案与交互照常。
 */
export function createRendererOrNull(options?: Partial<RendererOptions>): Renderer | null {
  try {
    return new Renderer(options)
  } catch (error) {
    console.warn('[motion] 当前环境无法创建 WebGL 上下文，跳过装饰动效。', error)
    return null
  }
}
