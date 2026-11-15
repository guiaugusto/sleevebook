// Worker do Cloudflare para os links curtos do Sleevebook (ADR 0009).
// Guarda apenas o álbum JÁ CIFRADO pelo navegador (a chave nunca chega aqui) em um KV, e devolve um id curto.
// Todos os limites estão em LIMITS, no topo: para apertar ou afrouxar o uso (e o custo), edite só esse bloco.
// Funciona colado inteiro no editor do painel da Cloudflare (sem precisar instalar nada) e também em testes.

export const LIMITS = {
  maxBodyBytes: 120_000,            // tamanho máximo do álbum cifrado (um fichário cheio fica em torno de 10 mil)
  ttlSeconds: 90 * 24 * 3600,       // quanto tempo o link vive (90 dias). Não renova ao abrir: renovar custaria uma gravação por leitura
  dailyWriteBudget: 800,            // gravações por dia que podemos gastar. O plano gratuito do KV permite 1.000; sobra margem
  writesPerCreate: 2,               // criar um link grava 2 vezes: o álbum e o contador do dia
  readCacheSeconds: 86400,          // o link é imutável: navegadores e a borda da Cloudflare podem guardar a resposta
  allowedOrigins: ['https://guiaugusto.github.io', 'http://localhost:8791'],   // sites autorizados a usar o Worker
};

const ID = /^[\w-]{12}$/;
const B64URL = /^[A-Za-z0-9_-]+$/;
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rand = n => b64u(crypto.getRandomValues(new Uint8Array(n)));
const sha = async s => b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
const dayKey = now => 'w:' + new Date(now).toISOString().slice(0, 10);

/** Processa uma requisição. `env.LINKS` é o KV; `env.ADMIN_TOKEN` (opcional) libera /stats. */
export async function handle(request, env, { limits = LIMITS, now = Date.now() } = {}) {
  const origin = request.headers.get('Origin');
  const allowed = !origin || limits.allowedOrigins.includes(origin);
  const cors = origin && allowed ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, DELETE', 'Access-Control-Allow-Headers': 'X-Delete-Token, Authorization, Content-Type', Vary: 'Origin' } : { Vary: 'Origin' };
  const out = (body, status = 200, extra = {}) => new Response(body, { status, headers: { ...cors, ...extra } });
  const json = (obj, status = 200) => out(JSON.stringify(obj), status, { 'Content-Type': 'application/json' });
  if (!allowed) return json({ error: 'origin' }, 403);
  if (request.method === 'OPTIONS') return out(null, 204);

  const url = new URL(request.url);
  const used = async () => Number(await env.LINKS.get(dayKey(now))) || 0;

  if (request.method === 'POST' && url.pathname === '/s') {
    const body = await request.text();
    if (!body || !B64URL.test(body)) return json({ error: 'invalid' }, 400);
    if (body.length > limits.maxBodyBytes) return json({ error: 'too_big', max: limits.maxBodyBytes }, 413);
    const today = await used();
    if (today + limits.writesPerCreate > limits.dailyWriteBudget) return json({ error: 'quota' }, 429);   // o app oferece o link longo
    const id = rand(9), token = rand(16);
    await env.LINKS.put('s:' + id, JSON.stringify({ b: body, t: await sha(token) }), { expirationTtl: limits.ttlSeconds });
    await env.LINKS.put(dayKey(now), String(today + limits.writesPerCreate), { expirationTtl: 2 * 86400 });
    return json({ id, token, ttlDays: Math.round(limits.ttlSeconds / 86400) }, 201);
  }

  const m = /^\/s\/([\w-]+)$/.exec(url.pathname);
  if (m && ID.test(m[1])) {
    const rec = await env.LINKS.get('s:' + m[1], { type: 'json', cacheTtl: 3600 });
    if (request.method === 'GET') {
      return rec ? out(rec.b, 200, { 'Content-Type': 'text/plain', 'Cache-Control': `public, max-age=${limits.readCacheSeconds}, immutable` })
        : json({ error: 'not_found' }, 404);
    }
    if (request.method === 'DELETE') {
      if (!rec) return json({ error: 'not_found' }, 404);
      if (await sha(request.headers.get('X-Delete-Token') || '') !== rec.t) return json({ error: 'forbidden' }, 403);
      await env.LINKS.delete('s:' + m[1]);
      return out(null, 204);
    }
  }

  if (request.method === 'GET' && url.pathname === '/stats' && env.ADMIN_TOKEN) {
    if (request.headers.get('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) return json({ error: 'forbidden' }, 403);
    const w = await used();
    return json({ day: dayKey(now).slice(2), writesUsed: w, writeBudget: limits.dailyWriteBudget, linksCreatedToday: w / limits.writesPerCreate, ttlDays: limits.ttlSeconds / 86400 });
  }
  return json({ error: 'not_found' }, 404);
}

export default { fetch: (request, env) => handle(request, env) };
