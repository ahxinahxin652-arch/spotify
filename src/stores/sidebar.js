import { defineStore } from 'pinia'
import { ref } from 'vue'

// ========== 侧栏 Store ==========
// 用于管理右侧侧栏（如 Spotify 风格的曲目详情面板）
export const useSidebarStore = defineStore('sidebar', () => {
  // ---- 状态 ----
  // 是否展开侧栏
  const isOpen = ref(false)
  // 侧栏内容类型：'track-detail' | 'playlist-detail' | ...
  const contentType = ref('')
  // 侧栏数据
  const data = ref(null)
  // 侧栏是否正在执行动画（切换中）
  const isAnimating = ref(false)

  // ---- Actions ----

  /**
   * 打开侧栏
   * @param {string} type - 侧栏内容类型
   * @param {any} payload - 侧栏数据
   */
  function open(type, payload = null) {
    if (isAnimating.value) return
    contentType.value = type
    data.value = payload
    isOpen.value = true
  }

  /**
   * 关闭侧栏
   */
  function close() {
    if (isAnimating.value) return
    isOpen.value = false
  }

  /**
   * 切换侧栏
   */
  function toggle() {
    if (isAnimating.value) return
    isOpen.value = !isOpen.value
  }

  /**
   * 设置侧栏展开状态
   * @param {boolean} val
   */
  function setOpen(val) {
    if (isAnimating.value) return
    isOpen.value = val
  }

  /**
   * 开始动画（由 App.vue 在动画开始时调用）
   */
  function startAnimation() {
    isAnimating.value = true
  }

  /**
   * 结束动画（由 App.vue 在动画结束时调用）
   */
  function endAnimation() {
    isAnimating.value = false
  }

  return {
    isOpen,
    contentType,
    data,
    isAnimating,
    open,
    close,
    toggle,
    setOpen,
    startAnimation,
    endAnimation,
  }
})