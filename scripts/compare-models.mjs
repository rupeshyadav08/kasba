// Drafts the same recent notices with two models and writes a side-by-side report, so a model
// change is decided on real Kasba notices. Nothing is published or sent.
// Usage: node scripts/compare-models.mjs [count] [providerA] [providerB]   (default: 8 deepseek sarvam)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import { noticeText } from '../pipeline/lib/feeds.mjs';
import { complete, parseJson } from '../pipeline/lib/llm.mjs';
import { systemPrompt, userPrompt } from '../pipeline/lib/prompt.mjs';
import { check, districtSlugs } from '../pipeline/lib/story.mjs';

const [count = 8, a = 'deepseek', b = 'sarvam'] = process.argv.slice(2);
const config = JSON.parse(readFileSync('pipeline/config.json', 'utf8'));
const dir = 'src/content/stories/hi/';
const stories = readdirSync(dir).map((f) => parse(readFileSync(dir + f, 'utf8').split(/^---$/m)[1]))
  .filter((s) => s.source?.url).sort((x, y) => String(y.published).localeCompare(String(x.published)));
const system = systemPrompt(districtSlugs());

const out = [`# ${a} vs ${b} on ${count} recent notices`, ''];
const totals = { [a]: { ok: 0, secs: 0, tokens: 0 }, [b]: { ok: 0, secs: 0, tokens: 0 } };
let done = 0;
for (const s of stories) {
  if (done >= Number(count)) break;
  let text;
  try { text = (await noticeText(s.source.url)).text.slice(0, 12000); } catch { continue; }
  if (text.length < 200) continue;
  done++;
  const user = userPrompt({ name: s.source.name, title: s.source.title, link: s.source.url, text });
  out.push(`## ${done}. ${s.source.title}`, s.source.url, '');
  for (const p of [a, b]) {
    const t = Date.now();
    try {
      const { text: reply, usage } = await complete({ provider: p, model: config.models[p], system, user });
      const secs = (Date.now() - t) / 1000;
      const d = parseJson(reply);
      const problems = d.relevant ? check(d) : [];
      totals[p].secs += secs;
      totals[p].tokens += usage?.total_tokens ?? (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0);
      if (!problems.length) totals[p].ok++;
      out.push(`### ${p} (${secs.toFixed(0)} s${problems.length ? `, problems: ${problems.join(', ')}` : ''})`);
      if (!d.relevant) { out.push(`Not relevant: ${d.reason}`, ''); continue; }
      out.push(`**${d.hi?.title}**`, '', d.hi?.summary ?? '', '', ...(d.hi?.keyFacts ?? []).map((f) => `- ${f}`),
        d.deadline ? `\nDeadline: ${d.deadline.date} (${d.deadline.label_hi})` : '', '', `Category: ${d.category}, state: ${d.state ?? '-'}`, '');
    } catch (e) {
      out.push(`### ${p}: failed`, e.message.slice(0, 300), '');
    }
  }
}
out.splice(2, 0, ...[a, b].map((p) => `- ${p} (${config.models[p]}): ${totals[p].ok}/${done} drafts passed the checks, ${(totals[p].secs / done).toFixed(0)} s each, ${totals[p].tokens} tokens in total`), '');
writeFileSync('compare.md', out.join('\n'));
console.log(out.slice(0, 5).join('\n'));
