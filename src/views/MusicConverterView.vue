<script setup>
import { ref } from 'vue'

const flacFiles = ref([])
const consoleLogs = ref([])
const isConverting = ref(false)
const convertingFileIndex = ref(-1)
const totalProgress = ref(0)
const fileProgress = ref(0)
const outputPath = ref('')
let logId = 0

function addLog(type, message) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  consoleLogs.value.push({ id: logId++, type, message, time })
}

async function handleFileInput(e) {
  const fileList = Array.from(e.target.files)
  const filePaths = fileList.map(f => f.path)
  addLog('info', `检测到 ${fileList.length} 个文件，正在分析...`)
  const result = await window.electronAPI.scanFiles(filePaths)
  if (result.success) {
    flacFiles.value = result.files
    addLog('success', `扫描完成，共发现 ${result.files.length} 个 FLAC 文件`)
    if (result.files.length > 0 && !outputPath.value) {
      const dir = result.files[0].path.substring(0, result.files[0].path.lastIndexOf('\\'))
      outputPath.value = dir
      addLog('info', `自动设置输出目录: ${dir}`)
    }
  } else {
    addLog('error', `扫描失败: ${result.error}`)
  }
  e.target.value = ''
}

function handleDrop(e) {
  e.preventDefault()
  const fileList = Array.from(e.dataTransfer.files)
  const filePaths = fileList.map(f => f.path)
  addLog('info', `检测到 ${fileList.length} 个文件，正在分析...`)
  window.electronAPI.scanFiles(filePaths).then(result => {
    if (result.success) {
      flacFiles.value = result.files
      addLog('success', `扫描完成，共发现 ${result.files.length} 个 FLAC 文件`)
    } else {
      addLog('error', `扫描失败: ${result.error}`)
    }
  })
}

async function selectOutputPath() {
  const path = await window.electronAPI.selectDirectory()
  if (path) {
    outputPath.value = path
    addLog('info', `输出目录: ${path}`)
  }
}

async function startConvert() {
  if (flacFiles.value.length === 0) {
    addLog('warn', '没有可转换的文件')
    return
  }
  if (!outputPath.value) {
    addLog('warn', '请先选择输出目录')
    return
  }

  isConverting.value = true
  totalProgress.value = 0
  fileProgress.value = 0
  convertingFileIndex.value = 0
  addLog('info', `===== 开始转换 ${flacFiles.value.length} 个文件 =====`)

  const result = await window.electronAPI.startConvert({
    files: flacFiles.value,
    outputPath: outputPath.value,
  })

  if (!result.success) {
    addLog('error', `转换失败: ${result.error}`)
    isConverting.value = false
    return
  }

  window.electronAPI.onConvertProgress((data) => {
    if (data.type === 'file-progress') {
      fileProgress.value = data.progress
      totalProgress.value = data.totalProgress
      convertingFileIndex.value = data.index
    } else if (data.type === 'file-done') {
      addLog('success', `完成: ${data.filename}`)
      fileProgress.value = 100
    } else if (data.type === 'all-done') {
      addLog('success', `===== 全部转换完成！共 ${data.total} 个文件 =====`)
      addLog('success', `输出目录: ${data.outputPath}`)
      isConverting.value = false
      totalProgress.value = 100
    } else if (data.type === 'error') {
      addLog('error', `转换出错: ${data.error}`)
    }
  })
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

const progressPercent = () => Math.round(totalProgress.value)
const currentFileName = () => {
  if (convertingFileIndex.value >= 0 && convertingFileIndex.value < flacFiles.value.length) {
    return flacFiles.value[convertingFileIndex.value].name
  }
  return ''
}
</script>

<template>
  <div class="converter-view">
    <!-- 左侧：上传/文件列表 -->
    <div class="panel panel-files">
      <div class="panel-header">
        <h2>FLAC 文件</h2>
        <div class="header-actions">
          <button class="btn btn-small" @click="flacFiles = []" :disabled="flacFiles.length === 0 || isConverting">清空</button>
          <label class="btn btn-small">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            选择文件
            <input type="file" multiple accept=".flac" style="display:none" @change="handleFileInput" />
          </label>
        </div>
      </div>

      <!-- 拖拽区 -->
      <div
        class="drop-zone"
        @dragover.prevent
        @drop="handleDrop"
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p>拖拽 FLAC 文件到此处</p>
        <p class="drop-hint">支持拖拽文件和文件夹，将自动扫描所有 FLAC</p>
      </div>

      <!-- 文件列表 -->
      <div class="file-list" v-if="flacFiles.length > 0">
        <div v-for="(file, index) in flacFiles" :key="file.path" class="file-item" :class="{ active: index === convertingFileIndex }">
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
        </div>
      </div>
    </div>

    <!-- 右侧：控制台 -->
    <div class="panel panel-console">
      <div class="panel-header">
        <h2>转换日志</h2>
        <button class="btn btn-small" @click="consoleLogs = []" :disabled="isConverting">清空</button>
      </div>
      <div class="console-log">
        <div v-for="log in consoleLogs" :key="log.id" class="log-line" :class="'log-' + log.type">
          <span class="log-time">[{{ log.time }}]</span>
          <span class="log-msg">{{ log.message }}</span>
        </div>
        <div v-if="consoleLogs.length === 0" class="log-empty">转换过程将显示在此...</div>
      </div>

      <!-- 底部操作 -->
      <div class="action-bar">
        <div class="output-path-row">
          <label class="toolbar-label">输出目录：</label>
          <div class="path-display" :title="outputPath || '未选择'">
            {{ outputPath || '点击右侧按钮选择' }}
          </div>
          <button class="btn btn-small" @click="selectOutputPath" :disabled="isConverting">选择</button>
        </div>
        <div class="progress-row" v-if="isConverting || totalProgress > 0">
          <div class="progress-info">
            <span>{{ isConverting ? `正在转换: ${currentFileName()}` : '转换完成' }}</span>
            <span>{{ progressPercent() }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent() + '%' }"></div>
          </div>
          <div class="progress-detail">第 {{ convertingFileIndex + 1 }} / {{ flacFiles.length }} 个文件</div>
        </div>
        <button
          class="btn btn-convert"
          @click="startConvert"
          :disabled="isConverting || flacFiles.length === 0 || !outputPath"
        >
          <svg v-if="!isConverting" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span v-if="isConverting" class="spinner"></span>
          {{ isConverting ? '转换中...' : '开始转换' }}
        </button>
      </div>
    </div>
  </div>
</template>