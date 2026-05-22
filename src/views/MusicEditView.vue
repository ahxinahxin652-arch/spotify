<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import '../styles/musicEditView.css'

const router = useRouter()
const route = useRoute()

// --- State ---
const filePath = ref('')
const isLoaded = ref(false)
const isLoading = ref(false)
const isSaving = ref(false)

const coverBase64 = ref('')
const coverChanged = ref(false) // 追踪用户是否修改了封面
const coverHover = ref(false)
const coverInputRef = ref(null)

const metaForm = ref({
  title: '',
  artist: '',
  album: '',
  albumArtist: '',
  genre: '',
  year: '',
  trackNumber: '',
  totalTracks: '',
  discNumber: '',
  totalDiscs: '',
  comment: ''
})

const ALLOWED_IMG_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp']
const COMPRESS_SIZE = 1000

// --- Methods ---

onMounted(() => {
  if (route.query.path) {
    loadFile(route.query.path)
  }
})

async function handleSelectFile() {
  const paths = await window.electronAPI.selectMusicFiles()
  if (paths && paths.length > 0) {
    loadFile(paths[0])
  }
}

async function loadFile(path) {
  if (!path) return
  isLoading.value = true
  filePath.value = path
  
  try {
    // 调用后端读取元数据
    const result = await window.electronAPI.getFileMetadata(path)
    if (result.success) {
      const data = result.data
      metaForm.value = {
        title: data.title || '',
        artist: data.artist || '',
        album: data.album || '',
        albumArtist: data.albumArtist || '',
        genre: data.genre || '',
        year: data.year || '',
        trackNumber: data.trackNumber || '',
        totalTracks: data.totalTracks || '',
        discNumber: data.discNumber || '',
        totalDiscs: data.totalDiscs || '',
        comment: data.comment || ''
      }
      coverBase64.value = data.cover || ''
      coverChanged.value = false
      isLoaded.value = true
    } else {
      ElMessage.error(result.error || '读取失败')
    }
  } catch (err) {
    ElMessage.error('读取元数据失败')
    console.error(err)
  } finally {
    isLoading.value = false
  }
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
    coverBase64.value = base64
    coverChanged.value = true
  } catch (err) {
    ElMessage.error(err.message || '图片处理失败')
  }
  e.target.value = ''
}

function removeCover() {
  coverBase64.value = ''
  coverChanged.value = true
}

function resizeImage(file, maxPx) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const { width, height } = img
        let targetW = width
        let targetH = height
        if (targetW > maxPx || targetH > maxPx) {
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

async function saveMetadata() {
  if (!filePath.value) return
  isSaving.value = true
  
  try {
    const payload = {
      path: filePath.value,
      ...metaForm.value
    }
    // 仅在用户修改了封面时才传递 coverBase64
    if (coverChanged.value) {
      payload.coverBase64 = coverBase64.value
    }
    const result = await window.electronAPI.updateFileMetadata(payload)
    if (result.success) {
      ElMessage.success('保存成功')
    } else {
      ElMessage.error(result.error || '保存失败')
    }
  } catch (err) {
    ElMessage.error('保存失败')
    console.error(err)
  } finally {
    isSaving.value = false
  }
}
function handleChangeFile() {
  handleSelectFile()
}
</script>

<template>
  <div class="edit-view">
    <!-- 未加载文件时显示上传区域 -->
    <div v-if="!isLoaded" class="upload-container">
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <span>读取文件中...</span>
      </div>
      <div v-else class="upload-box" @click="handleSelectFile">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 16px;">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p>点击选择音乐文件 (FLAC, MP3, M4A)</p>
      </div>
    </div>

    <!-- 加载后的编辑区域 -->
    <div v-else class="edit-container">
      <!-- 左侧区域：封面 & 控制 -->
      <div class="panel edit-left">
        <div class="panel-header">
          <h2>Album Cover</h2>
        </div>
        <div class="cover-edit-area">
          <input
            ref="coverInputRef"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
            @change="handleCoverUpload"
            style="display: none"
          />
          <div class="cover-wrapper" @click="triggerCoverInput" @mouseenter="coverHover = true" @mouseleave="coverHover = false">
            <img v-if="coverBase64" :src="coverBase64" class="cover-img"  alt="cover"/>
            <div v-else class="cover-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
            </div>
            
            <div v-if="coverBase64 && coverHover" class="cover-overlay">
              <button class="cover-remove-btn" @click.stop="removeCover" title="移除封面">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
              <span>更换封面</span>
            </div>
          </div>
          <div class="action-buttons">
            <button class="btn-primary-large" @click="saveMetadata" :disabled="isSaving">
              {{ isSaving ? 'Saving...' : 'Save File' }}
            </button>
            <button class="btn-dark" @click="handleChangeFile">
              Change File
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧表单区域 -->
      <div class="panel edit-right">
        <div class="panel-header">
          <h2>Metadata Editor</h2>
        </div>
        <div class="form-container">
          <div class="form-grid">
            <div class="form-row">
              <label class="form-label">Title</label>
              <input v-model="metaForm.title" class="form-input" placeholder="Title" />
            </div>
            <div class="form-row">
              <label class="form-label">Artist</label>
              <input v-model="metaForm.artist" class="form-input" placeholder="Artist" />
            </div>
            <div class="form-row">
              <label class="form-label">Album</label>
              <input v-model="metaForm.album" class="form-input" placeholder="Album" />
            </div>
            <div class="form-row">
              <label class="form-label">Album Artist</label>
              <input v-model="metaForm.albumArtist" class="form-input" placeholder="Album artist" />
            </div>
            <div class="form-row">
              <label class="form-label">Genre</label>
              <input v-model="metaForm.genre" class="form-input" placeholder="Genre" />
            </div>
            <div class="form-row">
              <label class="form-label">Year</label>
              <input v-model="metaForm.year" class="form-input" placeholder="YYYY or YYYY-MM-DD" />
            </div>
            
            <div class="form-row split-row">
              <div class="split-col">
                <label class="form-label">Track Number</label>
                <input v-model="metaForm.trackNumber" type="number" class="form-input" placeholder="1" />
              </div>
              <div class="split-col">
                <label class="form-label">Total Tracks</label>
                <input v-model="metaForm.totalTracks" type="number" class="form-input" placeholder="12" />
              </div>
            </div>
            
            <div class="form-row split-row">
              <div class="split-col">
                <label class="form-label">Disc Number</label>
                <input v-model="metaForm.discNumber" type="number" class="form-input" placeholder="1" />
              </div>
              <div class="split-col">
                <label class="form-label">Total Discs</label>
                <input v-model="metaForm.totalDiscs" type="number" class="form-input" placeholder="1" />
              </div>
            </div>
            
            <div class="form-row">
              <label class="form-label">Comment</label>
              <input v-model="metaForm.comment" class="form-input" placeholder="Notes or comments" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


