export type Lang = 'hi' | 'en';

export const categories = {
  schemes: { hi: 'योजनाएँ', en: 'Schemes' },
  'jobs-exams': { hi: 'नौकरी-परीक्षा', en: 'Jobs & Exams' },
  farming: { hi: 'खेती', en: 'Farming' },
  money: { hi: 'पैसा', en: 'Money' },
  weather: { hi: 'मौसम', en: 'Weather' },
  health: { hi: 'सेहत', en: 'Health' },
  nation: { hi: 'देश', en: 'Nation' },
} as const;

export const t = {
  hi: {
    tagline: 'छोटे शहरों की बड़ी ख़बरें',
    meaning: 'आपके लिए इसका मतलब',
    keyFacts: 'मुख्य बातें',
    faq: 'सवाल-जवाब',
    source: 'स्रोत',
    viewSource: 'मूल सूचना देखें',
    latest: 'ताज़ा',
    minRead: 'मिनट',
    published: 'प्रकाशित',
    updated: 'अपडेट',
    correction: 'सुधार',
    home: 'होम',
    aiNote: 'यह ख़बर आधिकारिक सूचना से AI की मदद से लिखी गई और प्रकाशन से पहले संपादक ने जाँची।',
    aiNoteAuto: 'यह रोज़मर्रा की सूचना आधिकारिक स्रोत से AI की मदद से लिखी गई और अपने-आप छपी; संपादक इसे छपने के बाद जाँचते हैं।',
    reportError: 'गलती बताएँ',
    siteNote: 'हर ख़बर आधिकारिक स्रोत से, AI की मदद से लिखी जाती है। संपादक हर ख़बर मंज़ूर करते हैं; केवल रोज़मर्रा की सूचनाएँ अपने-आप छपती हैं और बाद में जाँची जाती हैं।',
    yourTown: 'आपका कस्बा',
    weather: 'आज का मौसम',
    mandi: 'मंडी भाव',
    briefing: 'कस्बा ब्रीफ़िंग',
    switchLang: 'EN',
    topStories: 'मुख्य ख़बरें',
    samjhiye: 'समझिए',
    more: 'और',
    moreIn: 'और ख़बरें',
    soon: 'इस विषय पर जल्द ख़बरें आएँगी।',
    sections: 'विषय',
    aboutKasba: 'कस्बा',
    policies: 'नीतियाँ',
    share: 'WhatsApp पर भेजें',
    addCalendar: 'कैलेंडर में जोड़ें',
    deadlines: 'आख़िरी तारीख़ें',
    deadlinesNote: 'फ़ॉर्म, फ़ीस, परीक्षा और योजनाओं की आने वाली अंतिम तिथियाँ, आधिकारिक सूचनाओं से।',
    noDeadlines: 'अभी कोई आने वाली आख़िरी तारीख़ नहीं है।',
    today: 'आज',
    daysLeft: (n: number) => (n === 1 ? 'कल' : `${n} दिन बाक़ी`),
    allDeadlines: 'सभी तारीख़ें',
    glossary: 'शब्दकोश',
    glossaryNote: 'सरकारी सूचनाओं में आने वाले शब्द, आसान हिंदी में।',
    checked: 'आधिकारिक सूचना से मिलाया',
    fromRecord: 'रिकॉर्ड से',
    fromRecordNote: 'यह ख़बर अदालत के फ़ैसले या आधिकारिक रिकॉर्ड पर आधारित है। इसमें केवल वही है जो रिकॉर्ड में लिखा है।',
    allDistricts: 'सभी ज़िले',
    chooseDistrict: 'अपना ज़िला चुनें',
    go: 'देखें',
    districtNews: (n: string) => `${n} की ख़बरें`,
    districtSoon: 'इस ज़िले की अपनी ख़बरें जल्द आएँगी। तब तक उत्तर प्रदेश और देश की ज़रूरी ख़बरें:',
    stateNews: 'पूरे प्रदेश की ख़बरें',
    nationNews: 'देश की ज़रूरी ख़बरें',
    stateSoon: 'उत्तर प्रदेश की ख़बरें जल्द आएँगी।',
    districtsLabel: 'ज़िले',
    localPapers: 'स्थानीय अख़बारों से',
    localPapersNote: 'ये सुर्खियाँ स्थानीय अख़बारों की हैं, कस्बा की नहीं। कस्बा ने इन्हें न लिखा है, न जाँचा है; पूरी ख़बर अख़बार की साइट पर पढ़ें।',
  },
  en: {
    tagline: 'Big news for small towns',
    meaning: 'What this means for you',
    keyFacts: 'Key facts',
    faq: 'Questions and answers',
    source: 'Source',
    viewSource: 'Read the original notice',
    latest: 'Latest',
    minRead: 'min read',
    published: 'Published',
    updated: 'Updated',
    correction: 'Correction',
    home: 'Home',
    aiNote: 'This story was drafted with AI from an official notice and checked by an editor before publishing.',
    aiNoteAuto: 'This routine notice was drafted with AI from an official source and published automatically; an editor reviews it after publishing.',
    reportError: 'Report an error',
    siteNote: 'Every story is drafted with AI from an official source. An editor approves each one, except routine notices, which publish automatically and are reviewed after.',
    yourTown: 'Your town',
    weather: "Today's weather",
    mandi: 'Mandi price',
    briefing: 'Kasba Briefing',
    switchLang: 'हिंदी',
    topStories: 'Top stories',
    samjhiye: 'Samjhiye: explainers',
    more: 'More',
    moreIn: 'More stories',
    soon: 'Stories in this section are coming soon.',
    sections: 'Sections',
    aboutKasba: 'Kasba',
    policies: 'Policies',
    share: 'Share on WhatsApp',
    addCalendar: 'Add to calendar',
    deadlines: 'Last dates',
    deadlinesNote: 'Upcoming last dates for forms, fees, exams and schemes, from official notices.',
    noDeadlines: 'No upcoming last dates right now.',
    today: 'Today',
    daysLeft: (n: number) => (n === 1 ? 'Tomorrow' : `${n} days left`),
    allDeadlines: 'All last dates',
    glossary: 'Glossary',
    glossaryNote: 'Words from official notices, in plain language.',
    checked: 'Checked against the official notice',
    fromRecord: 'From the record',
    fromRecordNote: 'This story is based on a court judgment or official record and reports only what the record says.',
    allDistricts: 'All districts',
    chooseDistrict: 'Choose your district',
    go: 'Go',
    districtNews: (n: string) => `News for ${n}`,
    districtSoon: 'Stories for this district are coming soon. Meanwhile, the key news for Uttar Pradesh and India:',
    stateNews: 'Across the state',
    nationNews: 'Key national news',
    stateSoon: 'Uttar Pradesh stories are coming soon.',
    districtsLabel: 'Districts',
    localPapers: 'From local papers (in Hindi)',
    localPapersNote: "These headlines are from local newspapers, not Kasba. Kasba did not write or check them; read the full story on the paper's site.",
  },
} as const;

