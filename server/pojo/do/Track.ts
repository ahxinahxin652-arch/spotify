class Track {
    id: string;           // UUID, 唯一主键
    libraryId: string;    // 外键，关联 MusicLibrary.id (注：如果一首歌可以属于多个歌单，这里需改为多对多关联表)
    title: string;        // 歌曲名称
    artist: string;       // 歌手
    album: string;        // 专辑名称
    duration: number;     // 歌曲时长（秒/毫秒）
    filePath: string;     // 本地物理绝对路径 (至关重要：播放、删除、转换都依赖此字段)
    format: string;       // 文件格式 (flac, mp3, kgm, ncm 等)
    fileSize: number;     // 文件大小 (Bytes)
    isEncrypted: boolean; // 是否为加密格式 (方便前端UI展示"需解密"标识)
    createdAt: Date;      // 录入时间
    updatedAt: Date;      // 更新时间
}