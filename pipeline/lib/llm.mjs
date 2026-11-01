// One function, three providers. Which one runs is set in pipeline/config.json.
export async function complete({ provider, model, system, user }) {
  if (provider === 'deepseek') {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model, temperature: 0.2, max_tokens: 8000, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return { text: data.choices[0].message.content, usage: data.usage };
  }
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model, max_tokens: 8000, temperature: 0.2,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return { text: data.content.map((c) => c.text ?? '').join(''), usage: data.usage };
  }
  // Zhipu's GLM speaks the OpenAI format. GLM_BASE_URL switches to bigmodel.cn for a mainland account.
  if (provider === 'glm') {
    const res = await fetch(`${process.env.GLM_BASE_URL ?? 'https://api.z.ai/api/paas/v4'}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GLM_API_KEY}` },
      body: JSON.stringify({
        model, temperature: 0.2, max_tokens: 8000, response_format: { type: 'json_object' }, thinking: { type: 'disabled' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!res.ok) throw new Error(`GLM ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return { text: data.choices[0].message.content, usage: data.usage };
  }
  throw new Error(`Unknown provider: ${provider}`);
}

// Models sometimes wrap JSON in ```json fences; take the outermost object.
export function parseJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('No JSON object in model reply');
  return JSON.parse(text.slice(start, end + 1));
}
