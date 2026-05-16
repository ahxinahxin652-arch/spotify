/**
 * 统一 API 响应包装
 *
 * 所有接口的返回值都通过此类包装，确保前端拿到的数据结构一致。
 *
 * @template T
 */
class ApiResult {
  /**
   * @param {Object} params
   * @param {boolean} params.success  - 请求是否成功
   * @param {T}      [params.data]    - 业务数据
   * @param {string} [params.message] - 提示信息
   * @param {string} [params.error]   - 错误信息
   */
  constructor({ success, data, message = '', error = '' }) {
    this.success = success
    this.data = data
    this.message = message
    this.error = error
  }

  /**
   * 成功响应
   * @template T
   * @param {T} data
   * @param {string} [message]
   * @returns {ApiResult<T>}
   */
  static ok(data, message = '') {
    return new ApiResult({ success: true, data, message })
  }

  /**
   * 失败响应
   * @param {string} error
   * @returns {ApiResult<null>}
   */
  static fail(error) {
    return new ApiResult({ success: false, error })
  }
}

module.exports = ApiResult
