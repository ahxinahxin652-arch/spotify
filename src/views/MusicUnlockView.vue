<script setup>
import { ref } from 'vue'

const DECRYPTABLE_EXTS = [
  '.kgm', '.kgma', '.vpr', '.kgmm',      // 酷狗
  '.qmc0', '.qmc3', '.qmcflac', '.qmcogg', '.mflac', '.mgg', // QQ音乐
  '.ncm',                                    // 网易云
  '.kwm'                                    // 酷我
]

const isDragging = ref(false)
const files = ref([])              // 待解密文件列表
const consoleLogs = ref([])
const isProcessing = ref(false)
const currentFileIndex = ref(-1)
const currentProgress = ref(0)
const outputPath = ref('')
let logId = 0

function addLog(type, message) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  consoleLogs.value.push({ id: logId++, type, message, time })
}

function handleDragOver(e) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave(e) {
  e.preventDefault()
  isDragging.value = false
}

function handleDrop(e) {
  e.preventDefault()
  isDragging.value = false
  const fileList = Array.from(e.dataTransfer.files)
  addFiles(fileList)
}

function handleFileInput(e) {
  const fileList = Array.from(e.target.files)
  addFiles(fileList)
  e.target.value = ''
}

function addFiles(fileList) {
  let added = 0
  for (const file of fileList) {
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (DECRYPTABLE_EXTS.includes(ext)) {
      // 检查是否已存在
      if (!files.value.find(f => f.path === file.path)) {
        files.value.push({
          name: file.name,
          path: file.path,
          size: file.size,
          status: 'pending', // pending | decrypting | done | error
          outputPath: '',
          error: '',
        })
        added++
      }
    }
  }
  addLog('info', `添加了 ${added} 个可解密文件（${fileList.length - added} 个跳过）`)
}

function removeFile(index) {
  files.value.splice(index, 1)
}

function clearFiles() {
  files.value = []
  addLog('info', '已清空文件列表')
}

async function selectOutputPath() {
  const path = await window.electronAPI.selectDirectory()
  if (path) {
    outputPath.value = path
    addLog('info', `输出目录: ${path}`)
  }
}

async function startDecrypt() {
  if (files.value.length === 0) {
    addLog('warn', '没有可解密的文件')
    return
  }
  if (!outputPath.value) {
    // 默认使用音乐库目录
    outputPath.value = await window.electronAPI.getMusicWarehouseDir()
    if (!outputPath.value) {
      addLog('warn', '请选择输出目录')
      return
    }
  }

  isProcessing.value = true
  addLog('info', `===== 开始解密 ${files.value.length} 个文件 =====`)

  for (let i = 0; i < files.value.length; i++) {
    const file = files.value[i]
    file.status = 'decrypting'
    currentFileIndex.value = i
    currentProgress.value = 0

    try {
      const result = await window.electronAPI.decryptFile({
        inputPath: file.path,
        outputPath: outputPath.value,
        outputFormat: 'mp3',
      })

      if (result.success) {
        file.status = 'done'
        file.outputPath = result.outputPath
        addLog('success', `解密完成: ${file.name} → ${result.outputFileName}`)
      } else {
        file.status = 'error'
        file.error = result.error
        addLog('error', `解密失败: ${file.name} - ${result.error}`)
      }
    } catch (err) {
      file.status = 'error'
      file.error = err.message
      addLog('error', `解密出错: ${file.name} - ${err.message}`)
    }
  }

  isProcessing.value = false
  addLog('success', `===== 解密完成 =====`)
  currentFileIndex.value = -1
}

function getStatusIcon(status) {
  const map = {
    pending: { color: 'var(--text)', label: '等待' },
    decrypting: { color: 'var(--accent)', label: '解密中' },
    done: { color: 'var(--success)', label: '完成' },
    error: { color: 'var(--error)', label: '失败' },
  }
  return map[status] || map.pending
}

const doneCount = () => files.value.filter(f => f.status === 'done').length
const totalCount = () => files.value.length

function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}
</script>

<template>
  <div class="unlock-view">
    <!-- 左侧：文件列表 -->
    <div class="panel panel-files">
      <div class="panel-header">
        <h2>待解密文件</h2>
        <div class="header-actions">
          <button class="btn btn-small" @click="clearFiles" :disabled="files.length === 0 || isProcessing">清空</button>
          <label class="btn btn-small" :class="{ disabled: isProcessing }">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            添加文件
            <input type="file" multiple accept=".kgm,.kgma,.vpr,.kgmm,.qmc0,.qmc3,.qmcflac,.qmcogg,.mflac,.mgg,.ncm,.kwm" style="display:none" @change="handleFileInput" />
          </label>
        </div>
      </div>

      <!-- 拖拽区 -->
      <div
        class="drop-zone"
        :class="{ dragging: isDragging }"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p>拖拽加密音乐文件到此处</p>
        <p class="drop-hint">支持: kgm, kgma, qmc0, qmc3, qmcflac, qmcogg, mflac, mgg, ncm, kwm</p>
      </div>

      <!-- 文件列表 -->
      <div class="file-list" v-if="files.length > 0">
        <div v-for="(file, index) in files" :key="file.path" class="file-item" :class="{ active: index === currentFileIndex }">
          <div class="file-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div class="file-info">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-meta">
              <span class="file-size">{{ formatSize(file.size) }}</span>
              <span class="file-status" :style="{ color: getStatusIcon(file.status).color }">
                {{ getStatusIcon(file.status).label }}
              </span>
            </span>
          </div>
          <button class="btn-remove" @click="removeFile(index)" :disabled="isProcessing">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- 右侧：控制台 -->
    <div class="panel panel-console">
      <div class="panel-header">
        <h2>解密日志</h2>
        <button class="btn btn-small" @click="consoleLogs = []" :disabled="isProcessing">清空</button>
      </div>
      <div class="console-log">
        <div v-for="log in consoleLogs" :key="log.id" class="log-line" :class="'log-' + log.type">
          <span class="log-time">[{{ log.time }}]</span>
          <span class="log-msg">{{ log.message }}</span>
        </div>
        <div v-if="consoleLogs.length === 0" class="log-empty">解密过程将显示在此...</div>
      </div>

      <!-- 底部操作 -->
      <div class="action-bar">
        <div class="output-path-row">
          <label class="toolbar-label">输出目录：</label>
          <div class="path-display" :title="outputPath || '未选择'">
            {{ outputPath || '点击右侧按钮选择' }}
          </div>
          <button class="btn btn-small" @click="selectOutputPath" :disabled="isProcessing">选择</button>
        </div>
        <div class="progress-row" v-if="isProcessing">
          <div class="progress-info">
            <span>{{ doneCount() }} / {{ totalCount() }} 已完成</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: (doneCount() / totalCount() * 100) + '%' }"></div>
          </div>
        </div>
        <button
          class="btn btn-convert"
          @click="startDecrypt"
          :disabled="isProcessing || files.length === 0"
        >
          <svg v-if="!isProcessing" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span v-if="isProcessing" class="spinner"></span>
          {{ isProcessing ? '解密中...' : '开始解密' }}
        </button>
      </div>
    </div>
  </div>
</template>