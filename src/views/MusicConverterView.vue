<script setup>
import { ref } from 'vue'
import { useLocalStorageStore } from '../stores/localStorage'

const localStorageStore = useLocalStorageStore()

const fileInputRef = ref(null)
const flacFiles = ref([])
const consoleLogs = ref([])
const isConverting = ref(false)
const convertingFileIndex = ref(-1)
const totalProgress = ref(0)
const fileProgress = ref(0)
const outputPath = ref(localStorageStore.musicConvertOutput)
let logId = 0

function addLog(type, message) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  consoleLogs.value.push({ id: logId++, type, message, time })
}

async function handleFileInput(e) {
  const fileList = Array.from(e.target.files)
  const filePaths = fileList.map(f => f.path)
  addLog('info', `检测到 ${fileList.length} 个新文件，正在分析...`)

  const result = await window.electronAPI.scanFiles(filePaths)
  if (result.success && result.data) {
    // 【优化】：将新文件追加到现有列表，并根据 path 去重
    const newFiles = result.data.files.filter(nf =>
        !flacFiles.value.some(ef => ef.path === nf.path)
    )
    flacFiles.value = [...flacFiles.value, ...newFiles]

    addLog('success', `扫描完成，新增 ${newFiles.length} 个文件，当前共 ${flacFiles.value.length} 个`)
  } else {
    addLog('error', `扫描失败: ${result.error}`)
  }
  e.target.value = '' // 重置 input，允许重复选择相同文件触发 change
}

function handleDrop(e) {
  e.preventDefault()
  const fileList = Array.from(e.dataTransfer.files)
  const filePaths = fileList.map(f => f.path)
  addLog('info', `拖拽识别中...`)

  window.electronAPI.scanFiles(filePaths).then(result => {
    if (result.success && result.data) {
      // 【优化】：追加并去重[cite: 1]
      const newFiles = result.data.files.filter(nf =>
          !flacFiles.value.some(ef => ef.path === nf.path)
      )
      flacFiles.value = [...flacFiles.value, ...newFiles]
      addLog('success', `添加完成`)
    }
  })
}

// 辅助函数：统一触发文件管理器
function openFilePicker() {
  if (isConverting.value) return
  fileInputRef.value?.click()
}

async function selectOutputPath() {
  const path = await window.electronAPI.selectDirectory()
  if (path) {
    outputPath.value = path
    localStorageStore.setMusicConvertOutput(path)
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

  // 解开 Vue Proxy 响应式包装
  const pureFiles = JSON.parse(JSON.stringify(flacFiles.value))

  const result = await window.electronAPI.startConvert({
    files: pureFiles, // 使用脱壳后的纯数组
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
      if (data.totalProgress !== undefined) {
        totalProgress.value = data.totalProgress
      }
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
          <!-- 1. 将 label 改为 button，并禁用原生默认行为 -->
          <button class="btn btn-small" @click="openFilePicker" :disabled="isConverting">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            添加文件
          </button>
          <!-- 2. 将隐藏的 input 提出来作为独立兄弟元素，不要包裹在任何具有点击事件的父级中 -->
          <input type="file" ref="fileInputRef" multiple accept=".flac" style="display:none" @change="handleFileInput" />
        </div>
      </div>

      <!-- 【修改点】：使用 v-if，当列表有文件时，此区域彻底消失[cite: 1] -->
      <div
          v-if="flacFiles.length === 0"
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
          <p>点击或拖拽 FLAC 文件到此处</p>
          <span class="drop-hint">支持多个文件追加管理</span>
        </div>
      </div>

      <!-- 文件列表：当有文件时占满剩余容器[cite: 1] -->
      <div class="file-list" v-else>
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
          <!-- 添加一个移除按钮，增强管理功能[cite: 1] -->
          <button class="btn-remove" v-if="!isConverting" @click.stop="flacFiles.splice(index, 1)">
            ×
          </button>
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