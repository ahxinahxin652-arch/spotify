const crypto = require('crypto')
const { getDb } = require('./db')

/**
 * 根据 ID 获取歌手
 * @param {string} id
 * @returns {Promise<import('../generated/prisma-client').Artist|null>}
 */
async function getArtistById(id) {
  const db = getDb()
  const artist = await db.artist.findUnique({
    where: { id }
  })
  if (!artist) {
    return null
  }
  
  // 查询关联此歌手 ID 的曲目
  const tracks = await db.track.findMany({
    where: {
      artists: {
        contains: id
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })
  
  return {
    ...artist,
    tracks
  }
}

/**
 * 如果歌手不存在则创建
 * @param {string} name
 * @returns {Promise<import('../generated/prisma-client').Artist>}
 */
async function createArtistIfNotExist(name) {
  const db = getDb()
  let artist = await db.artist.findUnique({
    where: { name }
  })
  if (!artist) {
    artist = await db.artist.create({
      data: {
        id: crypto.randomUUID(),
        name,
        metadata: '{}',
        coverImg: null
      }
    })
  }
  return artist
}

/**
 * 更新歌手信息，并同步更新关联歌曲的 artists JSON 字段中对应的歌手名称
 * @param {string} id
 * @param {Object} updates - { name?, coverImg?, metadata? }
 * @returns {Promise<import('../generated/prisma-client').Artist>}
 */
async function updateArtist(id, updates) {
  const db = getDb()

  const oldArtist = await db.artist.findUnique({
    where: { id }
  })
  if (!oldArtist) {
    throw new Error('Artist not found')
  }

  // 构建更新数据
  const data = {}
  if (updates.name !== undefined) data.name = updates.name
  if (updates.coverImg !== undefined) data.coverImg = updates.coverImg
  if (updates.metadata !== undefined) {
    data.metadata = typeof updates.metadata === 'string' ? updates.metadata : JSON.stringify(updates.metadata)
  }

  const updatedArtist = await db.artist.update({
    where: { id },
    data
  })

  // 如果更新了歌手名称，则同步更新 track.artists JSON 数组
  if (updates.name !== undefined && updates.name !== oldArtist.name) {
    const tracks = await db.track.findMany({
      where: {
        artists: {
          contains: id
        }
      }
    })

    for (const track of tracks) {
      if (track.artists) {
        try {
          const boundArtists = JSON.parse(track.artists)
          if (Array.isArray(boundArtists)) {
            let changed = false
            for (const artistObj of boundArtists) {
              if (artistObj.id === id) {
                artistObj.name = updates.name
                changed = true
              }
            }
            if (changed) {
              await db.track.update({
                where: { id: track.id },
                data: {
                  artists: JSON.stringify(boundArtists)
                }
              })
            }
          }
        } catch (e) {
          console.error(`Failed to sync artist name in track ${track.id}:`, e)
        }
      }
    }
  }

  return updatedArtist
}

module.exports = {
  getArtistById,
  createArtistIfNotExist,
  updateArtist
}
