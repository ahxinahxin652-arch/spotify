<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()

const artistId = computed(() => route.params.id)
const artistInfo = ref({
  id: '',
  name: '加载中...',
  coverImg: '',
  metadata: {
    birthPlace: '',
    description: '',
    links: []
  }
})

// 编辑状态
const showEditDialog = ref(false)
const editName = ref('')
const editBirthPlace = ref('')
const editDescription = ref('')
const editLinks = ref('')
const editCoverImg = ref('')
const editLoading = ref(false)

const coverInputRef = ref(null)

// 歌曲模拟数据
const mockTracks = ref([
  { id: 'mock-1', title: '夜曲 (Nocturne)', album: '十一月的萧邦', duration: 226, playCount: '4.2M' },
  { id: 'mock-2', title: '晴天 (Sunny Day)', album: '叶惠美', duration: 269, playCount: '6.1M' },
  { id: 'mock-3', title: '七里香 (Common Jasmin Orange)', album: '七里香', duration: 283, playCount: '5.8M' },
  { id: 'mock-4', title: '青花瓷 (Blue and White Porcelain)', album: '我很忙', duration: 239, playCount: '3.9M' },
  { id: 'mock-5', title: '稻香 (Rice Field)', album: '魔杰座', duration: 283, playCount: '4.7M' }
])

onMounted(async () => {
  await loadArtistData()
})

watch(artistId, async () => {
  await loadArtistData()
})

const loadArtistData = async () => {
  if (!artistId.value) return
  try {
    const result = await window.electronAPI.getArtistById(artistId.value)
    if (result.success && result.data && result.data.artist) {
      const artist = result.data.artist
      artistInfo.value = {
        id: artist.id,
        name: artist.name,
        coverImg: artist.coverImg || '',
        metadata: artist.metadata ? JSON.parse(artist.metadata) : { birthPlace: '', description: '', links: [] }
      }
    } else {
      ElMessage.error('歌手加载失败: ' + (result.message || '未知错误'))
    }
  } catch (err) {
    console.error('加载歌手数据出错:', err)
    ElMessage.error('加载歌手数据出错')
  }
}

const goBack = () => {
  router.back()
}

const openEditDialog = () => {
  editName.value = artistInfo.value.name
  editBirthPlace.value = artistInfo.value.metadata.birthPlace || ''
  editDescription.value = artistInfo.value.metadata.description || ''
  editLinks.value = (artistInfo.value.metadata.links || []).join('\n')
  editCoverImg.value = artistInfo.value.coverImg || ''
  showEditDialog.value = true
}

const triggerCoverInput = () => {
  coverInputRef.value?.click()
}

const handleCoverUpload = async (e) => {
  const file = e.target.files[0]
  if (!file) return
  const ALLOWED_IMG_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp']
  if (!ALLOWED_IMG_TYPES.includes(file.type)) {
    ElMessage.error('不支持的图片格式，请选择 PNG/JPG/WEBP/GIF/BMP')
    return
  }
  try {
    const base64 = await resizeImage(file, 600)
    editCoverImg.value = base64
  } catch (err) {
    ElMessage.error('图片处理失败: ' + err.message)
  }
  e.target.value = ''
}

const resizeImage = (file, maxPx) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let targetW = img.width
        let targetH = img.height
        if (targetW > maxPx || targetH > maxPx) {
          if (targetW > targetH) {
            targetH = Math.round((targetH / targetW) * maxPx)
            targetW = maxPx
          } else {
            targetW = Math.round((targetW / targetH) * maxPx)
            targetH = maxPx
          }
        }
        canvas.width = targetW
        canvas.height = targetH
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, targetW, targetH)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = () => reject(new Error('图片加载错误'))
      img.src = ev.target.result
    }
    reader.onerror = () => reject(new Error('图片读取错误'))
    reader.readAsDataURL(file)
  })
}

