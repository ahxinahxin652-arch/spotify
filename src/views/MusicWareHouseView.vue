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
const warehouseInfo = ref({ name: '', description: '', coverPath: '' })
const tracks = ref([])
const isLoading = ref(false)
const searchQuery = ref('')
const sortBy = ref('name') // 'name' | 'size' | 'modified'
const showSearch = ref(false)

onMounted(async () => {
  await loadTracks()
})

async function loadTracks() {
  isLoading.value = true
  try {
    const result = await window.electronAPI.getWarehouseTracks(warehouseName.value)
    if (result.success && result.data) {
      tracks.value = result.data.tracks
      if (result.data.warehouse) {
        warehouseInfo.value = result.data.warehouse
        console.log('[Warehouse] coverPath:', warehouseInfo.value.coverPath?.substring(0, 50))
      }
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

const totalDuration = computed(() => {
  const total = tracks.value.reduce((sum, t) => sum + (t.duration || 0), 0)
  if (total <= 0) return ''
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours > 0) return `约 ${hours} 小时 ${minutes} 分钟`
  return `约 ${minutes} 分钟`
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
  window.dispatchEvent(new CustomEvent('play-track', {
    detail: { track, playlist: filteredTracks.value, index }
  }))
}

function playAll() {
  if (filteredTracks.value.length === 0) return
  playTrack(filteredTracks.value[0], 0)
}

function shuffleAll() {
  if (filteredTracks.value.length === 0) return
  const list = [...filteredTracks.value]
  // Fisher-Yates shuffle
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]]
  }
  player.setPlaylist(list, 0)
  if (!player.shuffle) player.toggleShuffle()
  window.dispatchEvent(new CustomEvent('play-track', {
    detail: { track: list[0], playlist: list, index: 0 }
  }))
}

function isCurrentTrack(track) {
  return player.currentTrack && player.currentTrack.path === track.path
}

// 判断当前是否正在播放该仓库的音乐
const isWarehousePlaying = computed(() => {
  if (!player.isPlaying || !player.currentTrack) return false
  return tracks.value.some(t => t.path === player.currentTrack.path)
})

function toggleWarehousePlay() {
  if (isWarehousePlaying.value) {
    // 暂停 - 通过 FootBar 处理
    window.dispatchEvent(new CustomEvent('play-track', {
      detail: { track: player.currentTrack, playlist: player.currentPlaylist, index: player.currentIndex }
    }))
    return
  }
  playAll()
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
    <!-- Spotify 风格 Hero 头部 -->
    <div class="warehouse-hero">
      <div class="hero-cover">
        <img
          v-if="warehouseInfo.coverPath"
          :src="warehouseInfo.coverPath"
          class="hero-cover-img"
          alt=""
        />
        <div v-else class="hero-cover-placeholder">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
      </div>
      <div class="hero-info">
        <span class="hero-type">音乐库</span>
        <h1 class="hero-title">{{ warehouseInfo.name || warehouseName }}</h1>
        <p v-if="warehouseInfo.description" class="hero-description">{{ warehouseInfo.description }}</p>
        <div class="hero-meta">
          <span class="meta-item">{{ tracks.length }} 首曲目</span>
          <span v-if="totalDuration" class="meta-separator">&middot;</span>
          <span v-if="totalDuration" class="meta-item">{{ totalDuration }}</span>
        </div>
      </div>
    </div>

    <!-- 操作栏：播放按钮 + 工具按钮 -->
    <div class="warehouse-actions">
      <div class="actions-left">
        <button class="play-btn-large" @click="playAll" :disabled="filteredTracks.length === 0" title="播放全部">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </button>
        <button
          class="action-btn shuffle-btn"
          :class="{ active: player.shuffle }"
          @click="shuffleAll"
          :disabled="filteredTracks.length === 0"
          title="随机播放"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="16 3 21 3 21 8"/>
            <line x1="4" y1="20" x2="21" y2="3"/>
            <polyline points="21 16 21 21 16 21"/>
            <line x1="15" y1="15" x2="21" y2="21"/>
            <line x1="4" y1="4" x2="9" y2="9"/>
          </svg>
        </button>
      </div>
      <div class="actions-right">
        <button
          class="action-btn"
          :class="{ active: showSearch }"
          @click="showSearch = !showSearch"
          title="搜索"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
        <select v-model="sortBy" class="sort-select">
          <option value="name">按名称</option>
          <option value="size">按大小</option>
          <option value="modified">按修改时间</option>
        </select>
        <button class="btn btn-add" @click="handleAddFiles">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          添加曲目
        </button>
        <button class="btn btn-back" @click="router.push('/')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          返回
        </button>
      </div>
    </div>

    <!-- 搜索栏（可折叠） -->
    <Transition name="slide-down">
      <div v-if="showSearch" class="search-bar">
        <div class="search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input v-model="searchQuery" placeholder="搜索曲目..." autofocus />
          <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    </Transition>

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

      <div v-else class="track-list-wrapper">
        <!-- 曲目表头 -->
        <div class="track-header">
          <span class="th-num">#</span>
          <span class="th-title">标题</span>
          <span class="th-size">大小</span>
          <span class="th-duration">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </span>
        </div>
        <ul class="track-list">
          <li
            v-for="(track, index) in filteredTracks"
            :key="track.path"
            class="track-item"
            :class="{ active: isCurrentTrack(track), playing: isCurrentTrack(track) && player.isPlaying }"
            @click="playTrack(track, index)"
          >
            <div class="track-num">
              <span class="num-text">{{ index + 1 }}</span>
              <svg class="num-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
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
  </div>
</template>
