const https = require('https');

function get(url) {
  https.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    }
  }, (res) => {
    console.log("Status for", url, ":", res.statusCode);
    res.on('data', d => console.log(d.toString().substring(0, 100)));
  });
}

get('https://ophim1.com/v1/api/phim/dau-la-dai-luc-2-tuyet-the-duong-mon');
get('https://ophim1.com/phim/dau-la-dai-luc-2-tuyet-the-duong-mon');
