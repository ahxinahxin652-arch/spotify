const musicDao = require('../dao/musicDao')
const ApiResult = require('../pojo/vo/ApiResult')

// ========== 音乐仓库 Service ==========

/**
 * 获取所有音乐库
 * @returns {import('../pojo/vo/ApiResult')<{ warehouses: Array<import('../pojo/vo/ResponseVOs').WarehouseItemVO> }>}
 */
function getMusicWarehouses() {
  const warehouses = musicDao.getAllWarehouses()
  return ApiResult.ok({ warehouses })
}

/**
 * 创建音乐库
 * @param {string} name
 * @returns {import('../pojo/vo/ApiResult')<{ warehouse: import('../pojo/vo/ResponseVOs').WarehouseItemVO }>}
 */
function createMusicWarehouse(name) {
  if (!name || name.trim() === '') {
    return ApiResult.fail('音乐库名称不能为空')
  }

  // 验证名称不包含非法字符
  const invalidChars = /[<>:"/\\|?*]/
  if (invalidChars.test(name)) {
    return ApiResult.fail('音乐库名称包含非法字符')
  }

  const result = musicDao.createWarehouse(name.trim())
  if (!result.success) {
    return ApiResult.fail(result.error)
  }
  return ApiResult.ok({ warehouse: result.warehouse })
}

/**
 * 删除音乐库
 * @param {string} name
 * @returns {import('../pojo/vo/ApiResult')<null>}
 */
function deleteMusicWarehouse(name) {
  const result = musicDao.deleteWarehouse(name)
  if (!result.success) {
    return ApiResult.fail(result.error || '删除失败')
  }
  return ApiResult.ok(null, '删除成功')
}

/**
 * 获取指定音乐库的曲目列表
 * @param {string} warehouseName
 * @returns {import('../pojo/vo/ApiResult')<{ warehouseName: string, tracks: Array<import('../pojo/do/Track')> }>}
 */
function getWarehouseTracks(warehouseName) {
  const result = musicDao.getWarehouseTracks(warehouseName)
  if (!result.success) {
    return ApiResult.fail(result.error)
  }
  return ApiResult.ok({ warehouseName: result.warehouseName, tracks: result.tracks })
}

/**
 * 导入文件到音乐库
 * @param {string} warehouseName
 * @param {string[]} filePaths
 * @returns {import('../pojo/vo/ApiResult')<{ imported: number, skipped: number }>}
 */
function importFilesToWarehouse(warehouseName, filePaths) {
  const result = musicDao.importFilesToWarehouse(warehouseName, filePaths)
  if (!result.success) {
    return ApiResult.fail(result.error || '导入失败')
  }
  return ApiResult.ok({ imported: result.result.imported, skipped: result.result.skipped })
}

/**
 * 获取音乐仓库根目录
 * @returns {string}
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
