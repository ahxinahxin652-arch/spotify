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
    scrollToCurrent()
  }
}

function scrollToCurrent() {
  nextTick(() => {
    if (!lyricsContainerRef.value) return
    const container = lyricsContainerRef.value
    const activeLine = container.querySelector('.lyrics-line-item.active')
    if (activeLine) {
      const containerHeight = container.clientHeight
      const offsetTop = activeLine.offsetTop
      const itemHeight = activeLine.clientHeight
      const scrollTop = offsetTop - (containerHeight / 2) + (itemHeight / 2)
      container.scrollTo({ top: scrollTop, behavior: 'smooth' })
    }
  })
}

// 点击歌词跳转播放进度
function seekToLine(time) {
  window.dispatchEvent(new CustomEvent('seek-track', { detail: { time } }))
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="main-lyrics-view">

    <!-- 滚动歌词容器 -->
    <div class="lyrics-scroll-container" ref="lyricsContainerRef">
      <div v-if="lyricsList.length === 0" class="lyrics-empty-state">
        <p>{{ player.currentTrack ? '暂无歌词' : '未在播放曲目' }}</p>
      </div>
      <div v-else class="lyrics-list-wrapper">
        <!-- 增加上下留白，使首尾句高亮时也能完美居中 -->
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
  </div>
</template>