// Order of sections in the navigation and on the homepage.
export const sectionOrder = ['schemes', 'jobs-exams', 'farming', 'money', 'weather', 'health', 'nation'] as const;
export type Section = (typeof sectionOrder)[number];
export const secColor = (c: string) => `--sec: var(--c-${c})`;
export const sectionPath = (lang: Lang, c: string) => (lang === 'hi' ? `/section/${c}` : `/en/section/${c}`);

export const storyPath = (lang: Lang, slug: string) =>
  lang === 'hi' ? `/story/${slug}` : `/en/story/${slug}`;

export const dateFmt = (lang: Lang, d: Date) =>
  new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  }).format(d);

// Devanagari reads slower than English, so Hindi uses a lower words-per-minute.
export const readMinutes = (text: string, lang: Lang) =>
  Math.max(1, Math.round(text.trim().split(/\s+/).length / (lang === 'hi' ? 160 : 220)));

// Whole days from today (India time) to a date; 0 means today.
export const daysUntil = (d: Date, now = new Date()) => {
  const day = (x: Date) => Date.parse(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(x));
  return Math.round((day(d) - day(now)) / 86400000);
};

// Google Calendar link for an all-day reminder on a last date.
export const calendarLink = (title: string, d: Date, details: string) => {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d).replace(/-/g, '');
  const next = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(d.getTime() + 86400000)).replace(/-/g, '');
  const q = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${ymd}/${next}`, details });
  return `https://calendar.google.com/calendar/render?${q}`;
};
