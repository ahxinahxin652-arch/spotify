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



const trackInfo = () => {
  if (!player.currentTrack) {
    return { title: '未播放', artist: '' }
  }
  return {
    title: player.currentTrack.title || player.currentTrack.name,
    artist: player.currentTrack.artist || ''
  }
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
        <img v-if="player.currentTrack && player.currentTrack.cover" :src="player.currentTrack.cover" class="album-art-img" alt="" />
        <svg v-else-if="player.currentTrack" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
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