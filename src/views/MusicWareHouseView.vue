<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
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
const searchInputRef = ref(null)

function toggleSearch() {
  if (showSearch.value) {
    showSearch.value = false
    searchQuery.value = ''
  } else {
    showSearch.value = true
    nextTick(() => searchInputRef.value?.focus())
  }
}

function closeSearch() {
  showSearch.value = false
  searchQuery.value = ''
}

// ---- 编辑弹窗状态 ----
const showEditDialog = ref(false)
const editName = ref('')
const editDescription = ref('')
const editCoverBase64 = ref('')
const editLoading = ref(false)
const editCoverHover = ref(false)
const coverInputRef = ref(null)
const ALLOWED_IMG_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp']
const MIN_IMG_SIZE = 600
const MAX_IMG_SIZE = 3000
const COMPRESS_SIZE = 1000

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
  if (player.shuffle) {
    // 随机模式：随机选一首开始
    const list = [...filteredTracks.value]
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]]
    }
    player.setPlaylist(list, 0)
    window.dispatchEvent(new CustomEvent('play-track', {
      detail: { track: list[0], playlist: list, index: 0 }
    }))
  } else {
    // 顺序模式：从第一首开始
    playTrack(filteredTracks.value[0], 0)
  }
}

function toggleShuffleMode() {
  player.toggleShuffle()
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

// ========== 编辑弹窗 ==========
function openEditDialog() {
  editName.value = warehouseInfo.value.name || warehouseName.value
  editDescription.value = warehouseInfo.value.description || ''
  editCoverBase64.value = warehouseInfo.value.coverPath || ''
  editCoverHover.value = false
  showEditDialog.value = true
}

function triggerCoverInput() {
  coverInputRef.value?.click()
}

async function handleCoverUpload(e) {
  const file = e.target.files[0]
  if (!file) return
  if (!ALLOWED_IMG_TYPES.includes(file.type)) {
    ElMessage.error('不支持的图片格式，请选择 PNG/JPG/WEBP/GIF/BMP')
    e.target.value = ''
    return
  }
  try {
    const base64 = await resizeImage(file, COMPRESS_SIZE)
    editCoverBase64.value = base64
  } catch (err) {
    ElMessage.error(err.message || '图片处理失败')
  }
  e.target.value = ''
}

function removeCover() {
  editCoverBase64.value = ''
}

function resizeImage(file, maxPx) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const { width, height } = img
        if (width < MIN_IMG_SIZE || height < MIN_IMG_SIZE) {
          ElMessage.warning(`图片分辨率过小，最小 ${MIN_IMG_SIZE}px x ${MIN_IMG_SIZE}px`)
          reject(new Error('图片分辨率过小'))
          return
        }
        let targetW = width
        let targetH = height
        if (targetW > MAX_IMG_SIZE || targetH > MAX_IMG_SIZE) {
          if (targetW > targetH) {
            targetH = Math.round((targetH / targetW) * MAX_IMG_SIZE)
            targetW = MAX_IMG_SIZE
          } else {
            targetW = Math.round((targetW / targetH) * MAX_IMG_SIZE)
            targetH = MAX_IMG_SIZE
          }
        } else if (targetW > maxPx || targetH > maxPx) {
          if (targetW > targetH) {
            targetH = Math.round((targetH / targetW) * maxPx)
            targetW = maxPx
          } else {
            targetW = Math.round((targetW / targetH) * maxPx)
            targetH = maxPx
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = targetW
        canvas.height = targetH
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, targetW, targetH)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = () => reject(new Error('无法加载图片'))
      img.src = ev.target.result
    }
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

async function handleSaveEdit() {
  const newName = editName.value.trim()
  if (!newName) {
    ElMessage.warning('音乐库名称不能为空')
    return
  }
  if (newName.length > 30) {
    ElMessage.warning('音乐库名称不能超过 30 个字符')
    return
  }
  if (editDescription.value.length > 100) {
    ElMessage.warning('描述不能超过 100 个字符')
    return
  }
  editLoading.value = true

  const currentName = warehouseInfo.value.name || warehouseName.value
  const updates = {}
  if (newName !== currentName) updates.name = newName
  if ((editDescription.value.trim() || '') !== (warehouseInfo.value.description || '')) {
    updates.description = editDescription.value.trim()
  }
  if (editCoverBase64.value !== (warehouseInfo.value.coverPath || '')) {
    updates.coverPath = editCoverBase64.value
  }

  if (Object.keys(updates).length === 0) {
    showEditDialog.value = false
    editLoading.value = false
    return
  }

  const result = await library.updateWarehouse(currentName, updates)
  editLoading.value = false

  if (result.success) {
    showEditDialog.value = false
    ElMessage.success('保存成功')
    // 如果改名，需要跳转到新路由
    if (updates.name) {
      router.replace(`/warehouse/${encodeURIComponent(updates.name)}`)
    }
    // 重新加载数据
    await loadTracks()
    await library.loadWarehouses()
  } else {
    ElMessage.error(result.error || '保存失败')
  }
}
</script>

<template>
  <div class="warehouse-view">
    <!-- Spotify 风格 Hero 头部 -->
    <div class="warehouse-hero">
      <div class="hero-top-bar">
        <button class="btn btn-back" @click="router.push('/')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      </div>
      <div class="hero-content">
        <div class="hero-cover" @click="openEditDialog" title="点击编辑封面">
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
          <h1 class="hero-title" @click="openEditDialog" title="点击编辑">{{ warehouseInfo.name || warehouseName }}</h1>
          <p
            v-if="warehouseInfo.description"
            class="hero-description"
            @click="openEditDialog"
            title="点击编辑"
          >{{ warehouseInfo.description }}</p>
          <div class="hero-meta">
            <span class="meta-item">{{ tracks.length }} 首曲目</span>
            <span v-if="totalDuration" class="meta-separator">&middot;</span>
            <span v-if="totalDuration" class="meta-item">{{ totalDuration }}</span>
          </div>
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
          @click="toggleShuffleMode"
          :disabled="filteredTracks.length === 0"
          title="随机播放模式"
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
        <div class="search-inline" :class="{ expanded: showSearch }">
          <div v-if="showSearch" class="search-inline-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              placeholder="搜索曲目..."
              @keydown.escape="closeSearch"
            />
            <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <button
            class="action-btn"
            :class="{ active: showSearch }"
            @click="toggleSearch"
            title="搜索"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
        </div>
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

    <!-- 编辑音乐库对话框 -->
    <div v-if="showEditDialog" class="dialog-overlay" @click.self="showEditDialog = false">
      <div class="dialog edit-dialog" @click.stop>
        <h3 class="dialog-title">编辑音乐库</h3>
        <input
          ref="coverInputRef"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
          @change="handleCoverUpload"
          style="display: none"
        />
        <div class="edit-body">
          <div
            class="edit-cover-area"
            @click="triggerCoverInput"
            @mouseenter="editCoverHover = true"
            @mouseleave="editCoverHover = false"
          >
            <img v-if="editCoverBase64" :src="editCoverBase64" class="edit-cover-img" alt="" />
            <div v-else class="edit-cover-empty">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
              <span class="cover-add-text">选择图片</span>
            </div>
            <div v-if="editCoverBase64 && editCoverHover" class="edit-cover-overlay">
              <button class="cover-remove-btn" @click.stop="removeCover" title="移除封面">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
              <span class="cover-change-text">更换图片</span>
            </div>
          </div>
          <div class="edit-fields">
            <input
              v-model="editName"
              class="dialog-input edit-input"
              placeholder="音乐库名称"
              maxlength="30"
            />
            <input
              v-model="editDescription"
              class="dialog-input edit-input"
              placeholder="描述（可选）"
              maxlength="100"
            />
          </div>
        </div>
        <div class="edit-footer">
          <button class="btn btn-primary" @click="handleSaveEdit" :disabled="editLoading">
            {{ editLoading ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
