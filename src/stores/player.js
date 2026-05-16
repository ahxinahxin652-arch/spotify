import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * 循环播放模式枚举
 * - OFF:    不循环，播放到列表末尾停止
 * - LIST:   循环播放整个歌单
 * - TRACK:  循环播放当前单首曲目
 */
export const RepeatMode = Object.freeze({
  OFF: 'off',
  LIST: 'list',
  TRACK: 'track',
})

export const usePlayerStore = defineStore('player', () => {
  // ---- 状态 ----
  const currentTrack = ref(null)        // 当前播放曲目 { name, path, warehouse, duration }
  const currentPlaylist = ref([])         // 当前播放列表
  const currentIndex = ref(-1)           // 当前播放索引
  const isPlaying = ref(false)          // 是否正在播放
  const progress = ref(0)               // 播放进度 0-100
  const currentTime = ref(0)             // 当前时间（秒）
  const duration = ref(0)                // 总时长（秒）
  const volume = ref(0.8)                // 音量 0-1
  const isMuted = ref(false)             // 是否静音
  const shuffle = ref(false)             // 随机播放
  const repeatMode = ref(RepeatMode.OFF) // 循环模式: off / list / track

  // 随机播放历史（用于随机模式下的"上一首"功能）
  const shuffleHistory = ref([])
  const shuffleHistoryIndex = ref(-1)

  // ---- 计算属性 ----
  const hasPrev = computed(() => {
    if (shuffle.value) {
      return shuffleHistoryIndex.value > 0 || shuffleHistory.value.length > 0
    }
    if (repeatMode.value === RepeatMode.LIST) return currentPlaylist.value.length > 0
    if (repeatMode.value === RepeatMode.TRACK) return currentPlaylist.value.length > 0
    return currentIndex.value > 0
  })

  const hasNext = computed(() => {
    if (repeatMode.value === RepeatMode.TRACK) return currentPlaylist.value.length > 0
    if (repeatMode.value === RepeatMode.LIST) return currentPlaylist.value.length > 0
    if (shuffle.value) return currentPlaylist.value.length > 0
    return currentIndex.value < currentPlaylist.value.length - 1
  })

  const progressPercent = computed(() => {
    if (duration.value === 0) return 0
    return Math.round((currentTime.value / duration.value) * 100)
  })

  // ---- Actions ----
  function setTrack(track, playlist = [], index = -1) {
    currentTrack.value = track
    if (playlist.length > 0) {
      currentPlaylist.value = playlist
      currentIndex.value = index
    }
    // 记录随机历史
    if (shuffle.value && index >= 0) {
      shuffleHistory.value.push(index)
      shuffleHistoryIndex.value = shuffleHistory.value.length - 1
    }
  }

  function setPlaylist(list, startIndex = 0) {
    currentPlaylist.value = list
    currentIndex.value = startIndex
    // 重置随机历史
    shuffleHistory.value = []
    shuffleHistoryIndex.value = -1
  }

  function setPlaying(val) {
    isPlaying.value = val
  }

  function setProgress(val) {
    progress.value = val
  }

  function setCurrentTime(val) {
    currentTime.value = val
  }

  function setDuration(val) {
    duration.value = val
  }

  function setVolume(val) {
    volume.value = Math.max(0, Math.min(1, val))
  }

  function setMuted(val) {
    isMuted.value = val
  }

  /**
   * 切换随机播放
   */
  function toggleShuffle() {
    shuffle.value = !shuffle.value
    if (shuffle.value) {
      // 开启随机时，将当前曲目作为历史起点
      if (currentIndex.value >= 0) {
        shuffleHistory.value = [currentIndex.value]
        shuffleHistoryIndex.value = 0
      }
    } else {
      // 关闭随机时，清空历史
      shuffleHistory.value = []
      shuffleHistoryIndex.value = -1
    }
  }

  /**
   * 切换循环模式: off -> list -> track -> off
   */
  function toggleRepeatMode() {
    switch (repeatMode.value) {
      case RepeatMode.OFF:
        repeatMode.value = RepeatMode.LIST
        break
      case RepeatMode.LIST:
        repeatMode.value = RepeatMode.TRACK
        break
      case RepeatMode.TRACK:
        repeatMode.value = RepeatMode.OFF
        break
    }
  }

  /**
   * 获取随机索引（排除当前索引）
   */
  function getRandomIndex() {
    if (currentPlaylist.value.length <= 1) return 0
    let newIndex
    do {
      newIndex = Math.floor(Math.random() * currentPlaylist.value.length)
    } while (newIndex === currentIndex.value)
    return newIndex
  }

  /**
   * 播放下一首
   * @returns {Object|null} 下一首 track，或 null
   */
  function playNext() {
    const list = currentPlaylist.value
    if (list.length === 0) return null

    // 循环播放单曲：返回当前 track
    if (repeatMode.value === RepeatMode.TRACK) {
      return list[currentIndex.value]
    }

    // 随机播放模式
    if (shuffle.value) {
      const nextIdx = getRandomIndex()
      currentIndex.value = nextIdx
      shuffleHistory.value.push(nextIdx)
      shuffleHistoryIndex.value = shuffleHistory.value.length - 1
      return list[nextIdx]
    }

    // 顺序播放
    const nextIndex = currentIndex.value + 1
    if (nextIndex < list.length) {
      currentIndex.value = nextIndex
      return list[nextIndex]
    }

    // 到达列表末尾
    if (repeatMode.value === RepeatMode.LIST) {
      currentIndex.value = 0
      return list[0]
    }

    // 不循环 (OFF)：到末尾停止
    return null
  }

  /**
   * 播放上一首
   * @returns {Object|null} 上一首 track，或 null
   */
  function playPrev() {
    const list = currentPlaylist.value
    if (list.length === 0) return null

    // 循环播放单曲：返回当前 track
    if (repeatMode.value === RepeatMode.TRACK) {
      return list[currentIndex.value]
    }

    // 随机播放模式：回溯历史
    if (shuffle.value) {
      if (shuffleHistoryIndex.value > 0) {
        shuffleHistoryIndex.value--
        const prevIdx = shuffleHistory.value[shuffleHistoryIndex.value]
        currentIndex.value = prevIdx
        return list[prevIdx]
      }
      // 无历史，随机选一个
      const randIdx = getRandomIndex()
      currentIndex.value = randIdx
      shuffleHistory.value.unshift(randIdx)
      shuffleHistoryIndex.value = 0
      return list[randIdx]
    }

    // 顺序播放
    const prevIndex = currentIndex.value - 1
    if (prevIndex >= 0) {
      currentIndex.value = prevIndex
      return list[prevIndex]
    }

    // 到达列表开头
    if (repeatMode.value === RepeatMode.LIST) {
      currentIndex.value = list.length - 1
      return list[list.length - 1]
    }

    // 不循环 (OFF)：到开头停止
    return null
  }

  function reset() {
    currentTrack.value = null
    currentPlaylist.value = []
    currentIndex.value = -1
    isPlaying.value = false
    progress.value = 0
    currentTime.value = 0
    duration.value = 0
    shuffleHistory.value = []
    shuffleHistoryIndex.value = -1
  }

  return {
    // 状态
    currentTrack,
    currentPlaylist,
    currentIndex,
    isPlaying,
    progress,
    currentTime,
    duration,
    volume,
    isMuted,
    shuffle,
    repeatMode,
    // 计算属性
    hasPrev,
    hasNext,
    progressPercent,
    // Actions
    setTrack,
    setPlaylist,
    setPlaying,
    setProgress,
    setCurrentTime,
    setDuration,
    setVolume,
    setMuted,
    toggleShuffle,
    toggleRepeatMode,
    playNext,
    playPrev,
    reset,
  }
})
