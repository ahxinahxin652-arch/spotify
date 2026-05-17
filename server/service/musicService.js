const musicDao = require('../dao/musicDao')
const fs = require('fs')
const ApiResult = require('../pojo/vo/ApiResult')

// ========== 音乐仓库 Service ==========

/**
 * 获取所有音乐库
 * @returns {Promise<import('../pojo/vo/ApiResult')<{ warehouses: Array<import('../pojo/vo/ResponseVOs').WarehouseItemVO> }>>}
 */
async function getMusicWarehouses() {
  const warehouses = await musicDao.getAllWarehouses()
  return ApiResult.ok({ warehouses })
}

/**
 * 创建音乐库
 * @param {string} name
 * @returns {Promise<import('../pojo/vo/ApiResult')<{ warehouse: import('../pojo/vo/ResponseVOs').WarehouseItemVO }>>}
 */
async function createMusicWarehouse(name) {
  if (!name || name.trim() === '') {
    return ApiResult.fail('音乐库名称不能为空')
  }

  // 验证名称不包含非法字符
  const invalidChars = /[<>:"/\\|?*]/
  if (invalidChars.test(name)) {
    return ApiResult.fail('音乐库名称包含非法字符')
  }

  const result = await musicDao.createWarehouse(name.trim())
  if (!result.success) {
    return ApiResult.fail(result.error)
  }
  return ApiResult.ok({ warehouse: result.warehouse })
}

/**
 * 删除音乐库
 * @param {string} name
 * @returns {Promise<import('../pojo/vo/ApiResult')<null>>}
 */
async function deleteMusicWarehouse(name) {
  const result = await musicDao.deleteWarehouse(name)
  if (!result.success) {
    return ApiResult.fail(result.error || '删除失败')
  }
  return ApiResult.ok(null, '删除成功')
}

/**
 * 获取指定音乐库的曲目列表
 * @param {string} warehouseName
 * @returns {Promise<import('../pojo/vo/ApiResult')<{ warehouseName: string, tracks: Array<import('../pojo/do/Track')> }>>}
 */
async function getWarehouseTracks(warehouseName) {
  const result = await musicDao.getWarehouseTracks(warehouseName)
  if (!result.success) {
    return ApiResult.fail(result.error)
  }
  return ApiResult.ok({ warehouseName: result.warehouseName, tracks: result.tracks })
}

/**
 * 导入文件到音乐库
 * @param {string} warehouseName
 * @param {string[]} filePaths
 * @returns {Promise<import('../pojo/vo/ApiResult')<{ imported: number, skipped: number }>>}
 */
async function importFilesToWarehouse(warehouseName, filePaths) {
  const result = await musicDao.importFilesToWarehouse(warehouseName, filePaths)
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

/**
 * 校验单个曲目文件是否可播放
 * 如果文件不存在，自动从数据库删除并返回错误
 * @param {string} trackId - 曲目 ID
 * @param {string} filePath - 曲目文件路径
 * @returns {Promise<import('../pojo/vo/ApiResult')<{ playable: true }>>}
 */
async function validateTrackPlayable(trackId, filePath) {
  if (!fs.existsSync(filePath)) {
    // 文件不存在，从数据库清除该记录
    try {
      const { getDb } = require('../dao/db')
      const db = getDb()
      await db.track.delete({ where: { id: trackId } })
      console.warn(`[DB Sync] Track "${trackId}" file missing, deleted from database`)
    } catch (e) {
      console.error(`[DB] Failed to delete orphan track "${trackId}":`, e.message)
    }
    return ApiResult.fail('该歌曲已被删除或已损坏')
  }
  return ApiResult.ok({ playable: true })
}

/**
 * 同步指定音乐库的数据（文件系统 <-> 数据库一致性）
 * @param {string} warehouseName
 * @returns {Promise<import('../pojo/vo/ApiResult')<{ added: number, removed: number }>>}
 */
async function syncWarehouse(warehouseName) {
  const result = await musicDao.syncWarehouse(warehouseName)
  return ApiResult.ok(result)
}

module.exports = {
  getMusicWarehouses,
  createMusicWarehouse,
  deleteMusicWarehouse,
  getWarehouseTracks,
  importFilesToWarehouse,
  getMusicWarehouseDir,
  validateTrackPlayable,
  syncWarehouse,
}
