import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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

  // ---- 计算属性 ----
  const hasPrev = computed(() => currentIndex.value > 0)
  const hasNext = computed(() => currentIndex.value < currentPlaylist.value.length - 1)
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
  }

  function setPlaylist(list, startIndex = 0) {
    currentPlaylist.value = list
    currentIndex.value = startIndex
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

  function playNext() {
    if (hasNext.value) {
      currentIndex.value++
      return currentPlaylist.value[currentIndex.value]
    }
    return null
  }

  function playPrev() {
    if (hasPrev.value) {
      currentIndex.value--
      return currentPlaylist.value[currentIndex.value]
    }
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
  }

  return {
    currentTrack,
    currentPlaylist,
    currentIndex,
    isPlaying,
    progress,
    currentTime,
    duration,
    volume,
    isMuted,
    hasPrev,
    hasNext,
    progressPercent,
    setTrack,
    setPlaylist,
    setPlaying,
    setProgress,
    setCurrentTime,
    setDuration,
    setVolume,
    setMuted,
    playNext,
    playPrev,
    reset,
  }
})