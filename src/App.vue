<script setup>
import { ref, computed, onMounted, watch } from 'vue'

// ============ 状态 ============
const flacFiles = ref([])             // 文件列表
const consoleLogs = ref([])           // 控制台日志
const isDragging = ref(false)         // 拖拽状态
const isConverting = ref(false)       // 转换中
const convertingFileIndex = ref(-1)   // 当前转换的文件索引
const totalProgress = ref(0)          // 总进度 0-100
const fileProgress = ref(0)           // 单文件进度 0-100
const downloadPath = ref('')          // 下载目录
const isUploading = ref(false)        // 上传中

// ============ localStorage 持久化 ============
const STORAGE_KEY = 'flac-converter-download-path'

onMounted(() => {
  // 启动时从 localStorage 读取上次保存的输出目录
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    downloadPath.value = saved
    addLog('info', `已加载上次的输出目录: ${saved}`)
  }
})

// 监听输出目录变化，自动保存到 localStorage
watch(downloadPath, (newPath) => {
  if (newPath) {
    localStorage.setItem(STORAGE_KEY, newPath)
  }
})

// ============ 日志工具 ============
let logId = 0
function addLog(type, message) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  consoleLogs.value.push({ id: logId++, type, message, time })
}

// ============ 上传区域 ============
const uploadArea = ref(null)
const fileInputRef = ref(null)

function handleDragOver(e) {
  e.preventDefault()
  isDragging.value = true
}

function handleDragLeave(e) {
  e.preventDefault()
  isDragging.value = false
}

async function handleDrop(e) {
  e.preventDefault()
  isDragging.value = false
  const files = Array.from(e.dataTransfer.files)
  await processFiles(files)
}

async function handleFileInput(e) {
  const files = Array.from(e.target.files)
  await processFiles(files)
  e.target.value = ''
}

async function processFiles(files) {
  isUploading.value = true
  addLog('info', `检测到 ${files.length} 个文件，正在分析...`)

  try {
    const result = await window.electronAPI.scanFiles(files.map(f => f.path))
    if (result.success) {
      flacFiles.value = result.files
      addLog('success', `扫描完成，共发现 ${result.files.length} 个 FLAC 文件`)

      // 自动设置下载目录为第一个文件所在目录
      if (result.files.length > 0 && !downloadPath.value) {
        const dir = result.files[0].path.substring(0, result.files[0].path.lastIndexOf('\\'))
        downloadPath.value = dir
        addLog('info', `自动设置输出目录: ${dir}`)
      }
    } else {
      addLog('error', `扫描失败: ${result.error}`)
    }
  } catch (err) {
    addLog('error', `上传出错: ${err.message}`)
  } finally {
    isUploading.value = false
  }
}

function reUpload() {
  flacFiles.value = []
  totalProgress.value = 0
  fileProgress.value = 0
  convertingFileIndex.value = -1
  addLog('info', '已重置，可以重新上传文件')
}

// ============ 选择下载目录 ============
async function selectDownloadPath() {
  const path = await window.electronAPI.selectDirectory()
  if (path) {
    downloadPath.value = path
    addLog('info', `输出目录已设置为: ${path}`)
  }
}

