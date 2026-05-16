/**
 * 任务记录（Task Record）
 */
class TaskRecord {
  /**
   * @param {Object} params
   * @param {string} params.id          - 任务ID
   * @param {string} params.trackId     - 关联的Track ID
   * @param {'DECRYPT'|'CONVERT'} params.taskType - 任务类型
   * @param {'PENDING'|'PROCESSING'|'SUCCESS'|'FAILED'} params.status - 状态
   * @param {string} [params.targetPath] - 转换/解密后的目标文件路径
   * @param {number} [params.progress]  - 进度百分比 0-100
   * @param {string} [params.error]     - 错误信息
   * @param {Date|string} [params.createdAt] - 创建时间
   * @param {Date|string} [params.updatedAt] - 更新时间
   */
  constructor({
    id, trackId, taskType, status = 'PENDING',
    targetPath = '', progress = 0, error = '',
    createdAt, updatedAt,
  }) {
    this.id = id
    this.trackId = trackId
    this.taskType = taskType
    this.status = status
    this.targetPath = targetPath
    this.progress = progress
    this.error = error
    this.createdAt = createdAt || new Date().toISOString()
    this.updatedAt = updatedAt || new Date().toISOString()
  }

  /**
   * 从 plain object 创建实例
   * @param {Object} obj
   * @returns {TaskRecord}
   */
  static from(obj) {
    return new TaskRecord(obj)
  }
}

module.exports = TaskRecord
