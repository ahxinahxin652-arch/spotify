/**
 * 音乐仓库（Music Library / Warehouse）
 */
class MusicLibrary {
  /**
   * @param {Object} params
   * @param {string} params.id                  - UUID 唯一主键
   * @param {string} params.name                - 音乐库名称 (例如："我的收藏", "运动歌单")
   * @param {string} [params.description]       - 描述信息 (可选)
   * @param {string} [params.coverPath]         - 封面图片的本地路径或Base64
   * @param {Date|string|null} [params.recentPlayedAt] - 最近播放时间
   * @param {Date|string} [params.createdAt]    - 创建时间
   * @param {Date|string} [params.updatedAt]    - 更新时间
   */
  constructor({ id, name, description = '', coverPath = '', recentPlayedAt = null, createdAt, updatedAt }) {
    this.id = id
    this.name = name
    this.description = description
    this.coverPath = coverPath
    this.recentPlayedAt = recentPlayedAt
    this.createdAt = createdAt || new Date().toISOString()
    this.updatedAt = updatedAt || new Date().toISOString()
  }

  /**
   * 从 plain object 创建实例
   * @param {Object} obj
   * @returns {MusicLibrary}
   */
  static from(obj) {
    return new MusicLibrary(obj)
  }
}

module.exports = MusicLibrary
