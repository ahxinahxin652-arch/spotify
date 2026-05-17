const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { getDb } = require('./db')
const Track = require('../pojo/do/Track')
const { WarehouseItemVO, ImportResultVO } = require('../pojo/vo/ResponseVOs')

// ========== 常量 ==========
const SUPPORTED_EXTENSIONS = ['.flac', '.mp3', '.ogg', '.wav', '.aac', '.m4a']
const ALL_IMPORTABLE_EXTENSIONS = [
  '.flac', '.mp3', '.ogg', '.wav', '.aac', '.m4a',
  '.kgm', '.kgma', '.vpr', '.kgmm',
  '.qmc0', '.qmc3', '.qmcflac', '.qmcogg', '.mflac', '.mgg',
  '.ncm', '.kwm',
]
const ENCRYPTED_FORMATS = ['kgm', 'kgma', 'vpr', 'kgmm', 'qmc0', 'qmc3', 'qmcflac', 'qmcogg', 'mflac', 'mgg', 'ncm', 'kwm']

// ========== 音乐仓库 DAO ==========

/**
 * 获取应用数据根目录
 * - 安装后 (isPackaged): exe 同级目录下的 data 文件夹 (如 D:\Music\Satisfy\data)
 * - dev 模式: ~/musicWarehouse  (如 C:\Users\xxx\musicWarehouse)
 * 与 db.js 中的 getAppDataRoot 保持一致
 * @returns {string}
 */
function getAppDataRoot() {
  const { app } = require('electron')
  if (app.isPackaged) {
    return path.join(path.dirname(app.getPath('exe')), 'data')
  }
  return path.join(app.getPath('home'), 'musicWarehouse')
}

/**
 * 获取音乐仓库根目录
 * - dev 模式: ~/musicWarehouse (getAppDataRoot 本身就返回这个)
 * - 安装后: {userData}/data/musicWarehouse
 * @returns {string}
 */
function getMusicWarehouseRoot() {
  const { app } = require('electron')
  if (app.isPackaged) {
    // 安装后：在 data 目录下再加 musicWarehouse 子目录
    return path.join(getAppDataRoot(), 'musicWarehouse')
  }
  // dev 模式：getAppDataRoot 已经是 ~/musicWarehouse，直接用
  return getAppDataRoot()
}

/**
 * 获取所有音乐库
 * 优先从 SQLite 读取，同时校验文件夹是否存在
 * @returns {Promise<Array<import('../pojo/vo/ResponseVOs').WarehouseItemVO>>}
 */
