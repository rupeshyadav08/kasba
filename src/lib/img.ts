// Story pictures are 1200px wide (public/img/s). Lists use a 480px copy that the build
// makes in dist/img/t (see astro.config.mjs), so a phone on a slow line downloads a few
// kilobytes per card instead of the full picture. In `astro dev` there is no copy, so
// the full picture is used.
export const thumb = (src: string) => (import.meta.env.DEV ? src : src.replace('/img/s/', '/img/t/'));
