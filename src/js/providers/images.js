// Imagens que faltam no TCGdex. Ele ainda não tem figura para vários sets e promos recentes (por exemplo, nenhuma
// das 112 cartas do set MEP). O CDN do Scrydex (https://images.scrydex.com) serve as mesmas cartas com endereços
// previsíveis e sem chave. Para cada carta sem imagem, testamos os endereços prováveis e usamos o primeiro que carregar.
// Observação: é um endereço de imagem, não uma API documentada; pode mudar sem aviso (ver ADR 0004).

const CDN = 'https://images.scrydex.com/pokemon';

/**
 * Endereços prováveis no Scrydex para um id do TCGdex.
 * O Scrydex escreve "sv5-10" onde o TCGdex escreve "sv05-010": sem zeros à esquerda no set e no número.
 */
export function scrydexCandidates(tcgdexId, size = 'small', lang = 'en') {
  const i = String(tcgdexId ?? '').lastIndexOf('-');
  if (i < 1) return [];
  const set = tcgdexId.slice(0, i), num = tcgdexId.slice(i + 1);
  const setNoPad = set.replace(/^([a-z]+)0+(?=\d)/i, '$1');
  const numNoPad = num.replace(/^0+(?=\d)/, '');
  // Cartas japonesas ficam em sets com sufixo "_ja" (ex.: s12a_ja-200). Só o japonês foi verificado.
  if (lang === 'ja') {
    const s = `${setNoPad.toLowerCase()}_ja`;
    return [...new Set([numNoPad, num])].map(n => `${CDN}/${s}-${n}/${size}`);
  }
  const sets = [...new Set([setNoPad, setNoPad.toLowerCase(), set])];
  const nums = [...new Set([numNoPad, num])];
  const out = [];
  for (const s of sets) for (const n of nums) out.push(`${CDN}/${s}-${n}/${size}`);
  return out.slice(0, 4);
}

/** Carrega a imagem de verdade (sem depender de CORS). Resolve true se carregou. */
export function probeImage(url, ms = 4000) {
  return new Promise(resolve => {
    const img = new Image();
    const done = ok => { clearTimeout(timer); img.onload = img.onerror = null; resolve(ok); };
    const timer = setTimeout(() => done(false), ms);
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;
  });
}

/**
 * Procura uma imagem que carregue para a carta, na ordem:
 * 1. Inglês e japonês: o Scrydex no próprio idioma.
 * 2. Outros idiomas (português, coreano…): a imagem em **inglês** da mesma carta, no Scrydex e, se a carta já
 *    tinha um endereço do TCGdex, o mesmo endereço trocando o idioma por "en". A arte é a mesma; o texto da carta
 *    é em inglês, então o resultado leva `imageFallback: 'en'`.
 * Devolve { url, fallback } ou null.
 */
export async function findImage(card, { probe = probeImage } = {}) {
  const lang = card.language ?? 'en';
  const own = lang === 'en' || lang === 'ja';
  const urls = scrydexCandidates(card.sourceId, 'small', own ? lang : 'en');
  if (!own && /assets\.tcgdex\.net\//.test(card.image || '')) urls.push(card.image.replace(`/${lang}/`, '/en/'));
  for (const url of urls) if (await probe(url)) return { url, fallback: own ? null : 'en' };
  return null;
}

/** Devolve a lista com `image` preenchida onde a carta veio sem imagem. As cartas são testadas em paralelo. */
export async function fillMissingImages(cards, { probe = probeImage } = {}) {
  return Promise.all(cards.map(async card => {
    if (card.image || card.source !== 'pokemon') return card;
    const found = await findImage(card, { probe });
    return found ? { ...card, image: found.url, ...(found.fallback ? { imageFallback: found.fallback } : {}) } : card;
  }));
}

/**
 * Conserta uma imagem que o TCGdex listou mas que não existe (404). Acontece, por exemplo, com o Luxio 61/192 da
 * Rixa Rebelde em português. Devolve a carta com outra imagem, ou com `image: ''` se não houver nenhuma.
 */
export async function repairImage(card, { probe = probeImage } = {}) {
  const found = card.source === 'pokemon' ? await findImage(card, { probe }) : null;
  const { imageFallback, ...rest } = card;
  return found ? { ...rest, image: found.url, ...(found.fallback ? { imageFallback: found.fallback } : {}) } : { ...rest, image: '' };
}
