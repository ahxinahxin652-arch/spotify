const MusicLibrary = require('../do/MusicLibrary')
const Track = require('../do/Track')

// ========== 音乐仓库相关 VO ==========

/**
 * 仓库列表响应
 */
class WarehouseListVO {
  /**
   * @param {Object} params
   * @param {Array<WarehouseItemVO>} params.warehouses - 仓库列表
   */
  constructor({ warehouses = [] }) {
    this.warehouses = warehouses
  }
}

/**
 * 仓库列表中的单个仓库项 (轻量级，不含完整 Track 列表)
 */
class WarehouseItemVO {
  /**
   * @param {Object} params
   * @param {string} params.name        - 仓库名称 (目录名)
   * @param {string} params.path        - 仓库绝对路径
   * @param {number} params.trackCount  - 曲目数量
   */
  constructor({ name, path, trackCount = 0 }) {
    this.name = name
    this.path = path
    this.trackCount = trackCount
  }
}

/**
 * 创建仓库响应
 */
class WarehouseCreateVO {
  /**
   * @param {Object} params
   * @param {WarehouseItemVO} params.warehouse - 创建的仓库信息
   */
  constructor({ warehouse }) {
    this.warehouse = warehouse
  }
}

/**
 * 仓库曲目列表响应
 */
class WarehouseTracksVO {
  /**
   * @param {Object} params
   * @param {string} params.warehouseName - 仓库名称
   * @param {Array<Track>} params.tracks  - 曲目列表
   */
  constructor({ warehouseName, tracks = [] }) {
    this.warehouseName = warehouseName
    this.tracks = tracks
  }
}

/**
 * 导入文件响应
 */
class ImportResultVO {
  /**
   * @param {Object} params
   * @param {number} params.imported - 成功导入数
   * @param {number} params.skipped  - 跳过数
   */
  constructor({ imported = 0, skipped = 0 }) {
    this.imported = imported
    this.skipped = skipped
  }
}

// ========== 格式转换相关 VO ==========

/**
 * 扫描结果响应
 */
class ScanResultVO {
  /**
   * @param {Object} params
   * @param {Array<ScanFileItem>} params.files - 扫描到的文件列表
   */
  constructor({ files = [] }) {
    this.files = files
  }
}

/**
 * 扫描文件项
 */
class ScanFileItem {
  /**
   * @param {Object} params
   * @param {string} params.name - 文件名
   * @param {string} params.path - 文件绝对路径
   * @param {number} params.size - 文件大小 (Bytes)
   */
  constructor({ name, path, size = 0 }) {
    this.name = name
    this.path = path
    this.size = size
  }
}

/**
 * 转换进度事件
 */
class ConvertProgressEvent {
  /**
   * @param {Object} params
   * @param {'file-progress'|'file-done'|'error'|'all-done'} params.type - 事件类型
   * @param {number}  [params.index]         - 当前文件索引
   * @param {string}  [params.filename]      - 文件名
   * @param {number}  [params.progress]      - 单文件进度 0-100
   * @param {number}  [params.totalProgress] - 总体进度 0-100
   * @param {string}  [params.outputFile]    - 输出文件路径
   * @param {number}  [params.total]         - 文件总数 (all-done 时)
   * @param {string}  [params.outputPath]    - 输出目录 (all-done 时)
   * @param {string}  [params.error]         - 错误信息
   */
  constructor({ type, index, filename, progress, totalProgress, outputFile, total, outputPath, error }) {
    this.type = type
    if (index !== undefined) this.index = index
    if (filename !== undefined) this.filename = filename
    if (progress !== undefined) this.progress = progress
    if (totalProgress !== undefined) this.totalProgress = totalProgress
    if (outputFile !== undefined) this.outputFile = outputFile
    if (total !== undefined) this.total = total
    if (outputPath !== undefined) this.outputPath = outputPath
    if (error !== undefined) this.error = error
  }
}

// ========== 解密相关 VO ==========

/**
 * 支持格式列表响应
 */
class SupportedFormatsVO {
  /**
   * @param {Object} params
   * @param {string[]} params.formats - 支持的扩展名列表
   */
  constructor({ formats = [] }) {
    this.formats = formats
  }
}

/**
 * 解密文件结果
 */
class DecryptFileResultVO {
  /**
   * @param {Object} params
   * @param {string} params.outputPath     - 输出目录
   * @param {string} params.outputFileName - 输出文件名
   */
  constructor({ outputPath, outputFileName }) {
    this.outputPath = outputPath
    this.outputFileName = outputFileName
  }
}

module.exports = {
  WarehouseListVO,
  WarehouseItemVO,
  WarehouseCreateVO,
  WarehouseTracksVO,
  ImportResultVO,
  ScanResultVO,
  ScanFileItem,
  ConvertProgressEvent,
  SupportedFormatsVO,
  DecryptFileResultVO,
}