// ============ 转换 ============
async function startConvert() {
  if (flacFiles.value.length === 0) {
    addLog('warn', '没有可转换的文件，请先上传 FLAC 文件')
    return
  }
  if (!downloadPath.value) {
    addLog('warn', '请先选择输出目录')
    return
  }

  isConverting.value = true
  totalProgress.value = 0
  fileProgress.value = 0
  convertingFileIndex.value = 0
  addLog('info', `===== 开始转换 ${flacFiles.value.length} 个文件 =====`)

  // 【修复关键点：解除 Vue Proxy 响应式包装】
  // 将 Proxy 数组彻底转化为纯对象数组，再发给 Electron
  const pureFiles = JSON.parse(JSON.stringify(flacFiles.value))

  // 通过 IPC 触发后端转换
  const result = await window.electronAPI.startConvert({
    files: pureFiles,
    outputPath: downloadPath.value,
  })

  if (!result.success) {
    addLog('error', `转换失败: ${result.error}`)
    isConverting.value = false
    return
  }

  // SSE 进度监听在 electronAPI 中处理
  window.electronAPI.onConvertProgress((data) => {
    if (data.type === 'file-progress') {
      fileProgress.value = data.progress
      totalProgress.value = data.totalProgress
      convertingFileIndex.value = data.index
      addLog('progress', `正在转换: ${data.filename} (${Math.round(data.progress)}%)`)
    } else if (data.type === 'file-done') {
      addLog('success', `完成: ${data.outputFile}`)
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

// ============ 计算属性 ============
const progressPercent = computed(() => Math.round(totalProgress.value))
const currentFileName = computed(() => {
  if (convertingFileIndex.value >= 0 && convertingFileIndex.value < flacFiles.value.length) {
    return flacFiles.value[convertingFileIndex.value].name
  }
  return ''
})

const logTypeClass = (type) => {
  const map = {
    info: 'log-info',
    success: 'log-success',
    error: 'log-error',
    warn: 'log-warn',
    progress: 'log-progress',
  }
  return map[type] || 'log-info'
}

// ============ 窗口控制 ============
const isMaximized = ref(false)

onMounted(() => {
  window.electronAPI.onWindowMaximized((val) => {
    isMaximized.value = val
  })
})

function handleMinimize() {
  window.electronAPI.minimizeWindow()
}

function handleMaximize() {
  window.electronAPI.maximizeWindow()
}

function handleClose() {
  window.electronAPI.closeWindow()
}
</script>

<template>
  <div class="app">
    <!-- ===== 自定义标题栏 ===== -->
    <header class="titlebar" @dblclick="handleMaximize">
      <!-- 工具栏内容 -->
      <div class="titlebar-content">
        <div class="toolbar-left">
          <span class="app-title">FLAC to MP3 Converter</span>
        </div>
        <div class="toolbar-right">
          <label class="toolbar-label">输出目录：</label>
          <div class="path-display" :title="downloadPath || '未选择'">
            {{ downloadPath || '未选择' }}
          </div>
          <button class="btn btn-path" @click="selectDownloadPath" :disabled="isConverting">
            选择目录
          </button>
        </div>

        <!-- 交通灯按钮 -->
        <div class="traffic-lights">
          <button class="traffic-btn minimize" @click.stop="handleMinimize" title="最小化">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M1 5h8" stroke="rgba(0,0,0,0.5)" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
          </button>
          <button class="traffic-btn maximize" @click.stop="handleMaximize" title="最大化">
            <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10">
              <rect x="1.5" y="1.5" width="7" height="7" stroke="rgba(0,0,0,0.5)" stroke-width="1.2" fill="none" rx="0.5"/>
            </svg>
            <svg v-else width="10" height="10" viewBox="0 0 10 10">
              <rect x="2.5" y="2.5" width="5" height="5" stroke="rgba(0,0,0,0.5)" stroke-width="1.2" fill="none" rx="0.5"/>
              <path d="M1.5 4.5h3v3.5h-3.5v-3z" stroke="rgba(0,0,0,0.5)" stroke-width="1.1" fill="none" rx="0.3"/>
            </svg>
          </button>
          <button class="traffic-btn close" @click.stop="handleClose" title="关闭">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M1 1L9 9M9 1L1 9" stroke="rgba(0,0,0,0.5)" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

      </div>
    </header>

    <!-- ===== 主内容区 ===== -->
    <main class="main-content">
      <!-- 左侧：上传/文件列表 -->
      <section class="panel panel-left">
        <!-- 上传区域（无文件时显示） -->
        <div
          v-if="flacFiles.length === 0"
          class="upload-area"
          :class="{ dragging: isDragging, uploading: isUploading }"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
          @click="fileInputRef && fileInputRef.click()"
          ref="uploadArea"
        >
          <input
            type="file"
            ref="fileInputRef"
            style="display:none"
            accept=".flac,audio/flac,audio/x-flac"
            multiple
            @change="handleFileInput"
          />
          <div class="upload-content">
            <div class="upload-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p class="upload-text">{{ isUploading ? '正在扫描 FLAC 文件...' : '拖拽 FLAC 文件到此处' }}</p>
            <p class="upload-sub">或点击选择文件</p>
          </div>
        </div>

        <!-- 文件列表（有文件时显示） -->
        <div v-else class="file-list-container">
          <div class="file-list-header">
            <span class="file-count">{{ flacFiles.length }} 个 FLAC 文件</span>
            <button class="btn btn-small" @click="reUpload" :disabled="isConverting">
              重新上传
            </button>
          </div>
          <ul class="file-list">
            <li
              v-for="(file, index) in flacFiles"
              :key="file.path"
              class="file-item"
              :class="{ active: index === convertingFileIndex, done: !isConverting && index < convertingFileIndex }"
            >
              <span class="file-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18V5l12-2v13"/>
                  <circle cx="6" cy="18" r="3"/>
                  <circle cx="18" cy="16" r="3"/>
                </svg>
              </span>
              <span class="file-name" :title="file.path">{{ file.name }}</span>
              <span class="file-size">{{ (file.size / 1024 / 1024).toFixed(2) }} MB</span>
            </li>
          </ul>
        </div>
      </section>

      <!-- 右侧：控制台 -->
      <section class="panel panel-right">
        <div class="console-header">
          <span>控制台</span>
          <button class="btn btn-small" @click="consoleLogs = []" :disabled="isConverting">
            清空
          </button>
        </div>
        <div class="console-log" ref="consoleEl">
          <div
            v-for="log in consoleLogs"
            :key="log.id"
            class="log-line"
            :class="logTypeClass(log.type)"
          >
            <span class="log-time">[{{ log.time }}]</span>
            <span class="log-msg">{{ log.message }}</span>
          </div>
          <div v-if="consoleLogs.length === 0" class="log-empty">
            控制台日志将在此显示...
          </div>
        </div>
      </section>
    </main>

    <!-- ===== 底部进度区 ===== -->
    <footer class="footer">
      <div class="progress-section" v-if="isConverting || totalProgress > 0">
        <div class="progress-info">
          <span class="progress-label">
            {{ isConverting ? `正在转换: ${currentFileName}` : '转换完成' }}
          </span>
          <span class="progress-percent">{{ progressPercent }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <div class="progress-detail">
          第 {{ convertingFileIndex + 1 }} / {{ flacFiles.length }} 个文件
        </div>
      </div>
      <div class="action-section">
        <button
          class="btn btn-convert"
          @click="startConvert"
          :disabled="isConverting || flacFiles.length === 0 || !downloadPath"
        >
          <svg v-if="!isConverting" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span v-if="isConverting" class="spinner"></span>
          {{ isConverting ? '转换中...' : '开始转换' }}
        </button>
      </div>
    </footer>
  </div>
</template>