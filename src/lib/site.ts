import { states } from './places';
// Before launch the whole site is kept out of search results and shows a
// "coming soon" note. Set to false on launch day (after the samples are deleted).
export const prelaunch = false;

// Kasba as a news organisation, for structured data on the home page and as
// the publisher of every story. The policy links help search engines and AI
// answers judge the site as a trustworthy source.
export const org = {
  '@type': 'NewsMediaOrganization',
  '@id': 'https://kasba.co.in/#org',
  name: 'Kasba',
  alternateName: 'कस्बा',
  url: 'https://kasba.co.in',
  email: 'admin@kasba.co.in',
  logo: { '@type': 'ImageObject', url: 'https://kasba.co.in/logo-600x60.png', width: 600, height: 60 },
  areaServed: [...states.map((s) => ({ '@type': 'State', name: s.en })), { '@type': 'Country', name: 'India' }],
  knowsLanguage: ['hi', 'en'],
  publishingPrinciples: 'https://kasba.co.in/editorial-policy',
  correctionsPolicy: 'https://kasba.co.in/corrections',
  ethicsPolicy: 'https://kasba.co.in/code-of-ethics',
  verificationFactCheckingPolicy: 'https://kasba.co.in/sources-ai',
  actionableFeedbackPolicy: 'https://kasba.co.in/contact',
  contactPoint: { '@type': 'ContactPoint', contactType: 'grievance', email: 'admin@kasba.co.in', url: 'https://kasba.co.in/grievance' },
};
