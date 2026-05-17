const { PrismaClient } = require('../generated/prisma-client')
const path = require('path')
const fs = require('fs')

let prisma = null

/**
 * 初始化 Prisma Client
 * 数据库文件存储在用户主目录下的 musicWarehouse/ 目录中
 * 首次运行时自动执行建表 SQL
 * @param {string} [customDbPath] - 自定义数据库文件路径（可选）
 * @returns {PrismaClient}
 */
function initDatabase(customDbPath) {
  if (prisma) return prisma

  // 数据库文件路径：~/musicWarehouse/music.db
  const { app } = require('electron')
  const dbDir = path.join(app.getPath('home'), 'musicWarehouse')
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
 * 读取 Prisma 生成的 migration SQL 文件并执行
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

  // 记录 migration 版本（简单方案：用一张专用表记录已执行的 migration）
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
  getDb,
  disconnectDatabase,
}
