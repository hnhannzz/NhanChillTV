const http = require('http');

http.get('http://127.0.0.1:3000/api/stream/active', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    if (json.data && json.data.length > 0) {
      const channelId = json.data[0].channelId;
      const authService = require('./services/authService');
      const token = authService.generateStreamToken('127.0.0.1', channelId);
      
      http.get(`http://127.0.0.1:3000/api/stream/hls/${token}/${channelId}/index.m3u8`, (res2) => {
        let m3u8Data = '';
        res2.on('data', chunk => m3u8Data += chunk);
        res2.on('end', () => {
          const lines = m3u8Data.split('\n');
          const tsFile = lines.find(l => l.endsWith('.ts'));
          if (tsFile) {
            console.log("Found TS file:", tsFile);
            http.get(`http://127.0.0.1:3000/api/stream/hls/${token}/${channelId}/${tsFile}`, (res3) => {
              console.log("TS status:", res3.statusCode);
              console.log("TS headers:", res3.headers);
              let size = 0;
              res3.on('data', chunk => size += chunk.length);
              res3.on('end', () => {
                console.log("TS file size fetched:", size);
              });
            });
          }
        });
      });
    }
  });
});
