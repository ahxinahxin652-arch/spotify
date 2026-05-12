<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePlayerStore } from '../stores/player.js'
import { useMusicLibraryStore } from '../stores/musicLibrary.js'

const router = useRouter()
const route = useRoute()
const player = usePlayerStore()
const library = useMusicLibraryStore()

const warehouseName = computed(() => decodeURIComponent(route.params.name))
const tracks = ref([])
const isLoading = ref(false)
const searchQuery = ref('')
const sortBy = ref('name') // 'name' | 'size' | 'modified'

onMounted(async () => {
  await loadTracks()
})

async function loadTracks() {
  isLoading.value = true
  try {
    const result = await window.electronAPI.getWarehouseTracks(warehouseName.value)
    if (result.success) {
      tracks.value = result.tracks
    }
  } catch (err) {
    console.error('加载曲目失败:', err)
  } finally {
    isLoading.value = false
  }
}

const filteredTracks = computed(() => {
  let list = [...tracks.value]
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(t => t.name.toLowerCase().includes(q))
  }
  if (sortBy.value === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sortBy.value === 'size') {
    list.sort((a, b) => b.size - a.size)
  } else if (sortBy.value === 'modified') {
    list.sort((a, b) => b.modified - a.modified)
  }
  return list
})

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function playTrack(track, index) {
  player.setPlaylist(filteredTracks.value, index)
  // 触发 FootBar 播放
  window.dispatchEvent(new CustomEvent('play-track', {
    detail: { track, playlist: filteredTracks.value, index }
  }))
}

function isCurrentTrack(track) {
  return player.currentTrack && player.currentTrack.path === track.path
}

async function handleFileDrop(e) {
  e.preventDefault()
  const files = Array.from(e.dataTransfer.files)
  const filePaths = files.map(f => f.path)
  const result = await window.electronAPI.importFilesToWarehouse(warehouseName.value, filePaths)
  if (result.success) {
    await loadTracks()
  }
}

async function handleAddFiles() {
  const filePaths = await window.electronAPI.selectMusicFiles()
  if (filePaths && filePaths.length > 0) {
    const result = await window.electronAPI.importFilesToWarehouse(warehouseName.value, filePaths)
    if (result.success) {
      await loadTracks()
    }
  }
}
</script>

<template>
  <div class="warehouse-view">
    <!-- 顶部：返回 & 搜索 -->
    <div class="warehouse-header">
      <button class="btn btn-back" @click="router.push('/')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        返回
      </button>
      <div class="warehouse-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
        <h1>{{ warehouseName }}</h1>
      </div>
      <div class="header-actions">
        <div class="search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input v-model="searchQuery" placeholder="搜索曲目..." />
        </div>
        <button class="btn btn-add" @click="handleAddFiles">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          添加曲目
        </button>
      </div>
    </div>

    <!-- 曲目列表 -->
    <div
      class="track-list-container"
      @drop="handleFileDrop"
      @dragover.prevent
    >
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>加载中...</span>
      </div>

      <div v-else-if="filteredTracks.length === 0" class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
        <p>{{ searchQuery ? '未找到匹配的曲目' : '此音乐库为空，拖拽文件到此处或点击"添加曲目"' }}</p>
      </div>

      <ul v-else class="track-list">
        <li
          v-for="(track, index) in filteredTracks"
          :key="track.path"
          class="track-item"
          :class="{ active: isCurrentTrack(track), playing: isCurrentTrack(track) && player.isPlaying }"
          @click="playTrack(track, index)"
        >
          <div class="track-icon">
            <svg v-if="!(isCurrentTrack(track) && player.isPlaying)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          <div class="track-info">
            <span class="track-name">{{ track.name }}</span>
            <span class="track-meta">{{ formatSize(track.size) }}</span>
          </div>
          <div class="track-duration">{{ track.duration ? formatTime(track.duration) : '' }}</div>
        </li>
      </ul>
    </div>
  </div>
</template>