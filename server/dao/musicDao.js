const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const {spawn} = require('child_process')
const {getDb} = require('./db')
const Track = require('../pojo/do/Track')
const {WarehouseItemVO, ImportResultVO} = require('../pojo/vo/ResponseVOs')

// ========== 常量 ==========
const SUPPORTED_EXTENSIONS = ['.flac', '.mp3', '.ogg', '.wav', '.aac', '.m4a']
const ALL_IMPORTABLE_EXTENSIONS = [
    '.flac', '.mp3', '.ogg', '.wav', '.aac', '.m4a',
    '.kgm', '.kgma', '.vpr', '.kgmm',
    '.qmc0', '.qmc3', '.qmcflac', '.qmcogg', '.mflac', '.mgg',
    '.ncm', '.kwm',
]
const ENCRYPTED_FORMATS = ['kgm', 'kgma', 'vpr', 'kgmm', 'qmc0', 'qmc3', 'qmcflac', 'qmcogg', 'mflac', 'mgg', 'ncm', 'kwm']

// ========== 元数据解析 ==========

/**
 * 解析音频文件的元数据 (歌曲名、歌手、时长)
 * @param {string} filePath 音频文件的绝对路径
 * @returns {Promise<{ title: string, artist: string, duration: number }>}
 */
async function parseAudioMetadata(filePath) {
    try {
        // 使用动态 import 兼容 CommonJS / ESM 环境
        const mm = await import('music-metadata');

        // parseFile 会自动分析文件头并提取相关信息
        const metadata = await mm.parseFile(filePath);

        return {
            title: metadata.common.title || '',
            artist: metadata.common.artist || '',
            // 时长单位为秒，使用 Math.round 进行取整，如果解析失败默认为 0
            duration: metadata.format.duration ? Math.round(metadata.format.duration) : 0
        };
    } catch (error) {
        console.error(`[Metadata] 解析文件元数据失败 ${filePath}:`, error.message);
        // 解析失败时返回空值，避免程序中断
        return {title: '', artist: '', duration: 0};
    }
}

/**
 * 辅助函数：当元数据缺失时，尝试从文件名中推断信息 (例如 "歌手 - 歌名")
 */
function parseFileName(fileName) {
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    const parts = nameWithoutExt.split(' - ');
    if (parts.length >= 2) {
        return {artist: parts[0].trim(), title: parts[1].trim()};
    }
    return {artist: '', title: nameWithoutExt};
}

// ========== 音乐仓库 DAO ==========

/**
 * 获取应用数据根目录
 * - 安装后 (isPackaged): exe 同级目录下的 data 文件夹 (如 D:\Music\Satisfy\data)
 * - dev 模式: ~/musicWarehouse  (如 C:\Users\xxx\musicWarehouse)
 * 与 db.js 中的 getAppDataRoot 保持一致
 * @returns {string}
 */
