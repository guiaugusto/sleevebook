# ADR 0007: Biblioteca de fichários como tela inicial

- Status: aceito
- Data: 2026-11-15

## Contexto

O app abria direto no último álbum, com um seletor no topo para trocar de álbum. Para quem tem vários fichários, isso esconde a coleção: o usuário queria ver todos os fichários ao mesmo tempo, como numa estante, e abrir um com a sensação de "chegar perto" dele.

## Decisão

- A tela inicial passou a ser a **Biblioteca** (`library.js`): uma prateleira com todos os fichários em pé, virados para a frente. Cada capa usa a cor do álbum (as mesmas variáveis do livro), tem o nome, a **proporção da capa dura real** da grade dele (`coverRatio` em `grid.js`) e uma borda de páginas cuja espessura cresce com o número de folhas. Embaixo, a legenda mostra as cartas que tenho, as que faltam e as folhas. O cartão "Novo fichário" cria um álbum e abre a configuração.
- **Abrir**: a capa da prateleira é clonada e "voa" até o retângulo exato que a capa fechada tem no livro (Web Animations API, `transform` com translate e escala, 650 ms), enquanto a biblioteca some com um leve zoom. O álbum é mostrado invisível antes, só para medir o destino. Ao fim, o livro fechado aparece no lugar, como era antes.
- **Voltar** (botão "← Biblioteca" ou Esc): fecha o livro (se estiver aberto), e a capa faz o caminho inverso até a prateleira.
- O seletor de álbum e o botão "＋ Novo" do topo saíram; as abas viram **Biblioteca, Coleção e Wishlist**. O endereço `#album` abre o último álbum direto, sem animação. Excluir um álbum volta para a biblioteca.
- As medidas do livro (carta 63×88, espaços, margem, capa dura) foram para `UNITS` em `grid.js`, usadas pelo livro e pela biblioteca, para as duas ficarem sempre com a mesma proporção.

## Consequências

- Com "reduzir movimento" ativo, não há animação. Se a aba for para segundo plano no meio do voo, a animação tem tempo limite (duração + 600 ms) para a tela não ficar presa.
- A prateleira não agrupa em fileiras fixas: cada fichário tem a sua tábua e as linhas quebram conforme a largura da tela.
