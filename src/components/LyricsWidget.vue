<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

import '../styles/lyricsWidget.css'

const lyrics = ref([]) // { time: number, text: string }
const currentTime = ref(0)
const currentIndex = ref(-1)

const lyricsContainerRef = ref(null)

const isDragging = ref(false)
const dragOffset = { x: 0, y: 0 }

function onPointerDown(e) {
  if (e.target.closest('.toolbar')) return
  e.target.setPointerCapture(e.pointerId)
  isDragging.value = true
  dragOffset.x = e.screenX - window.screenX
  dragOffset.y = e.screenY - window.screenY
}

function onPointerMove(e) {
  if (isDragging.value && window.electronAPI && window.electronAPI.moveWindow) {
    const x = Math.round(e.screenX - dragOffset.x)
    const y = Math.round(e.screenY - dragOffset.y)
    window.electronAPI.moveWindow(x, y)
  }
}

function onPointerUp(e) {
  if (isDragging.value) {
    isDragging.value = false
    e.target.releasePointerCapture(e.pointerId)
  }
}

function closeWindow() {
  if (window.electronAPI && window.electronAPI.toggleLyricsWindow) {
    window.electronAPI.toggleLyricsWindow()
  }
}

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
      // 如果毫秒是两位数，则相当于几十毫秒 (如 .99 = 990ms)，如果是三位数则是真实的毫秒
      const msFactor = match[3].length === 2 ? 10 : 1
      const timeInSec = min * 60 + sec + (ms * msFactor) / 1000
      result.push({ time: timeInSec, text })
    }
  }
  
  // 按照时间排序
  result.sort((a, b) => a.time - b.time)
  return result
}

// 接收主进程消息
onMounted(() => {
  if (window.electronAPI && window.electronAPI.onLyricsStatusUpdate) {
    window.electronAPI.onLyricsStatusUpdate((data) => {
      // data: { lyrics: string, currentTime: number, isNew: boolean }
      
      // 如果是第一次或者换歌了，重新解析
      if (data.isNew) {
        if (data.lyrics) {
          lyrics.value = parseLRC(data.lyrics)
        } else {
          lyrics.value = []
        }
      }
      
      currentTime.value = data.currentTime || 0
      updateHighlight()
    })
  }
})

function updateHighlight() {
  if (lyrics.value.length === 0) {
    currentIndex.value = -1
    return
  }
  
  const time = currentTime.value
  let newIndex = -1
  for (let i = 0; i < lyrics.value.length; i++) {
    if (time >= lyrics.value[i].time) {
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
    const activeLine = container.querySelector('.lyric-line.active')
    if (activeLine) {
      // 滚动使高亮行居中
      const containerHeight = container.clientHeight
      const offsetTop = activeLine.offsetTop
      const itemHeight = activeLine.clientHeight
      const scrollTop = offsetTop - (containerHeight / 2) + (itemHeight / 2)
      container.scrollTo({ top: scrollTop, behavior: 'smooth' })
    }
  })
}
</script>

<template>
  <div 
    class="lyrics-widget"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
  >
    <div class="lyrics-container" ref="lyricsContainerRef">
      <div v-if="lyrics.length === 0" class="no-lyrics">暂无歌词</div>
      <div 
        v-else 
        v-for="(line, index) in lyrics" 
        :key="index"
        class="lyric-line"
        :class="{ 
          active: index === currentIndex,
          'prev-1': index === currentIndex - 1,
          'next-1': index === currentIndex + 1
        }"
      >
        {{ line.text || ' ' }}
      </div>
    </div>
  </div>
</template>