function getAppDataRoot() {
    const {app} = require('electron')
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
    const {app} = require('electron')
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
 * @param {string} [sortBy] - 排序方式: 'recent-played' | 'recent-updated' | 'name'
 * @returns {Promise<Array<import('../pojo/vo/ResponseVOs').WarehouseItemVO>>}
 */
async function getAllWarehouses(sortBy = 'recent-played') {
    const db = getDb()
    const root = getMusicWarehouseRoot()

    // 确保根目录存在
    if (!fs.existsSync(root)) {
        fs.mkdirSync(root, {recursive: true})
    }

    // 根据排序方式确定 orderBy
    let orderBy
    switch (sortBy) {
        case 'recent-updated':
            orderBy = {updatedAt: 'desc'}
            break
        case 'name':
            orderBy = {name: 'asc'}
            break
        case 'recent-played':
        default:
            orderBy = {recentPlayedAt: {sort: 'desc', nulls: 'last'}}
            break
    }

    const libraries = await db.musicLibrary.findMany({
        include: {
            _count: {select: {tracks: true}},
        },
        orderBy,
    })

    const result = []
    for (const lib of libraries) {
        const warehousePath = path.join(root, lib.name)

        // 一致性校验：数据库有记录但文件夹不存在 -> 清理数据库记录
        if (!fs.existsSync(warehousePath)) {
            console.warn(`[DB Sync] Warehouse "${lib.name}" directory not found, removing from database`)
            await db.track.deleteMany({where: {libraryId: lib.id}})
            await db.musicLibrary.delete({where: {id: lib.id}})
            continue
        }

        result.push(new WarehouseItemVO({
            id: lib.id,
            name: lib.name,
            path: warehousePath,
            trackCount: lib._count.tracks,
            description: lib.description || '',
            coverPath: lib.coverPath || '',
            recentPlayedAt: lib.recentPlayedAt,
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
                fs.mkdirSync(warehousePath, {recursive: true})
                fs.mkdirSync(path.join(warehousePath, 'music'), {recursive: true})
            }
        } catch (fsErr) {
            // 文件夹创建失败，回滚数据库
            console.error(`[DB Rollback] Failed to create directory for "${name}", rolling back database`)
            await db.musicLibrary.delete({where: {id: library.id}})
            return {success: false, error: `文件夹创建失败: ${fsErr.message}`}
        }

        return {
            success: true,
            warehouse: new WarehouseItemVO({
                id: library.id,
                name,
                path: warehousePath,
                trackCount: 0,
            }),
        }
    } catch (err) {
        // 数据库插入失败（可能是名称重复）
        if (err.code === 'P2002') {
            return {success: false, error: `音乐库 "${name}" 已存在`}
        }
        return {success: false, error: err.message}
    }
}

/**
 * 递归扫描音乐目录（同步辅助函数）
 */
function scanMusicDirForSync(dir, result) {
    try {
        const entries = fs.readdirSync(dir, {withFileTypes: true})
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

/**
 * 通过 ID 更新音乐库的最近播放时间（名称变更安全）
 * @param {string} libraryId - 音乐库 UUID
 * @returns {Promise<{ success: boolean }>}
 */
async function updateRecentPlayedById(libraryId) {
    const db = getDb()
    try {
        await db.musicLibrary.update({
            where: {id: libraryId},
            data: {recentPlayedAt: new Date()},
        })
        return {success: true}
    } catch (err) {
        return {success: false, error: err.message}
    }
}

/**
 * 更新音乐库信息（通过 library ID）
 * @param {string} libraryId - 音乐库 UUID
 * @param {Object} updates - 要更新的字段
 * @param {string} [updates.name] - 新名称
 * @param {string} [updates.description] - 新描述
 * @param {string} [updates.coverPath] - 新封面 Base64
 * @returns {Promise<{ success: boolean, warehouse?: import('../pojo/vo/ResponseVOs').WarehouseItemVO, error?: string }>}
 */
async function updateWarehouseById(libraryId, updates) {
    const db = getDb()
    const root = getMusicWarehouseRoot()

    try {
        const library = await db.musicLibrary.findUnique({where: {id: libraryId}})
        if (!library) {
            return {success: false, error: `音乐库不存在`}
        }

        // 如果要改名，需要重命名文件夹并更新所有 track 的路径
        const needRename = updates.name && updates.name !== library.name
        if (needRename) {
            const oldPath = path.join(root, library.name)
            const newPath = path.join(root, updates.name)
            // 检查新名称是否已存在文件夹
            if (fs.existsSync(newPath)) {
                return {success: false, error: `音乐库名 "${updates.name}" 已存在`}
            }
            // 重命名文件夹
            fs.renameSync(oldPath, newPath)

            // 更新所有关联 track 的 path 字段，将旧路径前缀替换为新路径前缀
            const oldPrefix = oldPath + path.sep
            const newPrefix = newPath + path.sep
            const libraryTracks = await db.track.findMany({
                where: {libraryId: library.id},
                select: {id: true, path: true},
            })
            for (const track of libraryTracks) {
                if (track.path.startsWith(oldPrefix)) {
                    const updatedPath = newPrefix + track.path.slice(oldPrefix.length)
                    await db.track.update({
                        where: {id: track.id},
                        data: {path: updatedPath},
                    })
                }
            }
        }

        // 构建更新数据
        const data = {}
        if (updates.name !== undefined) data.name = updates.name
        if (updates.description !== undefined) data.description = updates.description
        if (updates.coverPath !== undefined) data.coverPath = updates.coverPath

        const updated = await db.musicLibrary.update({
            where: {id: library.id},
            data,
            include: {_count: {select: {tracks: true}}},
        })

        const warehousePath = path.join(root, updated.name)
        return {
            success: true,
            warehouse: new WarehouseItemVO({
                id: updated.id,
                name: updated.name,
                path: warehousePath,
                trackCount: updated._count.tracks,
                description: updated.description || '',
                coverPath: updated.coverPath || '',
                recentPlayedAt: updated.recentPlayedAt,
            }),
        }
    } catch (err) {
        // 名字唯一性冲突
        if (err.code === 'P2002') {
            return {success: false, error: `音乐库名已存在`}
        }
        return {success: false, error: err.message}
    }
}

/**
 * 通过 track ID 解析当前最新的 track 信息（含最新 path）
 * 播放端在播放前调用，确保拿到的是数据库中最新的路径
 * @param {string} trackId
 * @returns {Promise<{ success: boolean, track?: Object, error?: string }>}
 */
async function resolveTrackById(trackId) {
    const db = getDb()
    try {
        const track = await db.track.findUnique({
            where: {id: trackId},
            include: {library: {select: {id: true, name: true}}},
        })
        if (!track) {
            return {success: false, error: '曲目不存在'}
        }
        return {
            success: true,
            track: {
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
                warehouse: track.library.name,
                warehouseId: track.libraryId,
                createdAt: track.createdAt,
                updatedAt: track.updatedAt,
            },
        }
    } catch (err) {
        return {success: false, error: err.message}
    }
}

/**
 * 获取音乐库下的所有曲目（通过 library ID）
 * @param {string} libraryId
 * @returns {Promise<{ success: boolean, tracks?: Array, libraryId?: string, warehouseName?: string, error?: string }>}
 */
async function getWarehouseTracksById(libraryId) {
    const db = getDb()

    try {
        const library = await db.musicLibrary.findUnique({
            where: {id: libraryId},
        })

        if (!library) {
            return {success: false, error: `音乐库不存在`}
        }

        const tracks = await db.track.findMany({
            where: {libraryId: library.id},
            orderBy: {createdAt: 'desc'},
        })

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
                    warehouse: library.name,
                    warehouseId: library.id,
                    createdAt: track.createdAt,
                    updatedAt: track.updatedAt,
                }))
            } else {
                console.warn(`[DB Sync] Track "${track.name}" file not found at "${track.path}", removing from database`)
                orphanIds.push(track.id)
            }
        }

        if (orphanIds.length > 0) {
            await db.track.deleteMany({
                where: {id: {in: orphanIds}},
            })
        }

        return {
            success: true,
            warehouseName: library.name,
            tracks: validTracks,
            libraryId: library.id,
            warehouse: {name: library.name, description: library.description || '', coverPath: library.coverPath || ''}
        }
    } catch (err) {
        return {success: false, error: err.message}
    }
}

