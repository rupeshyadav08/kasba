// Debug helper: shows what the pipeline sees on a page (status, iframes, PDF links, text).
// Usage: node pipeline/probe.mjs <url> [<url> ...]
const urls = process.argv.slice(2);
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: { From: 'admin@kasba.co.in', Accept: '*/*' } });
    const ct = r.headers.get('content-type'); const buf = Buffer.from(await r.arrayBuffer());
    console.log('\n=== ', u, '\nstatus', r.status, 'final', r.url, 'type', ct, 'bytes', buf.length);
    if (ct?.includes('pdf') || buf.slice(0,4).toString()==='%PDF') { console.log('PDF; first bytes', buf.slice(0,8).toString()); continue; }
    const h = buf.toString('utf8');
    console.log('iframes:', [...h.matchAll(/<iframe[^>]*src=["']([^"']+)/gi)].map(m=>m[1]).slice(0,5));
    console.log('pdf links:', [...h.matchAll(/(?:href|src|data)=["']([^"']*\.pdf[^"']*)/gi)].map(m=>m[1]).slice(0,8));
    console.log('scripts fetching:', [...h.matchAll(/(?:url|fetch|ajax)\s*[:(]\s*["']([^"']+)/gi)].map(m=>m[1]).slice(0,8));
    const body = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
    console.log('text len', body.length, '\ntext:', body.slice(0,700));
    const i = h.search(/class=["'][^"']*(content|innner|inner|press|tablebg|td2)/i); if (i>0) console.log('content-ish html:', h.slice(i, i+600));
  } catch (e) { console.log('\n=== ', u, 'ERROR', e.message); }
}
