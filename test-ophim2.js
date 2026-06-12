const https = require('https');

https.get('https://ophim1.com/v1/api/danh-sach/phim-moi-cap-nhat', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Referer': 'https://ophim19.cc/',
    'Origin': 'https://ophim19.cc'
  }
}, (res) => {
  console.log("Status:", res.statusCode);
  res.on('data', d => console.log(d.toString().substring(0, 100)));
}).on('error', (e) => {
  console.error(e);
});