/**
 * 导入文件到音乐库（通过 library ID）
 * @param {string} libraryId
 * @param {string[]} filePaths
 * @returns {Promise<{ success: boolean, result?: ImportResultVO, error?: string }>}
 */
async function importFilesToWarehouseById(libraryId, filePaths) {
    const db = getDb();
    const root = getMusicWarehouseRoot();

    const library = await db.musicLibrary.findUnique({
        where: {id: libraryId},
    });

    if (!library) {
        return {success: false, error: `音乐库不存在`};
    }

    const musicDir = path.join(root, library.name, 'music');

    if (!fs.existsSync(musicDir)) {
        fs.mkdirSync(musicDir, {recursive: true});
    }

    const imported = [];
    const skipped = [];

    for (const filePath of filePaths) {
        try {
            const ext = path.extname(filePath).toLowerCase();
            // 此处的 ALL_IMPORTABLE_EXTENSIONS 和 SUPPORTED_EXTENSIONS 需在外部定义
            if (!ALL_IMPORTABLE_EXTENSIONS.includes(ext)) {
                skipped.push(filePath);
                continue;
            }

            if (!fs.existsSync(filePath)) {
                skipped.push(filePath);
                continue;
            }

            const fileName = path.basename(filePath);
            const destPath = path.join(musicDir, fileName);

            let finalPath = destPath;
            let finalName = fileName;
            let counter = 1;

            // 处理文件名冲突
            while (fs.existsSync(finalPath)) {
                const nameWithoutExt = path.basename(filePath, ext);
                finalName = `${nameWithoutExt}_${counter}${ext}`;
                finalPath = path.join(musicDir, finalName);
                counter++;
            }

            fs.copyFileSync(filePath, finalPath);

            try {
                const stats = fs.statSync(finalPath);
                const trackId = crypto.randomUUID();
                const isEncrypted = ENCRYPTED_FORMATS.includes(ext.replace('.', ''));

                // 初始化基础 Track 数据
                const trackData = {
                    id: trackId,
                    libraryId: library.id,
                    name: finalName,
                    title: path.basename(finalName, ext), // 默认 title 为文件名
                    artist: '',                           // 默认 artist 为空
                    duration: 0,                          // 默认时长为 0
                    path: finalPath,
                    format: ext.replace('.', ''),
                    size: stats.size,
                    modified: stats.mtimeMs,
                    isEncrypted,
                };

                // 如果是未加密的受支持格式，读取内置元数据
                if (!isEncrypted && SUPPORTED_EXTENSIONS.includes(ext)) {
                    const meta = await parseAudioMetadata(finalPath);
                    const nameMeta = parseFileName(finalName);

                    // 优先级：文件内置元数据 > 文件名正则提取 > 默认文件名
                    trackData.title = meta.title || nameMeta.title || trackData.title;
                    trackData.artist = meta.artist || nameMeta.artist || '';
                    trackData.duration = meta.duration || 0;
                }

                // 存入 SQLite 数据库
                await db.track.create({data: trackData});

                imported.push(finalPath);
            } catch (dbErr) {
                console.error(`[DB] 插入歌曲 "${finalName}" 失败，正在回滚文件:`, dbErr);
                try {
                    fs.unlinkSync(finalPath);
                } catch (_) {
                }
                skipped.push(filePath);
            }
        } catch (e) {
            console.error(`[File] 处理文件 "${filePath}" 时发生未知错误:`, e);
            skipped.push(filePath);
        }
    }

    // 假设 ImportResultVO 已经定义
    return {
        success: true,
        result: {imported: imported.length, skipped: skipped.length},
    };
}