async function getAllWarehouses() {
  const db = getDb()
  const root = getMusicWarehouseRoot()

  // 确保根目录存在
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true })
  }

  const libraries = await db.musicLibrary.findMany({
    include: {
      _count: { select: { tracks: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const result = []
  for (const lib of libraries) {
    const warehousePath = path.join(root, lib.name)

    // 一致性校验：数据库有记录但文件夹不存在 -> 清理数据库记录
    if (!fs.existsSync(warehousePath)) {
      console.warn(`[DB Sync] Warehouse "${lib.name}" directory not found, removing from database`)
      await db.track.deleteMany({ where: { libraryId: lib.id } })
      await db.musicLibrary.delete({ where: { id: lib.id } })
      continue
    }

    result.push(new WarehouseItemVO({
      name: lib.name,
      path: warehousePath,
      trackCount: lib._count.tracks,
    }))
  }

  return result
}

/**
 * 创建音乐库
 * 先插入 SQLite，再创建文件夹。如果文件夹创建失败则回滚数据库。
 * @param {string} name
 * @returns {Promise<{ success: boolean, warehouse?: import('../pojo/vo/ResponseVOs').WarehouseItemVO, error?: string }>}
 */
async function createWarehouse(name) {
  const db = getDb()
  const root = getMusicWarehouseRoot()
  const warehousePath = path.join(root, name)

  try {
    // 1. 先插入数据库
    const library = await db.musicLibrary.create({
      data: {
        id: crypto.randomUUID(),
        name,
      },
    })

    // 2. 再创建文件夹
    try {
      if (!fs.existsSync(warehousePath)) {
        fs.mkdirSync(warehousePath, { recursive: true })
        fs.mkdirSync(path.join(warehousePath, 'music'), { recursive: true })
      }
    } catch (fsErr) {
      // 文件夹创建失败，回滚数据库
      console.error(`[DB Rollback] Failed to create directory for "${name}", rolling back database`)
      await db.musicLibrary.delete({ where: { id: library.id } })
      return { success: false, error: `文件夹创建失败: ${fsErr.message}` }
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
    // 数据库插入失败（可能是名称重复）
    if (err.code === 'P2002') {
      return { success: false, error: `音乐库 "${name}" 已存在` }
    }
    return { success: false, error: err.message }
  }
}

/**
 * 删除音乐库
 * 先删除文件夹，再从 SQLite 删除记录（含关联 Track）
 * @param {string} name
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function deleteWarehouse(name) {
  const db = getDb()
  const root = getMusicWarehouseRoot()
  const warehousePath = path.join(root, name)

  try {
    // 查找数据库记录
    const library = await db.musicLibrary.findUnique({
      where: { name },
    })

    if (!library) {
      // 数据库中没有记录，但尝试清理可能残留的文件夹
      if (fs.existsSync(warehousePath)) {
        fs.rmSync(warehousePath, { recursive: true, force: true })
      }
      return { success: true }
    }

    // 1. 先删除文件夹（尽力而为，失败不阻塞数据库删除）
    if (fs.existsSync(warehousePath)) {
      try {
        fs.rmSync(warehousePath, { recursive: true, force: true })
      } catch (fsErr) {
        console.error(`[DB] Warning: Failed to delete warehouse directory "${name}":`, fsErr.message)
      }
    }

    // 2. 删除数据库记录（Track 通过 onDelete: Cascade 自动级联删除）
    await db.musicLibrary.delete({ where: { id: library.id } })

    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * 获取音乐库下的所有曲目
 * 优先从 SQLite 读取，同时校验每个文件是否还存在
 * 不存在的文件自动从数据库清除
 * @param {string} warehouseName
 * @returns {Promise<{ success: boolean, tracks?: Array<import('../pojo/do/Track')>, warehouseName?: string, error?: string }>}
 */
async function getWarehouseTracks(warehouseName) {
  const db = getDb()

  try {
    const library = await db.musicLibrary.findUnique({
      where: { name: warehouseName },
    })

    if (!library) {
      return { success: false, error: `音乐库 "${warehouseName}" 不存在` }
    }

    const tracks = await db.track.findMany({
      where: { libraryId: library.id },
      orderBy: { createdAt: 'desc' },
    })

    // 一致性校验：检查每个文件是否存在
    const validTracks = []
    const orphanIds = []

    for (const track of tracks) {
      if (fs.existsSync(track.path)) {
        validTracks.push(Track.from({
          id: track.id,
          libraryId: track.libraryId,
          name: track.name,
          title: track.title || track.name,
          artist: track.artist || '',
          album: track.album || '',
          duration: track.duration || 0,
          path: track.path,
          format: track.format,
          size: track.size,
          modified: track.modified || 0,
          isEncrypted: track.isEncrypted,
          warehouse: warehouseName,
          createdAt: track.createdAt,
          updatedAt: track.updatedAt,
        }))
      } else {
        // 文件已不存在，标记为孤儿记录
        console.warn(`[DB Sync] Track "${track.name}" file not found at "${track.path}", removing from database`)
        orphanIds.push(track.id)
      }
    }

    // 批量删除孤儿记录
    if (orphanIds.length > 0) {
      await db.track.deleteMany({
        where: { id: { in: orphanIds } },
      })
    }

    return { success: true, warehouseName, tracks: validTracks }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * 导入文件到音乐库
 * 先复制文件，成功后插入 SQLite
 * @param {string} warehouseName
 * @param {string[]} filePaths
 * @returns {Promise<{ success: boolean, result?: import('../pojo/vo/ResponseVOs').ImportResultVO, error?: string }>}
 */
async function importFilesToWarehouse(warehouseName, filePaths) {
  const db = getDb()
  const root = getMusicWarehouseRoot()
  const musicDir = path.join(root, warehouseName, 'music')

  // 确保 music 目录存在
  if (!fs.existsSync(musicDir)) {
    fs.mkdirSync(musicDir, { recursive: true })
  }

  // 查找对应的数据库记录
  const library = await db.musicLibrary.findUnique({
    where: { name: warehouseName },
  })

  if (!library) {
    return { success: false, error: `音乐库 "${warehouseName}" 不存在` }
  }

  const imported = []
  const skipped = []

  for (const filePath of filePaths) {
    try {
      const ext = path.extname(filePath).toLowerCase()
      if (!ALL_IMPORTABLE_EXTENSIONS.includes(ext)) {
        skipped.push(filePath)
        continue
      }

      // 检查源文件是否存在
      if (!fs.existsSync(filePath)) {
        skipped.push(filePath)
        continue
      }

      const fileName = path.basename(filePath)
      const destPath = path.join(musicDir, fileName)

      // 避免覆盖同名文件
      let finalPath = destPath
      let finalName = fileName
      let counter = 1
      while (fs.existsSync(finalPath)) {
        const nameWithoutExt = path.basename(filePath, ext)
        finalName = `${nameWithoutExt}_${counter}${ext}`
        finalPath = path.join(musicDir, finalName)
        counter++
      }

      // 1. 先复制文件
      fs.copyFileSync(filePath, finalPath)

      // 2. 文件复制成功后，插入数据库
      try {
        const stats = fs.statSync(finalPath)
        const trackId = crypto.randomUUID()

        await db.track.create({
          data: {
            id: trackId,
            libraryId: library.id,
            name: finalName,
            title: path.basename(finalName, ext),
            path: finalPath,
            format: ext.replace('.', ''),
            size: stats.size,
            modified: stats.mtimeMs,
            isEncrypted: ENCRYPTED_FORMATS.includes(ext.replace('.', '')),
          },
        })

        imported.push(finalPath)
      } catch (dbErr) {
        // 数据库插入失败，清理已复制的文件
        console.error(`[DB] Failed to insert track "${finalName}" into database, cleaning up file`)
        try {
          fs.unlinkSync(finalPath)
        } catch (_) {}
        skipped.push(filePath)
      }
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

/**
 * 同步指定音乐库的数据
 * 将文件系统中存在但数据库中没有的文件补充到数据库
 * @param {string} warehouseName
 * @returns {Promise<{ added: number, removed: number }>}
 */
async function syncWarehouse(warehouseName) {
  const db = getDb()
  const root = getMusicWarehouseRoot()
  const musicDir = path.join(root, warehouseName, 'music')

  const library = await db.musicLibrary.findUnique({
    where: { name: warehouseName },
  })

  if (!library) return { added: 0, removed: 0 }

  // 1. 从数据库获取所有记录
  const dbTracks = await db.track.findMany({
    where: { libraryId: library.id },
  })
  const dbPathSet = new Set(dbTracks.map(t => t.path))

  // 2. 从文件系统扫描所有音频文件
  const fsFiles = []
  if (fs.existsSync(musicDir)) {
    scanMusicDirForSync(musicDir, fsFiles)
  }
  const fsPathSet = new Set(fsFiles.map(f => f.path))

  // 3. 找出数据库中有但文件系统中没有的 -> 从数据库删除
  const orphanTracks = dbTracks.filter(t => !fsPathSet.has(t.path))
  let removed = 0
  if (orphanTracks.length > 0) {
    const result = await db.track.deleteMany({
      where: { id: { in: orphanTracks.map(t => t.id) } },
    })
    removed = result.count
  }

  // 4. 找出文件系统中有但数据库中没有的 -> 添加到数据库
  const newFiles = fsFiles.filter(f => !dbPathSet.has(f.path))
  let added = 0
  for (const file of newFiles) {
    try {
      const ext = path.extname(file.name).toLowerCase()
      await db.track.create({
        data: {
          id: crypto.randomUUID(),
          libraryId: library.id,
          name: file.name,
          title: path.basename(file.name, ext),
          path: file.path,
          format: ext.replace('.', ''),
          size: file.size,
          modified: file.modified,
          isEncrypted: ENCRYPTED_FORMATS.includes(ext.replace('.', '')),
        },
      })
      added++
    } catch (e) {
      // 可能路径重复，跳过
    }
  }

  return { added, removed }
}

/**
 * 递归扫描音乐目录（同步辅助函数）
 */
function scanMusicDirForSync(dir, result) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scanMusicDirForSync(fullPath, result)
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase()
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          try {
            const stats = fs.statSync(fullPath)
            result.push({
              name: entry.name,
              path: fullPath,
              size: stats.size,
              modified: stats.mtimeMs,
            })
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

module.exports = {
  getMusicWarehouseRoot,
  getAllWarehouses,
  createWarehouse,
  deleteWarehouse,
  getWarehouseTracks,
  importFilesToWarehouse,
  getMusicWarehouseDir,
  syncWarehouse,
}
