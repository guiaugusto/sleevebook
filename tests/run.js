// Mini runner de testes para o navegador. Sem dependências.
const out = document.getElementById('results');
const queue = [];
let failed = 0, passed = 0;

export const test = (name, fn) => queue.push({ name, fn });
export function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg} esperado ${e}, recebido ${a}`.trim());
}
export function ok(cond, msg = 'condição falsa') { if (!cond) throw new Error(msg); }

export async function runAll() {
  for (const { name, fn } of queue) {
    const li = document.createElement('li');
    try { await fn(); passed++; li.className = 'pass'; li.textContent = '✔ ' + name; }
    catch (e) { failed++; li.className = 'fail'; li.textContent = `✘ ${name}: ${e.message}`; }
    out.appendChild(li);
  }
  document.getElementById('summary').textContent = `${passed} passaram, ${failed} falharam`;
  document.title = failed ? 'FALHOU' : 'OK';
  window.__done = { passed, failed };
}
