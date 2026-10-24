import type { Lang } from './i18n';

// The states Kasba covers. Stories set `state: <code>` and `districts: [slug, ...]` with the
// slugs below; slugs are unique across states. Each state's page lives at /<slug>.
// Uttar Pradesh, 75 districts: [slug, Hindi, English].
const up: [string, string, string][] = [
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

// Bihar, 38 districts.
const bihar: [string, string, string][] = [
  ['araria', 'अररिया', 'Araria'], ['arwal', 'अरवल', 'Arwal'], ['aurangabad', 'औरंगाबाद', 'Aurangabad'],
  ['banka', 'बांका', 'Banka'], ['begusarai', 'बेगूसराय', 'Begusarai'], ['bhagalpur', 'भागलपुर', 'Bhagalpur'],
  ['bhojpur', 'भोजपुर (आरा)', 'Bhojpur (Arrah)'], ['buxar', 'बक्सर', 'Buxar'], ['darbhanga', 'दरभंगा', 'Darbhanga'],
  ['east-champaran', 'पूर्वी चंपारण (मोतिहारी)', 'East Champaran (Motihari)'], ['gaya', 'गया', 'Gaya'], ['gopalganj', 'गोपालगंज', 'Gopalganj'],
  ['jamui', 'जमुई', 'Jamui'], ['jehanabad', 'जहानाबाद', 'Jehanabad'], ['kaimur', 'कैमूर (भभुआ)', 'Kaimur (Bhabua)'],
  ['katihar', 'कटिहार', 'Katihar'], ['khagaria', 'खगड़िया', 'Khagaria'], ['kishanganj', 'किशनगंज', 'Kishanganj'],
  ['lakhisarai', 'लखीसराय', 'Lakhisarai'], ['madhepura', 'मधेपुरा', 'Madhepura'], ['madhubani', 'मधुबनी', 'Madhubani'],
  ['munger', 'मुंगेर', 'Munger'], ['muzaffarpur', 'मुज़फ़्फ़रपुर', 'Muzaffarpur'], ['nalanda', 'नालंदा', 'Nalanda'],
  ['nawada', 'नवादा', 'Nawada'], ['patna', 'पटना', 'Patna'], ['purnia', 'पूर्णिया', 'Purnia'],
  ['rohtas', 'रोहतास (सासाराम)', 'Rohtas (Sasaram)'], ['saharsa', 'सहरसा', 'Saharsa'], ['samastipur', 'समस्तीपुर', 'Samastipur'],
  ['saran', 'सारण (छपरा)', 'Saran (Chhapra)'], ['sheikhpura', 'शेखपुरा', 'Sheikhpura'], ['sheohar', 'शिवहर', 'Sheohar'],
  ['sitamarhi', 'सीतामढ़ी', 'Sitamarhi'], ['siwan', 'सीवान', 'Siwan'], ['supaul', 'सुपौल', 'Supaul'],
  ['vaishali', 'वैशाली (हाजीपुर)', 'Vaishali (Hajipur)'], ['west-champaran', 'पश्चिमी चंपारण (बेतिया)', 'West Champaran (Bettiah)'],
];

// Madhya Pradesh, 55 districts.
const mp: [string, string, string][] = [
  ['agar-malwa', 'आगर मालवा', 'Agar Malwa'], ['alirajpur', 'अलीराजपुर', 'Alirajpur'], ['anuppur', 'अनूपपुर', 'Anuppur'],
  ['ashoknagar', 'अशोकनगर', 'Ashoknagar'], ['balaghat', 'बालाघाट', 'Balaghat'], ['barwani', 'बड़वानी', 'Barwani'],
  ['betul', 'बैतूल', 'Betul'], ['bhind', 'भिंड', 'Bhind'], ['bhopal', 'भोपाल', 'Bhopal'],
  ['burhanpur', 'बुरहानपुर', 'Burhanpur'], ['chhatarpur', 'छतरपुर', 'Chhatarpur'], ['chhindwara', 'छिंदवाड़ा', 'Chhindwara'],
  ['damoh', 'दमोह', 'Damoh'], ['datia', 'दतिया', 'Datia'], ['dewas', 'देवास', 'Dewas'],
  ['dhar', 'धार', 'Dhar'], ['dindori', 'डिंडोरी', 'Dindori'], ['guna', 'गुना', 'Guna'],
  ['gwalior', 'ग्वालियर', 'Gwalior'], ['harda', 'हरदा', 'Harda'], ['indore', 'इंदौर', 'Indore'],
  ['jabalpur', 'जबलपुर', 'Jabalpur'], ['jhabua', 'झाबुआ', 'Jhabua'], ['katni', 'कटनी', 'Katni'],
  ['khandwa', 'खंडवा', 'Khandwa'], ['khargone', 'खरगोन', 'Khargone'], ['maihar', 'मैहर', 'Maihar'],
  ['mandla', 'मंडला', 'Mandla'], ['mandsaur', 'मंदसौर', 'Mandsaur'], ['mauganj', 'मऊगंज', 'Mauganj'],
  ['morena', 'मुरैना', 'Morena'], ['narmadapuram', 'नर्मदापुरम', 'Narmadapuram'], ['narsinghpur', 'नरसिंहपुर', 'Narsinghpur'],
  ['neemuch', 'नीमच', 'Neemuch'], ['niwari', 'निवाड़ी', 'Niwari'], ['pandhurna', 'पांढुर्णा', 'Pandhurna'],
  ['panna', 'पन्ना', 'Panna'], ['raisen', 'रायसेन', 'Raisen'], ['rajgarh', 'राजगढ़', 'Rajgarh'],
  ['ratlam', 'रतलाम', 'Ratlam'], ['rewa', 'रीवा', 'Rewa'], ['sagar', 'सागर', 'Sagar'],
  ['satna', 'सतना', 'Satna'], ['sehore', 'सीहोर', 'Sehore'], ['seoni', 'सिवनी', 'Seoni'],
  ['shahdol', 'शहडोल', 'Shahdol'], ['shajapur', 'शाजापुर', 'Shajapur'], ['sheopur', 'श्योपुर', 'Sheopur'],
  ['shivpuri', 'शिवपुरी', 'Shivpuri'], ['sidhi', 'सीधी', 'Sidhi'], ['singrauli', 'सिंगरौली', 'Singrauli'],
  ['tikamgarh', 'टीकमगढ़', 'Tikamgarh'], ['ujjain', 'उज्जैन', 'Ujjain'], ['umaria', 'उमरिया', 'Umaria'],
  ['vidisha', 'विदिशा', 'Vidisha'],
];

// Delhi (NCT), 11 districts.
const delhi: [string, string, string][] = [
  ['central-delhi', 'मध्य दिल्ली', 'Central Delhi'], ['east-delhi', 'पूर्वी दिल्ली', 'East Delhi'], ['new-delhi', 'नई दिल्ली', 'New Delhi'],
  ['north-delhi', 'उत्तरी दिल्ली', 'North Delhi'], ['north-east-delhi', 'उत्तर-पूर्वी दिल्ली', 'North East Delhi'], ['north-west-delhi', 'उत्तर-पश्चिमी दिल्ली', 'North West Delhi'],
  ['shahdara', 'शाहदरा', 'Shahdara'], ['south-delhi', 'दक्षिणी दिल्ली', 'South Delhi'], ['south-east-delhi', 'दक्षिण-पूर्वी दिल्ली', 'South East Delhi'],
  ['south-west-delhi', 'दक्षिण-पश्चिमी दिल्ली', 'South West Delhi'], ['west-delhi', 'पश्चिमी दिल्ली', 'West Delhi'],
];

export const states = [
  { code: 'up', slug: 'up', hi: 'उत्तर प्रदेश', en: 'Uttar Pradesh', list: up },
  { code: 'bihar', slug: 'bihar', hi: 'बिहार', en: 'Bihar', list: bihar },
  { code: 'mp', slug: 'madhya-pradesh', hi: 'मध्य प्रदेश', en: 'Madhya Pradesh', list: mp },
  { code: 'delhi', slug: 'delhi', hi: 'दिल्ली', en: 'Delhi', list: delhi },
] as const;
export type StateCode = (typeof states)[number]['code'];
export const stateCodes = states.map((s) => s.code) as [StateCode, ...StateCode[]];
export const stateByCode = (code: string) => states.find((s) => s.code === code);

export const districts = states.flatMap((st) => st.list.map(([slug, hi, en]) => ({ slug, hi, en, state: st.code as StateCode })));
export type District = (typeof districts)[number];
export const districtBySlug = (slug: string) => districts.find((d) => d.slug === slug);
export const districtSlugs = districts.map((d) => d.slug);
export const districtsOf = (code: string) => districts.filter((d) => d.state === code);

export const statePath = (lang: Lang, code: string = 'up') => `${lang === 'hi' ? '' : '/en'}/${stateByCode(code)!.slug}`;
export const districtPath = (lang: Lang, slug: string) => (lang === 'hi' ? `/district/${slug}` : `/en/district/${slug}`);

// Districts sorted the way a reader of that language expects to scan them.
export const sortedDistricts = (lang: Lang, code?: string) =>
  (code ? districtsOf(code) : [...districts]).sort((a, b) => a[lang].localeCompare(b[lang], lang === 'hi' ? 'hi' : 'en'));
