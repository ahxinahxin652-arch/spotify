const { PrismaClient } = require('../generated/prisma-client')
const path = require('path')
const fs = require('fs')

let prisma = null

/**
 * 获取应用数据根目录
 * - 安装后 (isPackaged): exe 同级目录下的 data 文件夹 (如 D:\Music\Satisfy\data)
 * - dev 模式: ~/musicWarehouse  (如 C:\Users\xxx\musicWarehouse)
 * @returns {string}
 */
function getAppDataRoot() {
  const { app } = require('electron')
  if (app.isPackaged) {
    // app.getPath('exe') 返回 exe 的完整路径，如 D:\Music\Satisfy\Satisfy.exe
    // 取其父目录再拼 data
    return path.join(path.dirname(app.getPath('exe')), 'data')
  }
  return path.join(app.getPath('home'), 'musicWarehouse')
}

/**
 * 初始化 Prisma Client
 * 数据库文件路径：{userData}/data/db/music.db
 * @param {string} [customDbPath] - 自定义数据库文件路径（可选）
 * @returns {PrismaClient}
 */
function initDatabase(customDbPath) {
  if (prisma) return prisma

  const appDataRoot = getAppDataRoot()
  const dbDir = path.join(appDataRoot, 'db')
  const dbPath = customDbPath || path.join(dbDir, 'music.db')

  // 确保数据库目录存在
  const dbFileDir = path.dirname(dbPath)
  if (!fs.existsSync(dbFileDir)) {
    fs.mkdirSync(dbFileDir, { recursive: true })
  }

  const dbUrl = `file:${dbPath}`

  prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: ['error', 'warn'],
  })

  console.log(`[DB] SQLite database initialized at: ${dbPath}`)
  return prisma
}

/**
 * 自动执行数据库迁移（建表）
 * 使用 CREATE TABLE IF NOT EXISTS 确保幂等性
 */
async function autoMigrate() {
  const db = getDb()

  // 使用原始 SQL 创建表（幂等操作，可重复执行）
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "music_libraries" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "coverPath" TEXT,
      "recentPlayedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )
  `)

  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "music_libraries_name_key" ON "music_libraries"("name")
  `)

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "tracks" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "libraryId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "title" TEXT,
      "artist" TEXT,
      "album" TEXT,
      "duration" REAL,
      "path" TEXT NOT NULL,
      "format" TEXT NOT NULL,
      "size" INTEGER NOT NULL DEFAULT 0,
      "modified" REAL,
      "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "tracks_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "music_libraries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)

  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "tracks_path_key" ON "tracks"("path")
  `)

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "tracks_libraryId_idx" ON "tracks"("libraryId")
  `)

  // 记录 migration 版本
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  console.log('[DB] Auto-migration completed')
}

/**
 * 获取音乐仓库根目录（与 musicDao.getMusicWarehouseRoot 保持一致）
 * - dev 模式: ~/musicWarehouse
 * - 安装后: {userData}/data/musicWarehouse
 * @returns {string}
 */
function getMusicWarehouseRoot() {
  const { app } = require('electron')
  const appDataRoot = getAppDataRoot()
  if (app.isPackaged) {
    return path.join(appDataRoot, 'musicWarehouse')
  }
  return appDataRoot
}

/**
 * 检查数据库是否为空，如果是则尝试从文件系统恢复
 * 场景：用户删除了 music.db 或首次使用但已有音乐文件
 */
async function autoRecoverFromFiles() {
  const db = getDb()
  const { app } = require('electron')
  const musicWarehouseRoot = getMusicWarehouseRoot()

  // 检查数据库中是否有数据
  const libCount = await db.musicLibrary.count()
  if (libCount > 0) return // 数据库不为空，不需要恢复

  // 检查 musicWarehouse 目录是否存在且有子目录
  if (!fs.existsSync(musicWarehouseRoot)) return

  const entries = fs.readdirSync(musicWarehouseRoot, { withFileTypes: true })
  const warehouseDirs = entries.filter(e => e.isDirectory())

  if (warehouseDirs.length === 0) return

  console.log(`[DB Recovery] Database is empty, found ${warehouseDirs.length} warehouse(s) on disk, recovering...`)

  for (const dir of warehouseDirs) {
    const warehousePath = path.join(musicWarehouseRoot, dir.name)
    const musicDir = path.join(warehousePath, 'music')

    if (!fs.existsSync(musicDir)) {
      // 没有 music 子目录，跳过
      continue
    }

    try {
      // 创建音乐库记录
      const library = await db.musicLibrary.create({
        data: {
          id: crypto.randomUUID(),
          name: dir.name,
        },
      })

      // 扫描音乐文件并插入数据库
      const files = []
      scanMusicDirForRecover(musicDir, files)

      let recoveredCount = 0
      for (const file of files) {
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
              isEncrypted: ['kgm', 'kgma', 'vpr', 'kgmm', 'qmc0', 'qmc3', 'qmcflac', 'qmcogg', 'mflac', 'mgg', 'ncm', 'kwm'].includes(ext.replace('.', '')),
            },
          })
          recoveredCount++
        } catch (e) {
          // 可能路径重复，跳过
        }
      }

      console.log(`[DB Recovery] Recovered warehouse "${dir.name}" with ${recoveredCount} track(s)`)
    } catch (e) {
      console.error(`[DB Recovery] Failed to recover warehouse "${dir.name}":`, e.message)
    }
  }

  console.log('[DB Recovery] Recovery completed')
}

/**
 * 递归扫描音乐目录（恢复辅助函数）
 */
function scanMusicDirForRecover(dir, result) {
  const SUPPORTED_EXTENSIONS = ['.flac', '.mp3', '.ogg', '.wav', '.aac', '.m4a']
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scanMusicDirForRecover(fullPath, result)
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

/**
 * 获取 Prisma Client 实例
 * @returns {PrismaClient}
 */
function getDb() {
  if (!prisma) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return prisma
}

/**
 * 断开数据库连接
 */
async function disconnectDatabase() {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
    console.log('[DB] Database disconnected')
  }
}

module.exports = {
  initDatabase,
  autoMigrate,
  autoRecoverFromFiles,
  getDb,
  disconnectDatabase,
}