const handleSaveEdit = async () => {
  const nameVal = editName.value.trim()
  if (!nameVal) {
    ElMessage.warning('歌手姓名不能为空')
    return
  }
  
  editLoading.value = true
  try {
    const linksArray = editLinks.value.split('\n').map(l => l.trim()).filter(Boolean)
    const updates = {
      name: nameVal,
      coverImg: editCoverImg.value || null,
      metadata: {
        birthPlace: editBirthPlace.value.trim(),
        description: editDescription.value.trim(),
        links: linksArray
      }
    }
    
    const result = await window.electronAPI.updateArtist(artistId.value, updates)
    if (result.success) {
      ElMessage.success('更新歌手信息成功')
      showEditDialog.value = false
      await loadArtistData()
    } else {
      ElMessage.error(result.message || '更新失败')
    }
  } catch (err) {
    ElMessage.error('更新发生错误: ' + err.message)
  } finally {
    editLoading.value = false
  }
}

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="artist-detail">
    <!-- 头部横幅区 -->
    <div class="artist-header">
      <button class="back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        返回
      </button>
      
      <div class="artist-profile">
        <div class="avatar-container" @click="openEditDialog">
          <img v-if="artistInfo.coverImg" :src="artistInfo.coverImg" class="artist-avatar" alt="avatar" />
          <div v-else class="avatar-placeholder">
            <span>{{ artistInfo.name ? artistInfo.name.charAt(0).toUpperCase() : '?' }}</span>
          </div>
          <div class="avatar-overlay">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </div>
        </div>
        
        <div class="artist-meta">
          <div class="artist-type">艺人 / 歌手</div>
          <h1 class="artist-name">{{ artistInfo.name }}</h1>
          
          <div class="artist-extra">
            <span v-if="artistInfo.metadata.birthPlace" class="meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              {{ artistInfo.metadata.birthPlace }}
            </span>
          </div>
          
          <p class="artist-desc">{{ artistInfo.metadata.description || '暂无歌手介绍。' }}</p>
          
          <div v-if="artistInfo.metadata.links && artistInfo.metadata.links.length > 0" class="artist-links">
            <a v-for="(link, i) in artistInfo.metadata.links" :key="i" :href="link" target="_blank" class="artist-link">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              {{ link.replace(/^https?:\/\/(www\.)?/, '') }}
            </a>
          </div>
        </div>
      </div>
      
      <div class="header-actions">
        <button class="edit-profile-btn" @click="openEditDialog">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          编辑资料
        </button>
      </div>
    </div>
    
    <!-- 内容展示区 -->
    <div class="artist-content">
      <div class="section-title">热门歌曲</div>
      
      <div class="tracks-list">
        <div class="list-header">
          <div class="col-num">#</div>
          <div class="col-title">标题</div>
          <div class="col-album">专辑</div>
          <div class="col-playcount">播放量</div>
          <div class="col-time">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
        </div>
        
        <div class="list-body">
          <div v-for="(track, index) in mockTracks" :key="track.id" class="track-row">
            <div class="col-num">{{ index + 1 }}</div>
            <div class="col-title">
              <div class="track-info-cell">
                <span class="track-name">{{ track.title }}</span>
              </div>
            </div>
            <div class="col-album">{{ track.album }}</div>
            <div class="col-playcount">{{ track.playCount }}</div>
            <div class="col-time">{{ formatDuration(track.duration) }}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 编辑歌手资料弹窗 -->
    <el-dialog
      v-model="showEditDialog"
      title="编辑歌手资料"
      width="460px"
      :close-on-click-modal="false"
      class="custom-dialog"
    >
      <div class="edit-dialog-content">
        <!-- 头像上传 -->
        <div class="edit-avatar-upload" @click="triggerCoverInput">
          <img v-if="editCoverImg" :src="editCoverImg" class="upload-avatar" alt="avatar" />
          <div v-else class="upload-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>点击上传头像</span>
          </div>
          <input
            type="file"
            ref="coverInputRef"
            style="display: none"
            accept="image/*"
            @change="handleCoverUpload"
          />
        </div>
        
        <!-- 表单 -->
        <div class="edit-form">
          <div class="form-item">
            <label>歌手姓名</label>
            <input type="text" v-model="editName" placeholder="输入歌手姓名" />
          </div>
          <div class="form-item">
            <label>出生地 / 国家</label>
            <input type="text" v-model="editBirthPlace" placeholder="例如：台湾台北 / 中国" />
          </div>
          <div class="form-item">
            <label>个人账号 / 链接 (每行一个)</label>
            <textarea v-model="editLinks" rows="3" placeholder="例如：https://instagram.com/jaychou"></textarea>
          </div>
          <div class="form-item">
            <label>歌手简介</label>
            <textarea v-model="editDescription" rows="4" placeholder="输入歌手的生平、主要成就或个人介绍..."></textarea>
          </div>
        </div>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <button class="cancel-btn" @click="showEditDialog = false" :disabled="editLoading">取消</button>
          <button class="save-btn" @click="handleSaveEdit" :disabled="editLoading">
            {{ editLoading ? '保存中...' : '保存' }}
          </button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.artist-detail {
  padding: 24px 32px;
  background: var(--bg);
  min-height: 100%;
  color: var(--text);
  font-family: var(--font);
  box-sizing: border-box;
}

