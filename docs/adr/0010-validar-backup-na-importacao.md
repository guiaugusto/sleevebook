# ADR 0010: Validar o conteúdo do backup na importação

- Status: aceito
- Data: 2026-11-15

## Contexto

`validateExport` (`store.js`) conferia só a estrutura do arquivo de backup (aplicativo, versão e listas). O conteúdo dos registros entrava no banco como veio. Um backup de origem desconhecida podia trazer ids com HTML, números no lugar de texto (e vice-versa), URLs de imagem com qualquer esquema, textos gigantes ou slots apontando para lugar nenhum. A revisão de segurança mostrou que isso era alcançável por XSS em algumas telas (corrigido na saída pelo PR [#58](https://github.com/guiaugusto/sleevebook/pull/58)), e deixava a importação como o último ponto sem validação de conteúdo, enquanto os links de compartilhamento já eram validados ([ADR 0008](0008-compartilhar-por-link.md)).

## Decisão

- Um módulo novo, `src/js/backup.js`, com `sanitizeBackup(raw)`, é executado **depois** de `validateExport` e **antes** de mostrar o diálogo de importação. A importação grava só o resultado limpo.
- Regras (as mesmas ideias de `share.js`, com as diferenças abaixo):
  - **Ids** (álbum, carta, wishlist): só letras, números, `_` e `-`, de 1 a 80 caracteres. Registro com id inválido é ignorado.
  - **Campos desconhecidos são descartados**; só os campos do modelo de dados passam (e `price`, o campo antigo, se for número).
  - **Textos** limitados (álbum 60, carta 100, set 80, número 20, notas 500, wishlist 300); caracteres de controle viram espaço.
  - **Números**: quantidade de 1 a 9999, total do set inteiro positivo, grade e folhas por `sanitizeLayout`, cor só hexadecimal. Valores fora do esperado viram o padrão.
  - **Listas fechadas**: jogo, fonte, condição, foil e idioma precisam existir; senão voltam ao padrão.
  - **Slots**: a chave é **refeita** a partir de álbum, página, linha e coluna; o slot precisa apontar para um álbum e uma carta que estão no backup; posição precisa ser inteira e dentro de 6 × 6 e 500 páginas; duplicados são descartados.
  - **Imagens**: foto enviada (`data:image/jpeg|png|webp|gif;base64`, até 2 MB) ou endereço `http(s)` de até 2000 caracteres. **Qualquer site** é aceito, ao contrário do link de compartilhamento (que só aceita provedores conhecidos), porque a pessoa pode ter digitado o endereço de uma imagem em qualquer lugar. `javascript:`, `data:text/html`, SVG e outros esquemas são descartados.
  - **Limites**: 500 álbuns, 100 mil cartas, 100 mil slots e 20 mil itens de wishlist por arquivo; o que passar é cortado e contado. Arquivos acima de 60 MB são recusados antes de ler.
- O diálogo de importação diz quantos itens foram ignorados ("N item(ns) com dados inválidos serão ignorados"), e o que é ignorado não é gravado.
- Um backup exportado pelo próprio app passa sem perda e sem aviso (conferido por teste e no navegador).

## Consequências

- Registros corrompidos ou malformados deixam de entrar no banco, e a importação fica previsível. O custo é que dados legítimos fora do formato esperado (por exemplo, um id com espaço feito à mão) são ignorados, e a pessoa é avisada.
- É uma **lista de campos permitidos**: ao acrescentar um campo ao modelo de dados, é preciso incluí-lo em `backup.js` (e em `share.js`, se for compartilhado), senão ele é descartado na importação. Há testes que quebram se um campo conhecido for perdido.
- O escape na saída (`esc`) continua sendo a primeira linha de defesa; a validação é a segunda.
- Importar o backup de outra pessoa continua trazendo as cartas dela para o seu banco (no modo Mesclar, sobrescrevendo ids iguais), mas agora só com dados bem formados.
