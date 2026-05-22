import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMusicLibraryStore = defineStore('musicLibrary', () => {
  // ---- 状态 ----
  const warehouses = ref([])           // 音乐库列表 [{ name, path, trackCount, description, coverPath, recentPlayedAt }]
  const currentWarehouse = ref(null)    // 当前音乐库
  const sortBy = ref('recent-played')   // 排序方式: 'recent-played' | 'recent-updated' | 'name'

  // ---- Actions ----
  async function loadWarehouses() {
    try {
      const result = await window.electronAPI.getMusicWarehouses(sortBy.value)
      if (result.success && result.data) {
        warehouses.value = result.data.warehouses
      }
    } catch (err) {
      console.error('加载音乐库失败:', err)
    }
  }

  async function createWarehouse(name) {
    try {
      const result = await window.electronAPI.createMusicWarehouse(name)
      if (result.success && result.data) {
        warehouses.value.push(result.data.warehouse)
        return { success: true }
      }
      return { success: false, error: result.error || '创建失败' }
    } catch (err) {
      console.error('创建音乐库失败:', err)
      return { success: false, error: err.message }
    }
  }

  async function updateWarehouse(libraryId, updates) {
    try {
      const result = await window.electronAPI.updateMusicWarehouseById(libraryId, updates)
      if (result.success && result.data) {
        const idx = warehouses.value.findIndex(w => w.id === libraryId)
        if (idx !== -1) {
          warehouses.value[idx] = result.data.warehouse
        }
        return { success: true, warehouse: result.data.warehouse }
      }
      return { success: false, error: result.error || '更新失败' }
    } catch (err) {
      console.error('更新音乐库失败:', err)
      return { success: false, error: err.message }
    }
  }

  async function deleteWarehouse(libraryId) {
    try {
      const result = await window.electronAPI.deleteMusicWarehouseById(libraryId)
      if (result.success) {
        warehouses.value = warehouses.value.filter(w => w.id !== libraryId)
        
        // 如果正在播放该音乐库的音乐，则停止播放并清理内存
        const { usePlayerStore } = await import('./player')
        const playerStore = usePlayerStore()
        if (playerStore.currentTrack && (playerStore.currentTrack.libraryId === libraryId || playerStore.currentTrack.warehouseId === libraryId)) {
          window.dispatchEvent(new CustomEvent('stop-player'))
        }
        
        return true
      }
      return false
    } catch (err) {
      console.error('删除音乐库失败:', err)
      return false
    }
  }

  function setCurrentWarehouse(warehouse) {
    currentWarehouse.value = warehouse
  }

  function setSortBy(newSort) {
    sortBy.value = newSort
    loadWarehouses()
  }

  return {
    warehouses,
    currentWarehouse,
    sortBy,
    loadWarehouses,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
    setCurrentWarehouse,
    setSortBy,
  }
})