/* 头部区 */
.artist-header {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 32px;
  border-bottom: 1px solid var(--border);
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 12px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  width: fit-content;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--surface-2);
  color: var(--text-h);
  border-color: var(--text);
}

.artist-profile {
  display: flex;
  gap: 28px;
  align-items: flex-start;
}

.avatar-container {
  position: relative;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--border);
  cursor: pointer;
  flex-shrink: 0;
}

.artist-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: 600;
  color: var(--accent);
}

.avatar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.avatar-container:hover .avatar-overlay {
  opacity: 1;
}

.avatar-container:hover .artist-avatar {
  transform: scale(1.05);
}

.artist-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.artist-type {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--accent);
  font-weight: 600;
}

.artist-name {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-h);
  margin: 0;
}

.artist-extra {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text);
  margin-top: 4px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.artist-desc {
  font-size: 13px;
  line-height: 1.6;
  margin: 10px 0 0 0;
  max-width: 680px;
  color: var(--text);
}

.artist-links {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.artist-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--accent);
  text-decoration: none;
  background: var(--accent-dim);
  padding: 4px 10px;
  border-radius: 20px;
  transition: opacity 0.2s;
}

.artist-link:hover {
  opacity: 0.8;
}

.edit-profile-btn {
  position: absolute;
  right: 0;
  bottom: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--accent);
  border: none;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  transition: background 0.2s;
}

.edit-profile-btn:hover {
  background: var(--accent-hover);
}

/* 内容展示区 */
.artist-content {
  padding-top: 28px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-h);
  margin-bottom: 16px;
}

/* 歌曲列表 */
.tracks-list {
  display: flex;
  flex-direction: column;
}

.list-header, .track-row {
  display: grid;
  grid-template-columns: 48px 1fr 1fr 120px 60px;
  align-items: center;
  padding: 10px 16px;
}

.list-header {
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;
  color: var(--text);
  opacity: 0.7;
}

.track-row {
  border-radius: 8px;
  margin-top: 4px;
  font-size: 13px;
  color: var(--text);
  transition: background 0.2s;
}

.track-row:hover {
  background: var(--surface);
  color: var(--text-h);
}

.col-num {
  text-align: center;
}

.col-time {
  text-align: right;
  padding-right: 8px;
}

.track-info-cell {
  display: flex;
  flex-direction: column;
}

.track-name {
  font-weight: 600;
  color: var(--text-h);
}

/* 弹窗样式定义 */
.edit-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 10px 0;
}

.edit-avatar-upload {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 2px dashed var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  margin: 0 auto;
  gap: 4px;
  transition: border-color 0.2s;
}

.edit-avatar-upload:hover {
  border-color: var(--accent);
}

.upload-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text);
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-item label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-h);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-item input, .form-item textarea {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-h);
  font-size: 13px;
  padding: 8px 12px;
  font-family: var(--font);
  transition: border-color 0.2s;
}

.form-item input:focus, .form-item textarea:focus {
  border-color: var(--accent);
  outline: none;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cancel-btn, .save-btn {
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
}

.cancel-btn:hover {
  background: var(--surface);
}

.save-btn {
  background: var(--accent);
  border: none;
  color: #fff;
}

.save-btn:hover {
  background: var(--accent-hover);
}

:deep(.el-dialog) {
  background: var(--surface-2) !important;
  border: 1px solid var(--border) !important;
  border-radius: 12px !important;
}

:deep(.el-dialog__title) {
  color: var(--text-h) !important;
  font-size: 15px !important;
  font-weight: 600 !important;
}

:deep(.el-dialog__body) {
  padding: 16px 20px !important;
}
</style>
