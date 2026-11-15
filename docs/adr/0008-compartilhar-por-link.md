# ADR 0008: Compartilhar um álbum por link

- Status: aceito
- Data: 2026-11-15

## Contexto

O usuário queria compartilhar um álbum com outras pessoas sem mudar a arquitetura (site estático, dados só no navegador, sem backend), transformando o conteúdo do álbum em um código e importando a partir de um link.

## Decisão

- O botão **🔗 Compartilhar** (no álbum aberto) gera um link do tipo `https://…/sleevebook/#compartilhar=<código>`. O código fica no **fragmento** da URL, que o navegador nunca envia a servidores; por isso funciona no GitHub Pages sem backend e sem expor os dados.
- **Formato** (`share.js`, versão 1): um JSON compacto com os dados do álbum (nome, jogo, linhas, colunas, páginas, cor) e uma lista de cartas, cada uma como uma lista curta `[página, linha, coluna, nome, set, número, total, fonte, sourceId, idioma, sinalizadores, quantidade, condição, foil, notas, imagem]`, com campos vazios no fim cortados. O JSON é comprimido com `CompressionStream('deflate-raw')` (nativo do navegador, sem biblioteca) e codificado em base64url.
- **Imagem abreviada:** o endereço do TCGdex (`https://assets.tcgdex.net/{idioma}/{série}/{set}/{número}/high.webp`) repete dados que já estão no `sourceId` e no idioma da carta. Quando segue esse padrão, o link guarda só `~{série}` e o app refaz o endereço ao abrir. Em um álbum de teste com 360 cartas, o código caiu de 7.607 para 5.878 caracteres (23% menos; sem nenhuma imagem seriam 5.570). Links antigos, com o endereço inteiro, continuam válidos.
- **O que vai:** álbum, cartas, posições, "tenho ou quero", condição, quantidade, foil e o endereço da imagem quando ela vem de um provedor conhecido. **Não vão:** fotos enviadas pelo usuário (`data:`, pesadas) e, por padrão, as **notas** (podem ser pessoais; há uma caixa "Incluir minhas notas").
- **Receber (revisado):** ao abrir o link (ou colá-lo com o app já aberto), o app decodifica, valida e abre o álbum **para visualização**, com um aviso "Álbum compartilhado: só para ver" e o livro funcionando normalmente (folhear, ver as cartas, foil). Nada é gravado: o álbum vive só na memória, o endereço continua sendo o do link (dá para recarregar ou copiar) e as ações de editar, mover, configurar e compartilhar ficam desativadas. Clicar numa carta abre uma janela só de leitura com os dados dela.
- **Adicionar:** somente os botões "Adicionar à biblioteca" (no aviso e na barra do álbum) gravam o álbum, **sempre como álbum novo**, com ids novos: nada do que já existe é sobrescrito. Sair da visualização (aba Biblioteca, Coleção, Wishlist ou Esc) descarta o álbum compartilhado e volta ao último álbum aberto. Importar um backup durante a visualização também a encerra.
- **Segurança:** o conteúdo do link é tratado como dado não confiável. O texto é limpo e limitado (nome 60, carta 100, notas 500), grade e páginas passam por `sanitizeLayout`, a cor precisa ser hexadecimal, jogo e fonte precisam existir, posições fora da grade ou repetidas são descartadas, e imagens só valem se forem `https` de provedores conhecidos (`assets.tcgdex.net`, `images.scrydex.com`, `images.pokemontcg.io`, `cards.scryfall.io`, `images.ygoprodeck.com`). Descompressão limitada a 2 MB e o link a 1,5 milhão de caracteres, contra "bomba de compressão".
- **Versão:** o código leva `v`. Links de uma versão mais nova que o app geram um aviso para recarregar.

## Consequências

- É uma **cópia**, não uma sincronização: mudanças feitas depois por quem enviou não chegam a quem importou.
- Quem tem o link vê o álbum inteiro, e não há como cancelar um link enviado. A tela avisa.
- O tamanho cresce com o número de cartas (cerca de 16 caracteres por carta no teste de 360 cartas com nomes variados (mais se os nomes forem longos)). Links grandes (acima de 8 mil caracteres) podem ser cortados por apps de mensagem; a tela avisa e sugere o arquivo de backup. Um link curto de verdade exigiria backend, fora do escopo (issues #16 a #18).
- Se o dono trocar o formato dos campos, é preciso subir `SHARE_VERSION` e manter a leitura da versão antiga.
