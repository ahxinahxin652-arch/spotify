class TaskRecord {
    id: string;           // 任务ID
    trackId: string;      // 关联的Track ID
    taskType: string;     // 任务类型: 'DECRYPT' | 'CONVERT'
    status: string;       // 状态: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED'
    targetPath: string;   // 转换/解密后的目标文件路径
}