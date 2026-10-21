import type { Lang } from './i18n';

// Kasba's home state. Stories set `state: up` and `districts: [slug, ...]` with these slugs.
export const state = { code: 'up', hi: 'उत्तर प्रदेश', en: 'Uttar Pradesh' } as const;

// All 75 districts of Uttar Pradesh: [slug, Hindi, English].
const list: [string, string, string][] = [
  ['agra', 'आगरा', 'Agra'], ['aligarh', 'अलीगढ़', 'Aligarh'], ['ambedkar-nagar', 'अंबेडकर नगर', 'Ambedkar Nagar'],
  ['amethi', 'अमेठी', 'Amethi'], ['amroha', 'अमरोहा', 'Amroha'], ['auraiya', 'औरैया', 'Auraiya'],
  ['ayodhya', 'अयोध्या', 'Ayodhya'], ['azamgarh', 'आज़मगढ़', 'Azamgarh'], ['baghpat', 'बागपत', 'Baghpat'],
  ['bahraich', 'बहराइच', 'Bahraich'], ['ballia', 'बलिया', 'Ballia'], ['balrampur', 'बलरामपुर', 'Balrampur'],
  ['banda', 'बांदा', 'Banda'], ['barabanki', 'बाराबंकी', 'Barabanki'], ['bareilly', 'बरेली', 'Bareilly'],
  ['basti', 'बस्ती', 'Basti'], ['bhadohi', 'भदोही', 'Bhadohi'], ['bijnor', 'बिजनौर', 'Bijnor'],
  ['budaun', 'बदायूँ', 'Budaun'], ['bulandshahr', 'बुलंदशहर', 'Bulandshahr'], ['chandauli', 'चंदौली', 'Chandauli'],
  ['chitrakoot', 'चित्रकूट', 'Chitrakoot'], ['deoria', 'देवरिया', 'Deoria'], ['etah', 'एटा', 'Etah'],
  ['etawah', 'इटावा', 'Etawah'], ['farrukhabad', 'फ़र्रुख़ाबाद', 'Farrukhabad'], ['fatehpur', 'फ़तेहपुर', 'Fatehpur'],
  ['firozabad', 'फ़िरोज़ाबाद', 'Firozabad'], ['gautam-buddh-nagar', 'गौतम बुद्ध नगर (नोएडा)', 'Gautam Buddh Nagar (Noida)'],
  ['ghaziabad', 'ग़ाज़ियाबाद', 'Ghaziabad'], ['ghazipur', 'ग़ाज़ीपुर', 'Ghazipur'], ['gonda', 'गोंडा', 'Gonda'],
  ['gorakhpur', 'गोरखपुर', 'Gorakhpur'], ['hamirpur', 'हमीरपुर', 'Hamirpur'], ['hapur', 'हापुड़', 'Hapur'],
  ['hardoi', 'हरदोई', 'Hardoi'], ['hathras', 'हाथरस', 'Hathras'], ['jalaun', 'जालौन', 'Jalaun'],
  ['jaunpur', 'जौनपुर', 'Jaunpur'], ['jhansi', 'झाँसी', 'Jhansi'], ['kannauj', 'कन्नौज', 'Kannauj'],
  ['kanpur-dehat', 'कानपुर देहात', 'Kanpur Dehat'], ['kanpur-nagar', 'कानपुर नगर', 'Kanpur Nagar'], ['kasganj', 'कासगंज', 'Kasganj'],
  ['kaushambi', 'कौशांबी', 'Kaushambi'], ['kushinagar', 'कुशीनगर', 'Kushinagar'], ['lakhimpur-kheri', 'लखीमपुर खीरी', 'Lakhimpur Kheri'],
  ['lalitpur', 'ललितपुर', 'Lalitpur'], ['lucknow', 'लखनऊ', 'Lucknow'], ['maharajganj', 'महराजगंज', 'Maharajganj'],
  ['mahoba', 'महोबा', 'Mahoba'], ['mainpuri', 'मैनपुरी', 'Mainpuri'], ['mathura', 'मथुरा', 'Mathura'],
  ['mau', 'मऊ', 'Mau'], ['meerut', 'मेरठ', 'Meerut'], ['mirzapur', 'मिर्ज़ापुर', 'Mirzapur'],
  ['moradabad', 'मुरादाबाद', 'Moradabad'], ['muzaffarnagar', 'मुज़फ़्फ़रनगर', 'Muzaffarnagar'], ['pilibhit', 'पीलीभीत', 'Pilibhit'],
  ['pratapgarh', 'प्रतापगढ़', 'Pratapgarh'], ['prayagraj', 'प्रयागराज', 'Prayagraj'], ['raebareli', 'रायबरेली', 'Raebareli'],
  ['rampur', 'रामपुर', 'Rampur'], ['saharanpur', 'सहारनपुर', 'Saharanpur'], ['sambhal', 'संभल', 'Sambhal'],
  ['sant-kabir-nagar', 'संत कबीर नगर', 'Sant Kabir Nagar'], ['shahjahanpur', 'शाहजहाँपुर', 'Shahjahanpur'], ['shamli', 'शामली', 'Shamli'],
  ['shravasti', 'श्रावस्ती', 'Shravasti'], ['siddharthnagar', 'सिद्धार्थनगर', 'Siddharthnagar'], ['sitapur', 'सीतापुर', 'Sitapur'],
  ['sonbhadra', 'सोनभद्र', 'Sonbhadra'], ['sultanpur', 'सुल्तानपुर', 'Sultanpur'], ['unnao', 'उन्नाव', 'Unnao'],
  ['varanasi', 'वाराणसी', 'Varanasi'],
];

export const districts = list.map(([slug, hi, en]) => ({ slug, hi, en }));
export type District = (typeof districts)[number];
export const districtBySlug = (slug: string) => districts.find((d) => d.slug === slug);
export const districtSlugs = districts.map((d) => d.slug);

export const statePath = (lang: Lang) => (lang === 'hi' ? '/up' : '/en/up');
export const districtPath = (lang: Lang, slug: string) => (lang === 'hi' ? `/district/${slug}` : `/en/district/${slug}`);

// Districts sorted the way a reader of that language expects to scan them.
export const sortedDistricts = (lang: Lang) =>
  [...districts].sort((a, b) => a[lang].localeCompare(b[lang], lang === 'hi' ? 'hi' : 'en'));
