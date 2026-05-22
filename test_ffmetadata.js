const ffmetadata = require('ffmetadata');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmetadata.setFfmpegPath(ffmpegPath);

console.log("FFMPEG PATH:", ffmpegPath);
