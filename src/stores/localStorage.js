import { defineStore } from 'pinia'
import { ref } from 'vue'

// ========== localStorage 字段常量 ==========
const KEY_MUSIC_UNLOCK_OUTPUT = 'music_unlock_output'
const KEY_MUSIC_CONVERT_OUTPUT = 'music_convert_output'

// ========== localStorage 管理 Store ==========
export const useLocalStorageStore = defineStore('localStorage', () => {
  // ---- 状态 ----
  const musicUnlockOutput = ref(localStorage.getItem(KEY_MUSIC_UNLOCK_OUTPUT) || '')
  const musicConvertOutput = ref(localStorage.getItem(KEY_MUSIC_CONVERT_OUTPUT) || '')

  // ---- Actions ----

  /**
   * 设置音乐解密输出目录
   * @param {string} path
   */
  function setMusicUnlockOutput(path) {
    musicUnlockOutput.value = path
    if (path) {
      localStorage.setItem(KEY_MUSIC_UNLOCK_OUTPUT, path)
    } else {
      localStorage.removeItem(KEY_MUSIC_UNLOCK_OUTPUT)
    }
  }

  /**
   * 设置音乐转换输出目录
   * @param {string} path
   */
  function setMusicConvertOutput(path) {
    musicConvertOutput.value = path
    if (path) {
      localStorage.setItem(KEY_MUSIC_CONVERT_OUTPUT, path)
    } else {
      localStorage.removeItem(KEY_MUSIC_CONVERT_OUTPUT)
    }
  }

  return {
    musicUnlockOutput,
    musicConvertOutput,
    setMusicUnlockOutput,
    setMusicConvertOutput,
  }
})