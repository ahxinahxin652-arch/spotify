/**
 * 曲目（Track）
 */
class Track {
  /**
   * @param {Object} params
   * @param {string} params.id           - UUID 唯一主键
   * @param {string} params.libraryId    - 外键，关联 MusicLibrary.id
   * @param {string} params.name         - 文件名 (例如 "song.flac")
   * @param {string} [params.title]      - 歌曲名称 (可从文件名解析)
   * @param {string} [params.artist]     - 歌手
   * @param {string} [params.album]      - 专辑名称
   * @param {number} [params.duration]   - 歌曲时长（秒）
   * @param {string} params.path         - 本地物理绝对路径
   * @param {string} params.format       - 文件格式后缀 (flac, mp3, kgm, ncm 等)
   * @param {number} [params.size]       - 文件大小 (Bytes)
   * @param {number} [params.modified]   - 文件修改时间戳 (mtimeMs)
   * @param {boolean} [params.isEncrypted] - 是否为加密格式
   * @param {string} [params.warehouse]  - 所属仓库名称
   * @param {Date|string} [params.createdAt] - 录入时间
   * @param {Date|string} [params.updatedAt] - 更新时间
   */
  constructor({
    id, libraryId = '', name, title = '', artist = '', album = '',
    duration = 0, path, format = '', size = 0, modified = 0,
    isEncrypted = false, warehouse = '', createdAt, updatedAt,
  }) {
    this.id = id
    this.libraryId = libraryId
    this.name = name
    this.title = title || name
    this.artist = artist
    this.album = album
    this.duration = duration
    this.path = path
    this.format = format
    this.size = size
    this.modified = modified
    this.isEncrypted = isEncrypted
    this.warehouse = warehouse
    this.createdAt = createdAt || new Date().toISOString()
    this.updatedAt = updatedAt || new Date().toISOString()
  }

  /**
   * 从文件系统扫描结果创建 Track
   * @param {Object} fileEntry - { name, path, size, modified? }
   * @param {string} warehouseName - 所属仓库名称
   * @returns {Track}
   */
  static fromFileEntry(fileEntry, warehouseName = '') {
    const ext = fileEntry.name.split('.').pop().toLowerCase()
    const ENCRYPTED_FORMATS = ['kgm', 'kgma', 'vpr', 'kgmm', 'qmc0', 'qmc3', 'qmcflac', 'qmcogg', 'mflac', 'mgg', 'ncm', 'kwm']
    return new Track({
      id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: fileEntry.name,
      path: fileEntry.path,
      format: ext,
      size: fileEntry.size || 0,
      modified: fileEntry.modified || 0,
      isEncrypted: ENCRYPTED_FORMATS.includes(ext),
      warehouse: warehouseName,
    })
  }

  /**
   * 从 plain object 创建实例
   * @param {Object} obj
   * @returns {Track}
   */
  static from(obj) {
    return new Track(obj)
  }
}

module.exports = Track
