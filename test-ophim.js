const axios = require('axios');

async function testApi() {
  try {
    const res = await axios.get('https://ophim1.com/v1/api/danh-sach/phim-moi-cap-nhat', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Referer': 'https://ophim19.cc/',
        'Origin': 'https://ophim19.cc'
      }
    });
    console.log("Status:", res.status);
    console.log("Data:", JSON.stringify(res.data).substring(0, 200));
  } catch (err) {
    console.error("Error:", err.message);
  }
}
testApi();
