// ========== 音乐仓库相关 DTO ==========

/**
 * 创建仓库请求
 */
class CreateWarehouseDTO {
  /**
   * @param {Object} params
   * @param {string} params.name - 仓库名称
   */
  constructor({ name }) {
    this.name = name
  }
}

/**
 * 导入文件请求
 */
class ImportFilesDTO {
  /**
   * @param {Object} params
   * @param {string[]} params.filePaths - 待导入文件路径列表
   */
  constructor({ filePaths }) {
    this.filePaths = filePaths
  }
}

// ========== 格式转换相关 DTO ==========

/**
 * 扫描文件请求
 */
class ScanFilesDTO {
  /**
   * @param {Object} params
   * @param {string[]} params.filePaths - 待扫描路径列表
   */
  constructor({ filePaths }) {
    this.filePaths = filePaths
  }
}

/**
 * 开始转换请求
 */
class StartConvertDTO {
  /**
   * @param {Object} params
   * @param {Array<{name: string, path: string, size: number}>} params.files - 待转换文件列表
   * @param {string} params.outputPath - 输出目录
   */
  constructor({ files, outputPath }) {
    this.files = files
    this.outputPath = outputPath
  }
}

// ========== 解密相关 DTO ==========

/**
 * 解密单文件请求
 */
class DecryptFileDTO {
  /**
   * @param {Object} params
   * @param {string} params.inputPath     - 输入文件路径
   * @param {string} params.outputPath    - 输出目录
   * @param {'mp3'|'flac'|'ogg'} [params.outputFormat] - 输出格式
   */
  constructor({ inputPath, outputPath, outputFormat = 'mp3' }) {
    this.inputPath = inputPath
    this.outputPath = outputPath
    this.outputFormat = outputFormat
  }
}

/**
 * 批量解密请求
 */
class StartDecryptDTO {
  /**
   * @param {Object} params
   * @param {Array<{name: string, path: string, size: number}>} params.files - 待解密文件列表
   * @param {string} params.outputPath - 输出目录
   */
  constructor({ files, outputPath }) {
    this.files = files
    this.outputPath = outputPath
  }
}

module.exports = {
  CreateWarehouseDTO,
  ImportFilesDTO,
  ScanFilesDTO,
  StartConvertDTO,
  DecryptFileDTO,
  StartDecryptDTO,
}
