# ADR 0009: Link curto com um Worker opcional

- Status: aceito
- Data: 2026-11-15

## Contexto

O link de compartilhamento ([ADR 0008](0008-compartilhar-por-link.md)) carrega o álbum inteiro e chega a milhares de caracteres, o que incomoda em apps de mensagem. Um link curto não dá para derivar do longo (um hash não recupera o conteúdo): alguém precisa guardar o álbum. O usuário quer isso com limites ajustáveis e custo controlado.

## Decisão

- Um **Worker da Cloudflare com KV** (`worker/worker.js`), **opcional**: o app só mostra "Gerar link curto" se `SHORTLINK_API` (`src/js/config.js`) estiver preenchido; sem ele tudo continua como no ADR 0008.
- **Cifrado no navegador** (AES-GCM, 128 bits, `shortlink.js`): o Worker guarda só texto cifrado. A chave fica no fragmento do link (`#c=<id>.<chave>`), que não vai a servidores. O id tem 12 caracteres; o link final tem cerca de 50.
- **Limites em um só lugar** (`LIMITS`, topo de `worker.js`): tamanho máximo, prazo de vida do link (90 dias, sem renovar ao abrir), orçamento diário de gravações (800 de 1.000 do plano gratuito do KV; cada link gasta 2), cache de leitura (os links são imutáveis) e sites autorizados (CORS). Ao esgotar o orçamento, o Worker responde 429 e o app oferece o link longo.
- **Economia:** nada de renovar ao ler (seria uma gravação por leitura); respostas com `Cache-Control: immutable`; leituras do KV com `cacheTtl`; expiração automática por `expirationTtl`; limite de tamanho. `/stats` (protegido por `ADMIN_TOKEN`) mostra o consumo do dia.
- **Apagar:** quem cria recebe um código de exclusão, guardado em `localStorage` e só comparado por hash no Worker. O botão "Apagar link curto" remove o álbum do KV.
- **Falhas:** cota esgotada, álbum grande, rede fora do ar ou Worker removido viram mensagens em português que mandam usar o link longo ou o backup.
- O Worker é um arquivo único, sem dependências, que cola direto no editor do painel (passo a passo em `worker/README.md`). Os testes o executam no navegador com um KV simulado.

## Consequências

- Depende de uma conta e de um Worker mantidos pelo dono do projeto. O deploy não é automatizado e não foi testado contra a Cloudflare de verdade: só a lógica e o cliente têm testes (com KV simulado).
- A contagem diária usa KV (eventualmente consistente) e pode errar por poucas unidades; a folga de 200 gravações cobre.
- O link curto vale por cerca de 90 dias e depois deixa de abrir; o link longo não expira.
- Quem tem o link completo abre o álbum; quem tem só o id, não. Mas o link ainda não pode ser "desfeito" por quem o recebeu, só apagado por quem o criou, neste navegador.
- Se o limite do plano gratuito mudar, basta ajustar `LIMITS` e colar o arquivo de novo.
