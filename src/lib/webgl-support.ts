/**
 * 探测当前渲染进程能否建出 WebGL2 上下文。
 *
 * three.js（r163 起）只支持 WebGL2；`new WebGLRenderer()` 拿不到上下文会直接 throw。
 * 无 GPU 加速的环境（`--disable-gpu`、显卡驱动被 Chromium 拉黑、远程桌面、部分 Linux 虚拟机）里
 * `getContext('webgl2')` 返回 null，所以挂 3D 画布之前先探测一次，拿不到就走降级展示。
 * 探测用的上下文随即主动释放，不占浏览器的活跃上下文配额。
 */
export function canCreateWebGL2Context(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

/**
 * 探测能否建出任意 WebGL 上下文（先 webgl2，再 webgl1）。
 *
 * 与 ogl 的 Renderer 取上下文的顺序一致，用于介绍页的 ogl 动效：拿不到就直接走静态展示，
 * 不等 renderer 创建失败后留下空白区域。探测用的上下文随即释放。
 */
export function canCreateWebGLContext(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}
