<script setup>
import { ref } from 'vue'
import { useLocalStorageStore } from '../stores/localStorage'

const localStorageStore = useLocalStorageStore()

const fileInputRef = ref(null)
const files = ref([])
const consoleLogs = ref([])
const isProcessing = ref(false)
const currentFileIndex = ref(-1)
const totalProgress = ref(0)
const fileProgress = ref(0)
const outputPath = ref(localStorageStore.musicUnlockOutput)
let logId = 0

function addLog(type, message) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  consoleLogs.value.push({ id: logId++, type, message, time })
}

async function handleFileInput(e) {
  const fileList = Array.from(e.target.files)
  const filePaths = fileList.map(f => f.path)
  addLog('info', `检测到 ${fileList.length} 个新文件，正在分析...`)

  const result = await window.electronAPI.scanDecryptFiles(filePaths)
  if (result.success) {
    const newFiles = result.files.filter(nf =>
        !files.value.some(ef => ef.path === nf.path)
    )
    files.value = [...files.value, ...newFiles]

    addLog('success', `扫描完成，新增 ${newFiles.length} 个文件，当前共 ${files.value.length} 个`)
  } else {
    addLog('error', `扫描失败: ${result.error}`)
  }
  e.target.value = ''
}

function handleDrop(e) {
  e.preventDefault()
  const fileList = Array.from(e.dataTransfer.files)
  const filePaths = fileList.map(f => f.path)
  addLog('info', `拖拽识别中...`)

  window.electronAPI.scanDecryptFiles(filePaths).then(result => {
    if (result.success) {
      const newFiles = result.files.filter(nf =>
          !files.value.some(ef => ef.path === nf.path)
      )
      files.value = [...files.value, ...newFiles]
      addLog('success', `添加完成`)
    }
  })
}

// 辅助函数：统一触发文件管理器
function openFilePicker() {
  if (isProcessing.value) return
  fileInputRef.value?.click()
}

async function selectOutputPath() {
  const path = await window.electronAPI.selectDirectory()
  if (path) {
    outputPath.value = path
    localStorageStore.setMusicUnlockOutput(path)
    addLog('info', `输出目录: ${path}`)
  }
}

async function startDecrypt() {
  if (files.value.length === 0) {
    addLog('warn', '没有可解密的文件')
    return
  }
  if (!outputPath.value) {
    addLog('warn', '请先选择输出目录')
    return
  }

  isProcessing.value = true
  totalProgress.value = 0
  fileProgress.value = 0
  currentFileIndex.value = 0
  addLog('info', `===== 开始解密 ${files.value.length} 个文件 =====`)

  const pureFiles = JSON.parse(JSON.stringify(files.value))

  const result = await window.electronAPI.startDecrypt({
    files: pureFiles,
    outputPath: outputPath.value,
  })

  if (!result.success) {
    addLog('error', `解密失败: ${result.error}`)
    isProcessing.value = false
    return
  }

  window.electronAPI.onDecryptProgress((data) => {
    if (data.type === 'file-progress') {
      fileProgress.value = data.progress
      totalProgress.value = data.totalProgress
      currentFileIndex.value = data.index
    } else if (data.type === 'file-done') {
      addLog('success', `完成: ${data.filename}`)
      fileProgress.value = 100
    } else if (data.type === 'all-done') {
      addLog('success', `===== 全部解密完成！共 ${data.total} 个文件 =====`)
      addLog('success', `输出目录: ${data.outputPath}`)
      isProcessing.value = false
      totalProgress.value = 100
    } else if (data.type === 'error') {
      addLog('error', `解密出错: ${data.error}`)
    }
  })
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

const progressPercent = () => Math.round(totalProgress.value)
const currentFileName = () => {
  if (currentFileIndex.value >= 0 && currentFileIndex.value < files.value.length) {
    return files.value[currentFileIndex.value].name
  }
  return ''
}
</script>

<template>
  <div class="converter-view">
    <!-- 左侧：上传/文件列表 -->
    <div class="panel panel-files">

      <div class="panel-header">
        <h2>待解密文件</h2>
        <div class="header-actions">
          <button class="btn btn-small" @click="files = []" :disabled="files.length === 0 || isProcessing">清空</button>
          <button class="btn btn-small" @click="openFilePicker" :disabled="isProcessing">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            添加文件
          </button>
          <input type="file" ref="fileInputRef" multiple accept=".kgm,.kgma,.vpr,.kgmm,.qmc0,.qmc3,.qmcflac,.qmcogg,.mflac,.mgg,.ncm,.kwm" style="display:none" @change="handleFileInput" />
        </div>
      </div>

      <!-- 使用 v-if，当列表有文件时，此区域彻底消失 -->
      <div
          v-if="files.length === 0"
          class="drop-zone-fullscreen"
          @dragover.prevent
          @drop="handleDrop"
          @click="openFilePicker"
      >
        <div class="drop-content">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p>点击或拖拽加密音乐文件到此处</p>
          <span class="drop-hint">支持: kgm, kgma, qmc0, qmc3, qmcflac, qmcogg, mflac, mgg, ncm, kwm</span>
        </div>
      </div>

      <!-- 文件列表：当有文件时占满剩余容器 -->
      <div class="file-list" v-else>
        <div v-for="(file, index) in files" :key="file.path" class="file-item" :class="{ active: index === currentFileIndex }">
          <div class="file-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
          <div class="file-info">
            <span class="file-name">{{ file.name }}</span>
            <span class="file-size">{{ formatSize(file.size) }}</span>
          </div>
          <button class="btn-remove" v-if="!isProcessing" @click.stop="files.splice(index, 1)">
            ×
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
        <div class="progress-row" v-if="isProcessing || totalProgress > 0">
          <div class="progress-info">
            <span>{{ isProcessing ? `正在解密: ${currentFileName()}` : '解密完成' }}</span>
            <span>{{ progressPercent() }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent() + '%' }"></div>
          </div>
          <div class="progress-detail">第 {{ currentFileIndex + 1 }} / {{ files.length }} 个文件</div>
        </div>
        <button
          class="btn btn-convert"
          @click="startDecrypt"
          :disabled="isProcessing || files.length === 0 || !outputPath"
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