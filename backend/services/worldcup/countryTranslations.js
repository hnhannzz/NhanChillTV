const COUNTRY_TRANSLATIONS = {
  Algeria: 'Algeria',
  Argentina: 'Argentina',
  Australia: 'Úc',
  Austria: 'Áo',
  Belgium: 'Bỉ',
  'Bosnia and Herzegovina': 'Bosnia và Herzegovina',
  Brazil: 'Brazil',
  Canada: 'Canada',
  'Cape Verde': 'Cabo Verde',
  Colombia: 'Colombia',
  'Congo DR': 'CHDC Congo',
  Croatia: 'Croatia',
  Curaçao: 'Curaçao',
  Curacao: 'Curaçao',
  'Czech Republic': 'Séc',
  Ecuador: 'Ecuador',
  Egypt: 'Ai Cập',
  England: 'Anh',
  France: 'Pháp',
  Germany: 'Đức',
  Ghana: 'Ghana',
  Haiti: 'Haiti',
  Iran: 'Iran',
  Iraq: 'Iraq',
  'Ivory Coast': 'Bờ Biển Ngà',
  Japan: 'Nhật Bản',
  Jordan: 'Jordan',
  Mexico: 'Mexico',
  Morocco: 'Ma Rốc',
  Netherlands: 'Hà Lan',
  'New Zealand': 'New Zealand',
  Norway: 'Na Uy',
  Panama: 'Panama',
  Paraguay: 'Paraguay',
  Portugal: 'Bồ Đào Nha',
  Qatar: 'Qatar',
  'Saudi Arabia': 'Ả Rập Xê Út',
  Scotland: 'Scotland',
  Senegal: 'Senegal',
  'South Africa': 'Nam Phi',
  'South Korea': 'Hàn Quốc',
  Spain: 'Tây Ban Nha',
  Sweden: 'Thụy Điển',
  Switzerland: 'Thụy Sĩ',
  Tunisia: 'Tunisia',
  Turkey: 'Thổ Nhĩ Kỳ',
  Turkiye: 'Thổ Nhĩ Kỳ',
  Türkiye: 'Thổ Nhĩ Kỳ',
  Uruguay: 'Uruguay',
  USA: 'Mỹ',
  'United States': 'Mỹ',
  Uzbekistan: 'Uzbekistan',
};

function normalizeTranslationKey(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

const COUNTRY_TRANSLATION_INDEX = Object.entries(COUNTRY_TRANSLATIONS).reduce((acc, [key, value]) => {
  acc[normalizeTranslationKey(key)] = value;
  return acc;
}, {});

function translateCountry(name) {
  if (!name) return '';
  const trimmed = String(name).trim();
  return COUNTRY_TRANSLATION_INDEX[normalizeTranslationKey(trimmed)] || trimmed;
}

module.exports = {
  COUNTRY_TRANSLATIONS,
  normalizeTranslationKey,
  translateCountry,
};
