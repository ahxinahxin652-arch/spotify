<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '../stores/player.js'
import { useSidebarStore } from '../stores/sidebar.js'
import { Howl } from 'howler'

// ========== 状态 ==========
let currentBlobUrl = null
let howl = null

const player = usePlayerStore()
const sidebarStore = useSidebarStore()

// ========== emit ==========
const emit = defineEmits(['toggle-right-sidebar'])

function handleToggleSidebar() {
  emit('toggle-right-sidebar')
}

// ========== 监听外部播放事件 ==========
function handlePlayTrackEvent(e) {
  const { track, playlist, index } = e.detail
  playTrack(track, playlist, index)
}

onMounted(() => {
  window.addEventListener('play-track', handlePlayTrackEvent)
})

onUnmounted(() => {
  window.removeEventListener('play-track', handlePlayTrackEvent)
  stopCurrent()
})

// 格式化时间
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// 播放指定曲目
async function playTrack(track, playlist = [], index = -1) {
  stopCurrent()
  player.setTrack(track, playlist, index)

  // 通过 Electron IPC 读取文件为 Blob，绕过 file:// 限制
  let audioBlob
  try {
    audioBlob = await window.electronAPI.readFileAsBlob(track.path)
  } catch (err) {
    console.error('读取音频文件失败:', err)
    player.setPlaying(false)
    return
  }

  currentBlobUrl = URL.createObjectURL(audioBlob)

  // 读取真实的后缀名
  const fileExtension = track.path.split('.').pop().toLowerCase()

  howl = new Howl({
    src: [currentBlobUrl],
    format: [fileExtension],
    html5: true,
    volume: player.isMuted ? 0 : player.volume,
    onplay: () => {
      player.setPlaying(true)
      startProgressLoop()
    },
    onpause: () => {
      player.setPlaying(false)
    },
    onstop: () => {
      player.setPlaying(false)
      player.setCurrentTime(0)
    },
    onend: () => {
      // 自动播放下一首
      const next = player.playNext()
      if (next) {
        playTrack(next, player.currentPlaylist, player.currentIndex)
      } else {
        player.setPlaying(false)
      }
    },
    onload: () => {
      player.setDuration(howl.duration())
    },
    onloaderror: (id, err) => {
      console.error('加载失败:', err)
      player.setPlaying(false)
    },
    onplayerror: (id, err) => {
      console.error('播放失败:', err)
      player.setPlaying(false)
    },
  })

  howl.play()
}

function stopCurrent() {
  if (howl) {
    howl.unload()
    howl = null
  }
  if (currentBlobUrl) {
    URL.revokeObjectURL(currentBlobUrl)
    currentBlobUrl = null
  }
  stopProgressLoop()
}

// 播放/暂停
function togglePlay() {
  if (!howl) return
  if (player.isPlaying) {
    howl.pause()
  } else {
    howl.play()
  }
}

// 上一首
function prevTrack() {
  const prev = player.playPrev()
  if (prev) {
    playTrack(prev, player.currentPlaylist, player.currentIndex)
  }
}

// 下一首
function nextTrack() {
  const next = player.playNext()
  if (next) {
    playTrack(next, player.currentPlaylist, player.currentIndex)
  }
}

// 进度条拖动
const isDragging = ref(false)
const dragProgress = ref(0)

function seekTo(e) {
  if (!howl || !player.duration) return
  const rect = e.currentTarget.getBoundingClientRect()
  const x = e.clientX - rect.left
  const percent = Math.max(0, Math.min(1, x / rect.width))
  const seekTime = percent * player.duration
  howl.seek(seekTime)
  player.setCurrentTime(seekTime)
}

// 音量
function setVolume(e) {
  const val = parseFloat(e.target.value)
  player.setVolume(val)
  if (howl) {
    howl.volume(player.isMuted ? 0 : val)
  }
}

function toggleMute() {
  player.setMuted(!player.isMuted)
  if (howl) {
    howl.volume(player.isMuted ? 0 : player.volume)
  }
}

// 进度更新循环
let progressTimer = null
function startProgressLoop() {
  stopProgressLoop()
  progressTimer = setInterval(() => {
    if (howl && player.isPlaying && !isDragging.value) {
      const t = howl.seek()
      player.setCurrentTime(t)
    }
  }, 250)
}

function stopProgressLoop() {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
}

// 暴露给外部调用（通过事件）

onUnmounted(() => {
  stopCurrent()
})
</script>

<template>
  <footer class="footbar">
    <!-- 左侧：当前曲目信息 -->
    <div class="foot-left">
      <div v-if="player.currentTrack" class="track-info">
        <div class="track-cover">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
        <div class="track-detail">
          <span class="track-name">{{ player.currentTrack.name }}</span>
          <span class="track-warehouse">{{ player.currentTrack.warehouse }}</span>
        </div>
      </div>
      <div v-else class="track-info">
        <div class="track-cover empty">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
        <div class="track-detail">
          <span class="track-name empty-text">未播放任何曲目</span>
        </div>
      </div>
    </div>

    <!-- 中间：播放控制 -->
    <div class="foot-center">
      <div class="controls">
        <button class="ctrl-btn" @click="prevTrack" :disabled="!player.hasPrev" title="上一首">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>
        <button class="ctrl-btn play-btn" @click="togglePlay" :disabled="!player.currentTrack" title="播放/暂停">
          <svg v-if="!player.isPlaying" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/>
            <rect x="14" y="4" width="4" height="16"/>
          </svg>
        </button>
        <button class="ctrl-btn" @click="nextTrack" :disabled="!player.hasNext" title="下一首">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>

      <!-- 进度条 -->
      <div class="progress-area">
        <span class="time-label">{{ formatTime(player.currentTime) }}</span>
        <div class="progress-track" @click="seekTo">
          <div class="progress-bg"></div>
          <div class="progress-fill" :style="{ width: (player.duration > 0 ? player.currentTime / player.duration * 100 : 0) + '%' }"></div>
          <div class="progress-thumb"></div>
        </div>
        <span class="time-label">{{ formatTime(player.duration) }}</span>
      </div>
    </div>

    <!-- 右侧：音量 + 侧栏开关 -->
    <div class="foot-right">
      <!-- 右侧边栏切换按钮 -->
      <button
        class="ctrl-btn sidebar-toggle-btn"
        :class="{ active: sidebarStore.isOpen }"
        @click="handleToggleSidebar"
        :title="sidebarStore.isOpen ? '隐藏详情' : '显示详情'"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
        </svg>
      </button>

      <button class="ctrl-btn vol-btn" @click="toggleMute" :title="player.isMuted ? '取消静音' : '静音'">
        <svg v-if="!player.isMuted && player.volume > 0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
        <svg v-else-if="!player.isMuted && player.volume > 0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <line x1="23" y1="9" x2="17" y2="15"/>
          <line x1="17" y1="9" x2="23" y2="15"/>
        </svg>
      </button>
      <input
        type="range"
        class="volume-slider"
        min="0"
        max="1"
        step="0.01"
        :value="player.volume"
        @input="setVolume"
      />
    </div>
  </footer>
</template>