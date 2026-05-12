const musicDao = require('../dao/musicDao')

// ========== 音乐仓库 Service ==========

/**
 * 获取所有音乐库
 */
function getMusicWarehouses() {
  const warehouses = musicDao.getAllWarehouses()
  return { success: true, warehouses }
}

/**
 * 创建音乐库
 */
function createMusicWarehouse(name) {
  if (!name || name.trim() === '') {
    return { success: false, error: '音乐库名称不能为空' }
  }

  // 验证名称不包含非法字符
  const invalidChars = /[<>:"/\\|?*]/
  if (invalidChars.test(name)) {
    return { success: false, error: '音乐库名称包含非法字符' }
  }

  const result = musicDao.createWarehouse(name.trim())
  return result
}

/**
 * 删除音乐库
 */
function deleteMusicWarehouse(name) {
  const result = musicDao.deleteWarehouse(name)
  return result
}

/**
 * 获取指定音乐库的曲目列表
 */
function getWarehouseTracks(warehouseName) {
  const result = musicDao.getWarehouseTracks(warehouseName)
  return result
}

/**
 * 导入文件到音乐库
 */
function importFilesToWarehouse(warehouseName, filePaths) {
  const result = musicDao.importFilesToWarehouse(warehouseName, filePaths)
  return result
}

/**
 * 获取音乐仓库根目录
 */
function getMusicWarehouseDir() {
  return musicDao.getMusicWarehouseDir()
}

module.exports = {
  getMusicWarehouses,
  createMusicWarehouse,
  deleteMusicWarehouse,
  getWarehouseTracks,
  importFilesToWarehouse,
  getMusicWarehouseDir,
}