/**
 * 同步指定音乐库的数据（通过 library ID）
 * @param {string} libraryId
 * @returns {Promise<{ added: number, removed: number }>}
 */
async function syncWarehouseById(libraryId) {
    const db = getDb()
    const root = getMusicWarehouseRoot()

    const library = await db.musicLibrary.findUnique({
        where: {id: libraryId},
    })

    if (!library) return {added: 0, removed: 0}

    const musicDir = path.join(root, library.name, 'music')

    const dbTracks = await db.track.findMany({
        where: {libraryId: library.id},
    })
    const dbPathSet = new Set(dbTracks.map(t => t.path))

    const fsFiles = []
    if (fs.existsSync(musicDir)) {
        scanMusicDirForSync(musicDir, fsFiles)
    }
    const fsPathSet = new Set(fsFiles.map(f => f.path))

    const orphanTracks = dbTracks.filter(t => !fsPathSet.has(t.path))
    let removed = 0
    if (orphanTracks.length > 0) {
        const result = await db.track.deleteMany({
            where: {id: {in: orphanTracks.map(t => t.id)}},
        })
        removed = result.count
    }

    const newFiles = fsFiles.filter(f => !dbPathSet.has(f.path))
    let added = 0
    for (const file of newFiles) {
        try {
            const ext = path.extname(file.name).toLowerCase()
            const isEncrypted = ENCRYPTED_FORMATS.includes(ext.replace('.', ''))

            const trackData = {
                id: crypto.randomUUID(),
                libraryId: library.id,
                name: file.name,
                title: path.basename(file.name, ext),
                path: file.path,
                format: ext.replace('.', ''),
                size: file.size,
                modified: file.modified,
                isEncrypted,
            }

            if (!isEncrypted && SUPPORTED_EXTENSIONS.includes(ext)) {
                const meta = await parseAudioMetadata(file.path)
                const nameMeta = parseFileName(file.name)
                trackData.title = meta.title || nameMeta.title || trackData.title
                trackData.artist = meta.artist || nameMeta.artist || ''
                trackData.duration = meta.duration || 0
            }

            await db.track.create({data: trackData})
            added++
        } catch (e) {
            // 可能路径重复，跳过
        }
    }

    return {added, removed}
}

