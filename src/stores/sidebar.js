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

  // ---- Actions ----

  /**
   * 打开侧栏
   * @param {string} type - 侧栏内容类型
   * @param {any} payload - 侧栏数据
   */
  function open(type, payload = null) {
    contentType.value = type
    data.value = payload
    isOpen.value = true
  }

  /**
   * 关闭侧栏
   */
  function close() {
    isOpen.value = false
  }

  /**
   * 切换侧栏
   */
  function toggle() {
    isOpen.value = !isOpen.value
  }

  /**
   * 设置侧栏展开状态
   * @param {boolean} val
   */
  function setOpen(val) {
    isOpen.value = val
  }

  return {
    isOpen,
    contentType,
    data,
    open,
    close,
    toggle,
    setOpen,
  }
})