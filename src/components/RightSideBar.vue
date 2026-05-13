<script setup>
import { usePlayerStore } from '../stores/player.js'
import { useLocalStorageStore } from '../stores/localStorage.js'
import { useSidebarStore } from '../stores/sidebar.js'

const player = usePlayerStore()
const localStorageStore = useLocalStorageStore()
const sidebarStore = useSidebarStore()

function closeSidebar() {
  sidebarStore.setOpen(false)
  localStorageStore.setRightBarShow(false)
}

// 格式化时间
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// 从文件名中提取歌名和作者（简单处理）
function parseTrackName(rawName) {
  const name = rawName || ''
  // 尝试用 " - " 分割歌名和作者
  const parts = name.split(' - ')
  if (parts.length >= 2) {
    return {
      title: parts.slice(0, -1).join(' - ').trim(),
      artist: parts[parts.length - 1].replace(/\.[^.]+$/, '').trim(),
    }
  }
  // 尝试用空格分割（取前两部分）
  const spaceParts = name.split(/\s+/)
  if (spaceParts.length >= 2) {
    return {
      title: spaceParts.slice(0, -1).join(' '),
      artist: spaceParts[spaceParts.length - 1].replace(/\.[^.]+$/, ''),
    }
  }
  return {
    title: name.replace(/\.[^.]+$/, ''),
    artist: '',
  }
}

const trackInfo = () => {
  if (!player.currentTrack) {
    return { title: '未播放', artist: '' }
  }
  return parseTrackName(player.currentTrack.name)
}
</script>

<template>
  <div class="right-sidebar">
    <!-- 头部：标题 + 关闭按钮 -->
    <div class="sidebar-header">
      <span class="sidebar-title">正在播放</span>
      <button class="btn-sidebar-close" @click="closeSidebar" title="关闭">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
    </div>

    <!-- 曲目详情 -->
    <div class="sidebar-content">
      <!-- 封面 -->
      <div class="album-art">
        <svg v-if="player.currentTrack" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
        <svg v-else width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
      </div>

      <!-- 曲目信息 -->
      <div class="track-detail-info">
        <span class="track-title" :class="{ empty: !player.currentTrack }">
          {{ trackInfo().title }}
        </span>
        <span class="track-artist" v-if="trackInfo().artist">
          {{ trackInfo().artist }}
        </span>
        <span class="track-artist empty" v-else-if="player.currentTrack">
          {{ player.currentTrack.warehouse || '未知来源' }}
        </span>
      </div>

      <!-- 进度条 -->
      <div class="sidebar-progress" v-if="player.currentTrack">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: (player.duration > 0 ? player.currentTime / player.duration * 100 : 0) + '%' }"
          ></div>
        </div>
        <div class="progress-time">
          <span>{{ formatTime(player.currentTime) }}</span>
          <span>{{ formatTime(player.duration) }}</span>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!player.currentTrack" class="sidebar-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
        <p>当前未播放任何曲目</p>
      </div>
    </div>
  </div>
</template>