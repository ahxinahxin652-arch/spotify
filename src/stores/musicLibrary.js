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

  async function updateWarehouse(oldName, updates) {
    try {
      const result = await window.electronAPI.updateMusicWarehouse(oldName, updates)
      if (result.success && result.data) {
        const idx = warehouses.value.findIndex(w => w.name === oldName)
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

  async function deleteWarehouse(name) {
    try {
      // 优先通过 ID 删除（稳定），找到对应的仓库记录获取 id
      const warehouse = warehouses.value.find(w => w.name === name)
      let result
      if (warehouse && warehouse.id) {
        result = await window.electronAPI.deleteMusicWarehouseById(warehouse.id)
      } else {
        result = await window.electronAPI.deleteMusicWarehouse(name)
      }
      if (result.success) {
        warehouses.value = warehouses.value.filter(w => w.name !== name)
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
