export interface CountryItem {
  code: string;
  name: string;
  flag: string;
}

export const ALL_COUNTRIES: CountryItem[] = [
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'CM', name: 'Cameroon', flag: '🇨🇲' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷' },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'EC', name: 'Ecuador', flag: '🇪🇨' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
  { code: 'EN', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺' },
  { code: 'IS', name: 'Iceland', flag: '🇮🇸' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'JM', name: 'Jamaica', flag: '🇯🇲' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳' },
  { code: 'RS', name: 'Serbia', flag: '🇷🇸' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'UY', name: 'Uruguay', flag: '🇺🇾' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'WA', name: 'Wales', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
];

export function resolveCountryFlagFile(countryOrCode?: string): string {
  if (!countryOrCode) return 'br.png';
  const clean = countryOrCode.trim().toLowerCase();

  // Special names / aliases
  if (clean === 'you' || clean === 'player' || clean === 'p1' || clean === '⭐') return 'br.png';
  if (clean === 'england' || clean === 'en' || clean.includes('🏴󠁧󠁢󠁥󠁮󠁧󠁿') || clean.includes('lions')) return 'gb-eng.png';
  if (clean === 'wales' || clean === 'wa' || clean.includes('🏴󠁧󠁢󠁷󠁬󠁳󠁿')) return 'gb-wls.png';
  if (clean === 'scotland' || clean === 'sco' || clean.includes('🏴󠁧󠁢󠁳󠁣󠁴󠁿')) return 'gb-sct.png';
  if (clean === 'northern ireland' || clean === 'nir') return 'gb-nir.png';
  if (clean === 'united kingdom' || clean === 'gb' || clean === 'uk' || clean.includes('🇬🇧')) return 'gb.png';
  if (clean === 'united states' || clean === 'usa' || clean === 'us' || clean.includes('🇺🇸')) return 'us.png';
  if (clean === 'south korea' || clean === 'korea' || clean === 'kr' || clean.includes('🇰🇷')) return 'kr.png';
  if (clean === 'south africa' || clean === 'za' || clean.includes('🇿🇦')) return 'za.png';
  if (clean === 'saudi arabia' || clean === 'sa' || clean.includes('🇸🇦')) return 'sa.png';
  if (clean === 'czech republic' || clean === 'cz' || clean.includes('🇨🇿')) return 'cz.png';
  if (clean === 'costa rica' || clean === 'cr' || clean.includes('🇨🇷')) return 'cr.png';
  if (clean === 'new zealand' || clean === 'nz' || clean.includes('🇳🇿')) return 'nz.png';

  // Check matching CountryItem by name or code
  const item = ALL_COUNTRIES.find(
    (c) => c.code.toLowerCase() === clean || c.name.toLowerCase() === clean || clean.includes(c.name.toLowerCase())
  );
  if (item) {
    if (item.code.toLowerCase() === 'en') return 'gb-eng.png';
    if (item.code.toLowerCase() === 'wa') return 'gb-wls.png';
    return `${item.code.toLowerCase()}.png`;
  }

  // If clean is a 2-letter code, try it directly
  if (/^[a-z]{2}$/.test(clean)) {
    return `${clean}.png`;
  }

  return 'br.png';
}

export function getCountryFlagUrl(countryOrCode?: string): string {
  const file = resolveCountryFlagFile(countryOrCode);
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  return `${base}CountryFlags/${file}`;
}