/**
 * 删除音乐库（通过 library ID）
 * @param {string} libraryId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function deleteWarehouseById(libraryId) {
    const db = getDb()
    const root = getMusicWarehouseRoot()

    try {
        const library = await db.musicLibrary.findUnique({
            where: {id: libraryId},
        })

        if (!library) {
            return {success: true}
        }

        const warehousePath = path.join(root, library.name)

        if (fs.existsSync(warehousePath)) {
            try {
                fs.rmSync(warehousePath, {recursive: true, force: true})
            } catch (fsErr) {
                console.error(`[DB] Warning: Failed to delete warehouse directory "${library.name}":`, fsErr.message)
            }
        }

        await db.musicLibrary.delete({where: {id: library.id}})

        return {success: true}
    } catch (err) {
        return {success: false, error: err.message}
    }
}

/**
 * 更新曲目信息（编辑歌曲）
 * @param {string} id
 * @param {Object} data - { title?, artist?, album? }
 * @returns {Promise<{ success: boolean, track?: Object, error?: string }>}
 */
async function updateTrack(id, data) {
    const db = getDb()
    try {
        const track = await db.track.update({
            where: {id},
            data: {
                ...(data.title !== undefined && {title: data.title}),
                ...(data.artist !== undefined && {artist: data.artist}),
                ...(data.album !== undefined && {album: data.album}),
            },
        })
        return {success: true, track}
    } catch (err) {
        return {success: false, error: err.message}
    }
}

/**
 * 删除曲目（从数据库和文件系统）
 * @param {string} id
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function deleteTrack(id) {
    const db = getDb()
    try {
        const track = await db.track.findUnique({where: {id}})
        if (!track) return {success: false, error: '曲目不存在'}

        await db.track.delete({where: {id}})

        try {
            if (fs.existsSync(track.path)) {
                fs.unlinkSync(track.path)
            }
        } catch (fsErr) {
            console.error(`[DB] Warning: Failed to delete track file "${track.path}":`, fsErr.message)
        }

        return {success: true}
    } catch (err) {
        return {success: false, error: err.message}
    }
}

module.exports = {
    getMusicWarehouseRoot,
    getAllWarehouses,
    createWarehouse,
    deleteWarehouseById,
    getWarehouseTracksById,
    importFilesToWarehouseById,
    syncWarehouseById,
    updateWarehouseById,
    updateRecentPlayedById,
    resolveTrackById,
    updateTrack,
    deleteTrack,
}
