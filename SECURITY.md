# Política de segurança

## Versões cobertas

O Sleevebook é publicado de forma contínua a partir da `master`. Só a versão publicada em <https://guiaugusto.github.io/sleevebook/> recebe correções.

## Como reportar uma vulnerabilidade

**Não publique detalhes de uma falha em uma issue pública.**

- O relato privado do GitHub (aba *Security* → *Report a vulnerability*) **ainda não está ativado** neste repositório. Quando for ativado, será o canal preferido.
- Enquanto isso, abra uma issue **sem detalhes técnicos**, apenas dizendo que encontrou um problema de segurança e pedindo um contato privado. O mantenedor responde por um canal privado para receber o relato completo.

Ao reportar, ajuda incluir: o que acontece, como reproduzir, o impacto que você enxerga e o navegador usado.

## O que costuma ser relevante

- Execução de script ou injeção de HTML a partir de dados importados, de links de compartilhamento ou de respostas de APIs.
- Falhas no link curto: leitura do conteúdo de um álbum sem o link completo, apagar links de outras pessoas ou burlar os limites do Worker.
- Vazamento de dados do usuário para terceiros.

O mapa de ameaças, as proteções existentes e os pontos em aberto estão em [docs/06-seguranca-e-privacidade.md](docs/06-seguranca-e-privacidade.md).

## Segredos

Não há segredos no repositório. O `ADMIN_TOKEN` opcional do Worker é configurado como *Secret* no painel da Cloudflare. Se você encontrar uma chave ou senha no histórico do repositório, avise pelo canal acima.
