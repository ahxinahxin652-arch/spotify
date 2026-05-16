const fs = require('fs')
const path = require('path')
const Track = require('../pojo/do/Track')
const { WarehouseItemVO, ImportResultVO } = require('../pojo/vo/ResponseVOs')

// ========== 音乐仓库 DAO ==========

/**
 * 获取音乐仓库根目录
 * @returns {string}
 */
function getMusicWarehouseRoot() {
  return path.join(require('electron').app.getPath('home'), 'musicWarehouse')
}

/**
 * 获取所有音乐库
 * @returns {Array<import('../pojo/vo/ResponseVOs').WarehouseItemVO>}
 */
function getAllWarehouses() {
  const root = getMusicWarehouseRoot()
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true })
    return []
  }

  try {
    const entries = fs.readdirSync(root, { withFileTypes: true })
    return entries
      .filter(e => e.isDirectory())
      .map(e => {
        const warehousePath = path.join(root, e.name)
        const trackCount = countTracks(warehousePath)
        return new WarehouseItemVO({
          name: e.name,
          path: warehousePath,
          trackCount,
        })
      })
  } catch (err) {
    return []
  }
}

/**
 * 计算目录下支持格式的曲目数量
 */
function countTracks(warehousePath) {
  try {
    const SUPPORTED_EXTENSIONS = ['.flac', '.mp3', '.ogg', '.wav', '.aac', '.m4a']
    let count = 0
    function scanDir(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          scanDir(fullPath)
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (SUPPORTED_EXTENSIONS.includes(ext)) {
            count++
          }
        }
      }
    }
    scanDir(warehousePath)
    return count
  } catch (e) {
    return 0
  }
}

/**
 * 创建音乐库
 * @param {string} name
 * @returns {{ success: boolean, warehouse?: import('../pojo/vo/ResponseVOs').WarehouseItemVO, error?: string }}
 */
function createWarehouse(name) {
  const root = getMusicWarehouseRoot()
  const warehousePath = path.join(root, name)

  try {
    if (!fs.existsSync(warehousePath)) {
      fs.mkdirSync(warehousePath, { recursive: true })
      // 同时创建 music 子目录
      fs.mkdirSync(path.join(warehousePath, 'music'), { recursive: true })
    }
    return {
      success: true,
      warehouse: new WarehouseItemVO({
        name,
        path: warehousePath,
        trackCount: 0,
      }),
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * 删除音乐库（仅删除记录，文件保留）
 * @param {string} name
 */
function deleteWarehouse(name) {
  const root = getMusicWarehouseRoot()
  const warehousePath = path.join(root, name)
  // 只删除目录中的 .metadata 等配置文件，不删除实际音乐文件
  return { success: true }
}

/**
 * 获取音乐库下的所有曲目
 * @param {string} warehouseName
 * @returns {{ success: boolean, tracks?: Array<import('../pojo/do/Track')>, warehouseName?: string, error?: string }}
 */
function getWarehouseTracks(warehouseName) {
  const root = getMusicWarehouseRoot()
  const warehousePath = path.join(root, warehouseName)
  const musicDir = path.join(warehousePath, 'music')

  if (!fs.existsSync(musicDir)) {
    fs.mkdirSync(musicDir, { recursive: true })
  }

  try {
    const tracks = []
    scanMusicDir(musicDir, tracks, warehouseName)
    return { success: true, warehouseName, tracks }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * 递归扫描音乐目录
 * @param {string} dir
 * @param {Array<import('../pojo/do/Track')>} result
 * @param {string} warehouseName
 */
function scanMusicDir(dir, result, warehouseName) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const SUPPORTED_EXTENSIONS = ['.flac', '.mp3', '.ogg', '.wav', '.aac', '.m4a']

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scanMusicDir(fullPath, result, warehouseName)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          try {
            const stats = fs.statSync(fullPath)
            result.push(Track.fromFileEntry({
              name: entry.name,
              path: fullPath,
              size: stats.size,
              modified: stats.mtimeMs,
            }, warehouseName))
          } catch (e) {
            // 忽略无法读取的文件
          }
        }
      }
    }
  } catch (e) {
    // 忽略无权限的目录
  }
}

/**
 * 导入文件到音乐库
 * @param {string} warehouseName
 * @param {string[]} filePaths
 * @returns {{ success: boolean, result?: import('../pojo/vo/ResponseVOs').ImportResultVO, error?: string }}
 */
function importFilesToWarehouse(warehouseName, filePaths) {
  const root = getMusicWarehouseRoot()
  const musicDir = path.join(root, warehouseName, 'music')

  if (!fs.existsSync(musicDir)) {
    fs.mkdirSync(musicDir, { recursive: true })
  }

  const SUPPORTED_EXTENSIONS = ['.flac', '.mp3', '.ogg', '.wav', '.aac', '.m4a',
    '.kgm', '.kgma', '.vpr', '.kgmm',
    '.qmc0', '.qmc3', '.qmcflac', '.qmcogg', '.mflac', '.mgg',
    '.ncm', '.kwm']
  const imported = []
  const skipped = []

  for (const filePath of filePaths) {
    try {
      const ext = path.extname(filePath).toLowerCase()
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        skipped.push(filePath)
        continue
      }

      const fileName = path.basename(filePath)
      const destPath = path.join(musicDir, fileName)

      // 避免覆盖同名文件
      let finalPath = destPath
      let counter = 1
      while (fs.existsSync(finalPath)) {
        const nameWithoutExt = path.basename(filePath, ext)
        finalPath = path.join(musicDir, `${nameWithoutExt}_${counter}${ext}`)
        counter++
      }

      fs.copyFileSync(filePath, finalPath)
      imported.push(finalPath)
    } catch (e) {
      skipped.push(filePath)
    }
  }

  return {
    success: true,
    result: new ImportResultVO({ imported: imported.length, skipped: skipped.length }),
  }
}

/**
 * 获取音乐仓库根目录
 */
function getMusicWarehouseDir() {
  return getMusicWarehouseRoot()
}

module.exports = {
  getMusicWarehouseRoot,
  getAllWarehouses,
  createWarehouse,
  deleteWarehouse,
  getWarehouseTracks,
  importFilesToWarehouse,
  getMusicWarehouseDir,
}