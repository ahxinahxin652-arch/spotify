<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '../stores/player.js'
import '../styles/mainLyricsView.css'

const player = usePlayerStore()
const router = useRouter()

const lyricsList = ref([]) // Array of { time: number, text: string }
const lyricsContainerRef = ref(null)
const currentIndex = ref(-1)

// New States for UX & Performance
const isLoading = ref(true)
const isAutoScrollEnabled = ref(true)
const isCurrentLineVisible = ref(true)
const isUserInteracting = ref(false)

let programmaticScrollTimeout = null
let userInteractionTimeout = null
let stableTimeout = null
let isProgrammaticScrolling = false

// 解析 LRC 格式
function parseLRC(lrcString) {
  if (!lrcString) return []
  const lines = lrcString.split('\n')
  const result = []
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g
  
  for (const line of lines) {
    const text = line.replace(timeRegex, '').trim()
    let match
    timeRegex.lastIndex = 0
    while ((match = timeRegex.exec(line)) !== null) {
      const min = parseInt(match[1], 10)
      const sec = parseInt(match[2], 10)
      const ms = parseInt(match[3], 10)
      const msFactor = match[3].length === 2 ? 10 : 1
      const timeInSec = min * 60 + sec + (ms * msFactor) / 1000
      result.push({ time: timeInSec, text })
    }
  }
  
  result.sort((a, b) => a.time - b.time)
  return result
}

// 监听歌词数据变化
watch(() => player.currentLyrics, (newLyrics) => {
  lyricsList.value = parseLRC(newLyrics)
  currentIndex.value = -1
  isAutoScrollEnabled.value = true
  isCurrentLineVisible.value = true
  updateHighlight()
}, { immediate: true })

// 监听播放时间变化以高亮和滚动
watch(() => player.currentTime, () => {
  updateHighlight()
})

function updateHighlight() {
  if (lyricsList.value.length === 0) {
    currentIndex.value = -1
    return
  }
  
  const time = player.currentTime
  let newIndex = -1
  for (let i = 0; i < lyricsList.value.length; i++) {
    if (time >= lyricsList.value[i].time) {
      newIndex = i
    } else {
      break
    }
  }
  
  if (newIndex !== currentIndex.value) {
    currentIndex.value = newIndex
    if (isAutoScrollEnabled.value) {
      scrollToCurrent()
    } else {
      nextTick(() => {
        checkActiveLineVisibility()
      })
    }
  }
}

function scrollToCurrent(options = { behavior: 'smooth' }) {
  if (!isAutoScrollEnabled.value || isLoading.value) return
  
  nextTick(() => {
    if (!lyricsContainerRef.value) return
    const container = lyricsContainerRef.value
    const activeLine = container.querySelector('.lyrics-line-item.active')
    if (activeLine) {
      const containerHeight = container.clientHeight
      const offsetTop = activeLine.offsetTop
      const itemHeight = activeLine.clientHeight
      const scrollTop = offsetTop - (containerHeight / 2) + (itemHeight / 2)
      
      isProgrammaticScrolling = true
      container.scrollTo({ top: scrollTop, behavior: options.behavior })
      
      if (programmaticScrollTimeout) clearTimeout(programmaticScrollTimeout)
      programmaticScrollTimeout = setTimeout(() => {
        isProgrammaticScrolling = false
      }, options.behavior === 'smooth' ? 800 : 100)
    }
  })
}

// Check active line visibility relative to container bounds
function checkActiveLineVisibility() {
  if (!lyricsContainerRef.value) return
  const container = lyricsContainerRef.value
  const activeLine = container.querySelector('.lyrics-line-item.active')
  if (!activeLine) {
    isCurrentLineVisible.value = true
    return
  }
  
  const containerRect = container.getBoundingClientRect()
  const activeRect = activeLine.getBoundingClientRect()
  
  // Visible if it falls within the viewport with a safety margin of 15px
  const isVisible = (
    activeRect.bottom >= containerRect.top + 15 &&
    activeRect.top <= containerRect.bottom - 15
  )
  
  isCurrentLineVisible.value = isVisible
}

// Handle User Manual Interaction
function handleUserInteraction() {
  isAutoScrollEnabled.value = false
  isUserInteracting.value = true
  
  if (userInteractionTimeout) clearTimeout(userInteractionTimeout)
  userInteractionTimeout = setTimeout(() => {
    isUserInteracting.value = false
    checkActiveLineVisibility()
  }, 1000)
}

function handleScroll() {
  if (isLoading.value) return
  checkActiveLineVisibility()
  
  // If user scrolls it back into view and is not interacting, resume auto scroll
  if (!isProgrammaticScrolling && isCurrentLineVisible.value && !isUserInteracting.value) {
    isAutoScrollEnabled.value = true
  }
}

function syncBack() {
  isAutoScrollEnabled.value = true
  scrollToCurrent({ behavior: 'smooth' })
}

// 点击歌词跳转播放进度
function seekToLine(time) {
  window.dispatchEvent(new CustomEvent('seek-track', { detail: { time } }))
  isAutoScrollEnabled.value = true
  scrollToCurrent({ behavior: 'smooth' })
}

function goBack() {
  router.back()
}

onMounted(() => {
  // Wait 400ms for stable transition and render to avoid page freeze
  stableTimeout = setTimeout(() => {
    isLoading.value = false
    nextTick(() => {
      scrollToCurrent({ behavior: 'auto' })
    })
  }, 400)
})

onUnmounted(() => {
  if (stableTimeout) clearTimeout(stableTimeout)
  if (programmaticScrollTimeout) clearTimeout(programmaticScrollTimeout)
  if (userInteractionTimeout) clearTimeout(userInteractionTimeout)
})
</script>

<template>
  <div class="main-lyrics-view">
    <!-- Immersive transition between loader and content -->
    <Transition name="fade" mode="out-in">
      <div v-if="isLoading" class="lyrics-loading-container" key="loading">
        <div class="lyrics-spinner"></div>
        <p class="lyrics-loading-text">正在载入歌词...</p>
      </div>

      <div 
        v-else
        class="lyrics-scroll-container" 
        ref="lyricsContainerRef"
        @wheel="handleUserInteraction"
        @pointerdown="handleUserInteraction"
        @touchstart="handleUserInteraction"
        @scroll="handleScroll"
        key="content"
      >
        <div v-if="lyricsList.length === 0" class="lyrics-empty-state">
          <p>{{ player.currentTrack ? '暂无歌词' : '未在播放曲目' }}</p>
        </div>
        <div v-else class="lyrics-list-wrapper">
          <div class="lyrics-spacer"></div>
          
          <div
            v-for="(line, idx) in lyricsList"
            :key="idx"
            class="lyrics-line-item"
            :class="{ active: idx === currentIndex }"
            @click="seekToLine(line.time)"
          >
            {{ line.text || '• • •' }}
          </div>
          
          <div class="lyrics-spacer"></div>
        </div>
      </div>
    </Transition>

    <!-- Floating Sync Button -->
    <Transition name="fade-slide">
      <button 
        v-if="!isLoading && !isAutoScrollEnabled && !isCurrentLineVisible && lyricsList.length > 0" 
        class="lyrics-sync-btn"
        @click="syncBack"
      >
        <svg class="sync-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        <span>返回播放位置</span>
      </button>
    </Transition>
  </div>
</template>
