const musicDao = require('../dao/musicDao')
const fs = require('fs')
const ApiResult = require('../pojo/vo/ApiResult')

// ========== 音乐仓库 Service ==========

/**
 * 获取所有音乐库
 * @param {string} [sortBy] - 排序方式: 'recent-played' | 'recent-updated' | 'name'
 * @returns {Promise<import('../pojo/vo/ApiResult')<{ warehouses: Array<import('../pojo/vo/ResponseVOs').WarehouseItemVO> }>>}
 */
async function getMusicWarehouses(sortBy) {
  const warehouses = await musicDao.getAllWarehouses(sortBy)
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
 * 通过 ID 更新音乐库信息
 * @param {string} libraryId - 音乐库 UUID
 * @param {Object} updates - 要更新的字段 { name?, description?, coverPath? }
 * @returns {Promise<import('../pojo/vo/ApiResult')<{ warehouse: import('../pojo/vo/ResponseVOs').WarehouseItemVO }>}
 */
async function updateMusicWarehouseById(libraryId, updates) {
  if (!updates || Object.keys(updates).length === 0) {
    return ApiResult.fail('没有要更新的内容')
  }

  // 如果要改名，做校验
  if (updates.name !== undefined) {
    const newName = updates.name.trim()
    if (!newName) {
      return ApiResult.fail('音乐库名称不能为空')
    }
    const invalidChars = /[<>:"/\\|?*]/
    if (invalidChars.test(newName)) {
      return ApiResult.fail('音乐库名称包含非法字符')
    }
    updates.name = newName
  }

  // 描述处理
  if (updates.description !== undefined) {
    updates.description = (updates.description || '').trim()
  }

  const result = await musicDao.updateWarehouseById(libraryId, updates)
  if (!result.success) {
    return ApiResult.fail(result.error)
  }
  return ApiResult.ok({ warehouse: result.warehouse })
}

/**
 * 通过 ID 删除音乐库
 * @param {string} libraryId
 * @returns {Promise<import('../pojo/vo/ApiResult')<null>>}
 */
async function deleteMusicWarehouseById(libraryId) {
  const result = await musicDao.deleteWarehouseById(libraryId)
  if (!result.success) {
    return ApiResult.fail(result.error || '删除失败')
  }
  return ApiResult.ok(null, '删除成功')
}

/**
 * 通过 ID 获取指定音乐库的曲目列表
 * @param {string} libraryId
 * @returns {Promise<import('../pojo/vo/ApiResult')>}
 */
async function getWarehouseTracksById(libraryId) {
  const result = await musicDao.getWarehouseTracksById(libraryId)
  if (!result.success) {
    return ApiResult.fail(result.error)
  }
  return ApiResult.ok({ warehouseName: result.warehouseName, tracks: result.tracks, libraryId: result.libraryId, warehouse: result.warehouse })
}

/**
 * 通过 ID 导入文件到音乐库
 * @param {string} libraryId
 * @param {string[]} filePaths
 * @returns {Promise<import('../pojo/vo/ApiResult')<{ imported: number, skipped: number }>>}
 */
async function importFilesToWarehouseById(libraryId, filePaths) {
  const result = await musicDao.importFilesToWarehouseById(libraryId, filePaths)
  if (!result.success) {
    return ApiResult.fail(result.error || '导入失败')
  }
  return ApiResult.ok({ imported: result.result.imported, skipped: result.result.skipped })
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
 * 通过 track ID 解析当前最新的 track 信息（含最新 path）
 * @param {string} trackId
 * @returns {Promise<import('../pojo/vo/ApiResult')>}
 */
async function resolveTrackById(trackId) {
  const result = await musicDao.resolveTrackById(trackId)
  if (!result.success) {
    return ApiResult.fail(result.error)
  }
  return ApiResult.ok({ track: result.track })
}

/**
 * 通过 ID 同步指定音乐库的数据
 * @param {string} libraryId
 * @returns {Promise<import('../pojo/vo/ApiResult')<{ added: number, removed: number }>>}
 */
async function syncWarehouseById(libraryId) {
  const result = await musicDao.syncWarehouseById(libraryId)
  return ApiResult.ok(result)
}

/**
 * 通过 ID 更新音乐库的最近播放时间（名称变更安全）
 * @param {string} libraryId - 音乐库 UUID
 * @returns {Promise<import('../pojo/vo/ApiResult')<null>>}
 */
async function updateRecentPlayedById(libraryId) {
  await musicDao.updateRecentPlayedById(libraryId)
  return ApiResult.ok(null)
}

/**
 * 更新曲目信息
 * @param {string} trackId
 * @param {Object} data - { title?, artist?, album? }
 * @returns {Promise<ApiResult>}
 */
async function updateTrack(trackId, data) {
  const result = await musicDao.updateTrack(trackId, data)
  if (!result.success) return ApiResult.fail(result.error || '更新失败')
  return ApiResult.ok({ track: result.track })
}

/**
 * 删除曲目
 * @param {string} trackId
 * @returns {Promise<ApiResult>}
 */
async function deleteTrack(trackId) {
  const result = await musicDao.deleteTrack(trackId)
  if (!result.success) return ApiResult.fail(result.error || '删除失败')
  return ApiResult.ok(null, '删除成功')
}

module.exports = {
  getMusicWarehouses,
  createMusicWarehouse,
  updateMusicWarehouseById,
  deleteMusicWarehouseById,
  getWarehouseTracksById,
  importFilesToWarehouseById,
  validateTrackPlayable,
  resolveTrackById,
  syncWarehouseById,
  updateRecentPlayedById,
  updateTrack,
  deleteTrack,
}
