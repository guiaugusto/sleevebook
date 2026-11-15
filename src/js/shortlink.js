// Link curto (ADR 0009): o código do álbum (o mesmo do link longo) é cifrado aqui no navegador com AES-GCM e só o
// texto cifrado vai para o Worker, que devolve um id curto. A chave de decifrar fica no fragmento do link
// (`#c=<id>.<chave>`), que nunca chega a nenhum servidor. Se o Worker falhar ou a cota do dia acabar, o app volta ao link longo.
import { encodePayload, decodePayload, parsePayload, buildPayload } from './share.js';

export const SHORT_PREFIX = '#c=';
const TOKENS_KEY = 'sleevebook-short-tokens';

const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('bad');
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0));
};

/** Erros do serviço de link curto, com um `code` para a tela decidir o que dizer. */
export class ShortLinkError extends Error { constructor(code, message) { super(message); this.code = code; } }

const MESSAGES = {
  quota: 'O limite de links curtos de hoje acabou. Use o link longo ou tente amanhã.',
  too_big: 'Este álbum é grande demais para o link curto. Use o link longo ou o arquivo de backup.',
  not_found: 'Este link curto não existe mais (pode ter expirado ou sido apagado).',
  network: 'Não foi possível falar com o serviço de links curtos. Use o link longo.',
  bad_link: 'Este link curto está incompleto ou corrompido.',
};
const fail = code => new ShortLinkError(code, MESSAGES[code] || MESSAGES.network);

const enc = async (text, key) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
  return b64u(new Uint8Array([...iv, ...ct]));
};
const dec = async (str, key) => {
  const bytes = unb64u(str);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, key, bytes.subarray(12)));
};

const readTokens = () => { try { return JSON.parse(localStorage.getItem(TOKENS_KEY)) || {}; } catch { return {}; } };
const writeTokens = t => { try { localStorage.setItem(TOKENS_KEY, JSON.stringify(t)); } catch { /* sem armazenamento: não dá para apagar depois */ } };
/** O link curto foi criado neste navegador (então dá para apagá-lo)? */
export const canDelete = id => !!readTokens()[id];

/**
 * Cifra o álbum, envia ao Worker e devolve `{ link, id }`. `api` é o endereço do Worker; `base` é o endereço do app.
 * Lança ShortLinkError (`quota`, `too_big`, `network`).
 */
export async function createShortLink(api, base, album, slots, cards, { includeNotes = false, fetchFn = fetch } = {}) {
  const code = await encodePayload(buildPayload(album, slots, cards, { includeNotes }));
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 128 }, true, ['encrypt', 'decrypt']);
  const body = await enc(code, key);
  let res;
  try { res = await fetchFn(`${api}/s`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body }); }
  catch { throw fail('network'); }
  if (res.status === 429) throw fail('quota');
  if (res.status === 413) throw fail('too_big');
  if (!res.ok) throw fail('network');
  const { id, token } = await res.json();
  writeTokens({ ...readTokens(), [id]: token });
  const k = b64u(new Uint8Array(await crypto.subtle.exportKey('raw', key)));
  return { id, link: `${base}${SHORT_PREFIX}${id}.${k}` };
}

/** Devolve o id e a chave se o hash for de link curto, senão null. */
export function shortFromHash(hash) {
  const m = typeof hash === 'string' && hash.startsWith(SHORT_PREFIX) ? /^([\w-]{12})\.([\w-]{22})$/.exec(hash.slice(SHORT_PREFIX.length)) : null;
  return m ? { id: m[1], key: m[2] } : null;
}
export const isShortHash = hash => typeof hash === 'string' && hash.startsWith(SHORT_PREFIX);

/** Busca no Worker, decifra aqui e valida como qualquer link de compartilhamento. */
export async function readShortLink(api, hash, { fetchFn = fetch, ...opts } = {}) {
  const parts = shortFromHash(hash);
  if (!parts) throw fail('bad_link');
  let res;
  try { res = await fetchFn(`${api}/s/${parts.id}`); } catch { throw fail('network'); }
  if (res.status === 404) throw fail('not_found');
  if (!res.ok) throw fail('network');
  let code;
  try {
    const key = await crypto.subtle.importKey('raw', unb64u(parts.key), 'AES-GCM', false, ['decrypt']);
    code = await dec(await res.text(), key);
  } catch { throw fail('bad_link'); }
  return parsePayload(await decodePayload(code), opts);
}

/** Apaga o link curto no Worker (só quem o criou neste navegador tem o código). */
export async function deleteShortLink(api, id, { fetchFn = fetch } = {}) {
  const tokens = readTokens();
  if (!tokens[id]) throw fail('bad_link');
  let res;
  try { res = await fetchFn(`${api}/s/${id}`, { method: 'DELETE', headers: { 'X-Delete-Token': tokens[id] } }); } catch { throw fail('network'); }
  if (!res.ok && res.status !== 404) throw fail('network');
  delete tokens[id];
  writeTokens(tokens);
}
