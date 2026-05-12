<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMusicLibraryStore } from '../stores/musicLibrary.js'

const router = useRouter()
const library = useMusicLibraryStore()

const showCreateDialog = ref(false)
const newWarehouseName = ref('')
const isLoading = ref(false)

onMounted(() => {
  library.loadWarehouses()
})

async function handleCreateWarehouse() {
  const name = newWarehouseName.value.trim()
  if (!name) return
  isLoading.value = true
  const success = await library.createWarehouse(name)
  isLoading.value = false
  if (success) {
    showCreateDialog.value = false
    newWarehouseName.value = ''
  }
}

function enterWarehouse(warehouse) {
  library.setCurrentWarehouse(warehouse)
  router.push(`/warehouse/${encodeURIComponent(warehouse.name)}`)
}

async function handleDeleteWarehouse(warehouse) {
  if (confirm(`确定要删除音乐库 "${warehouse.name}" 吗？文件不会被删除。`)) {
    await library.deleteWarehouse(warehouse.name)
  }
}

function handleDrop(e) {
  e.preventDefault()
  // 拖拽文件到音乐库时，复制文件到该音乐库
  const warehouseName = e.currentTarget.dataset.warehouse
  if (!warehouseName) return
  const files = Array.from(e.dataTransfer.files)
  handleImportFiles(warehouseName, files)
}

async function handleImportFiles(warehouseName, files) {
  const filePaths = files.map(f => f.path)
  const result = await window.electronAPI.importFilesToWarehouse(warehouseName, filePaths)
  if (result.success) {
    // 刷新音乐库列表
    library.loadWarehouses()
  }
}
</script>

<template>
  <div class="home-view">
    <!-- 音乐库区域 -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">音乐库</h2>
        <button class="btn btn-primary" @click="showCreateDialog = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          新建音乐库
        </button>
      </div>

      <div class="warehouse-grid" v-if="library.warehouses.length > 0">
        <div
          v-for="wh in library.warehouses"
          :key="wh.name"
          class="warehouse-card"
          @click="enterWarehouse(wh)"
          @drop="handleDrop"
          @dragover.prevent
          @dragenter.prevent
          :data-warehouse="wh.name"
        >
          <div class="warehouse-cover">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9 18V5l12-2v13"/>
              <circle cx="6" cy="18" r="3"/>
              <circle cx="18" cy="16" r="3"/>
            </svg>
          </div>
          <div class="warehouse-info">
            <span class="warehouse-name">{{ wh.name }}</span>
            <span class="warehouse-count">{{ wh.trackCount }} 首曲目</span>
          </div>
          <button
            class="btn-delete"
            @click.stop="handleDeleteWarehouse(wh)"
            title="删除音乐库"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>

      <div v-else class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
        <p>暂无音乐库，点击"新建音乐库"开始</p>
      </div>
    </section>

    <!-- 解密 & 转换工具入口 -->
    <section class="section tools-section">
      <h2 class="section-title">工具</h2>
      <div class="tools-grid">
        <div class="tool-card" @click="router.push('/unlock')">
          <div class="tool-icon unlock">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div class="tool-info">
            <span class="tool-name">解密音乐</span>
            <span class="tool-desc">解密酷狗/QQ音乐/网易云/酷我等加密格式</span>
          </div>
        </div>

        <div class="tool-card" @click="router.push('/converter')">
          <div class="tool-icon converter">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 3 21 3 21 8"/>
              <line x1="4" y1="20" x2="21" y2="3"/>
              <polyline points="21 16 21 21 16 21"/>
              <line x1="15" y1="15" x2="21" y2="21"/>
            </svg>
          </div>
          <div class="tool-info">
            <span class="tool-name">格式转换</span>
            <span class="tool-desc">将 FLAC 等无损格式转换为 MP3</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 新建音乐库对话框 -->
    <div v-if="showCreateDialog" class="dialog-overlay" @click.self="showCreateDialog = false">
      <div class="dialog">
        <h3 class="dialog-title">新建音乐库</h3>
        <input
          v-model="newWarehouseName"
          class="dialog-input"
          placeholder="请输入音乐库名称"
          @keyup.enter="handleCreateWarehouse"
          autofocus
        />
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="showCreateDialog = false">取消</button>
          <button class="btn btn-primary" @click="handleCreateWarehouse" :disabled="!newWarehouseName.trim() || isLoading">
            {{ isLoading ? '创建中...' : '创建' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>