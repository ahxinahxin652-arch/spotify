import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMusicLibraryStore = defineStore('musicLibrary', () => {
  // ---- 状态 ----
  const warehouses = ref([])           // 音乐库列表 [{ name, path, trackCount }]
  const currentWarehouse = ref(null)    // 当前音乐库

  // ---- Actions ----
  async function loadWarehouses() {
    try {
      const result = await window.electronAPI.getMusicWarehouses()
      if (result.success) {
        warehouses.value = result.warehouses
      }
    } catch (err) {
      console.error('加载音乐库失败:', err)
    }
  }

  async function createWarehouse(name) {
    try {
      const result = await window.electronAPI.createMusicWarehouse(name)
      if (result.success) {
        warehouses.value.push(result.warehouse)
        return true
      }
      return false
    } catch (err) {
      console.error('创建音乐库失败:', err)
      return false
    }
  }

  async function deleteWarehouse(name) {
    try {
      const result = await window.electronAPI.deleteMusicWarehouse(name)
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

  return {
    warehouses,
    currentWarehouse,
    loadWarehouses,
    createWarehouse,
    deleteWarehouse,
    setCurrentWarehouse,
  }
})