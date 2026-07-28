# LembraLink Local-first POC

Protótipo isolado da extensão LembraLink. Não usa Supabase, Gemini, login ou
chave de API. Os favoritos e seus vetores ficam somente no IndexedDB do perfil
atual do Chrome.

No primeiro salvamento ou busca, a extensão baixa o modelo aberto
`Xenova/paraphrase-multilingual-MiniLM-L12-v2` do Hugging Face (cerca de
113 MB). Depois disso, o conteúdo das páginas e as buscas são processados
localmente no navegador.

## Executar

```bash
npm install
npm run build
```

Em `chrome://extensions`, habilite o modo de desenvolvedor e carregue a pasta
`local-first-poc/dist` como extensão descompactada. Esta POC pode permanecer
instalada em paralelo com a extensão principal.

## Importar um lote de favoritos

1. No Gerenciador de favoritos do Chrome, exporte os favoritos em HTML.
2. Abra a POC e escolha o arquivo na seção **Importar favoritos**.
3. Comece com o limite padrão de 50 links e clique em **Autorizar e importar**.
4. Autorize o acesso aos sites do lote quando o Chrome solicitar.

A POC abre uma aba inativa por vez, extrai o texto, gera o embedding local e
fecha a aba ao terminar. O progresso e as falhas ficam no IndexedDB; fechar o
popup não apaga o lote. Links sem texto útil, indisponíveis ou protegidos por
login entram na lista de falhas para revisão.

## Limites deliberados

- Não há sincronização ou backup entre dispositivos/perfis.
- Limpar os dados do site/extensão remove os favoritos locais.
- O download inicial do modelo pode ser demorado e requer internet; após isso,
  o modelo fica no cache do navegador.
- A POC serve para avaliar qualidade, tamanho e tempo de processamento antes
  de qualquer integração com o produto principal.
