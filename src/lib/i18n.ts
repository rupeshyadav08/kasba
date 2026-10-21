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
    reportError: 'गलती बताएँ',
    siteNote: 'हर ख़बर आधिकारिक स्रोत से, AI की मदद से लिखी जाती है और संपादक जाँचकर ही छापते हैं।',
    yourTown: 'आपका कस्बा',
    weather: 'आज का मौसम',
    mandi: 'मंडी भाव',
    briefing: 'कस्बा ब्रीफ़िंग',
    switchLang: 'EN',
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
    reportError: 'Report an error',
    siteNote: 'Every story is drafted with AI from an official source and checked by an editor before it is published.',
    yourTown: 'Your town',
    weather: "Today's weather",
    mandi: 'Mandi price',
    briefing: 'Kasba Briefing',
    switchLang: 'हिंदी',
  },
} as const;

export const storyPath = (lang: Lang, slug: string) =>
  lang === 'hi' ? `/story/${slug}` : `/en/story/${slug}`;

export const dateFmt = (lang: Lang, d: Date) =>
  new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  }).format(d);

// Devanagari reads slower than English, so Hindi uses a lower words-per-minute.
export const readMinutes = (text: string, lang: Lang) =>
  Math.max(1, Math.round(text.trim().split(/\s+/).length / (lang === 'hi' ? 160 : 220)));
