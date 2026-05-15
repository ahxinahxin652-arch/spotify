class MusicLibrary {
    id: string;           // UUID, 唯一主键
    name: string;         // 音乐库名称 (例如："我的收藏", "运动歌单")
    description: string;  // 描述信息 (可选)
    coverPath: string;    // 封面图片的本地路径或Base64
    createdAt: Date;      // 创建时间
    updatedAt: Date;      // 更新时间
}