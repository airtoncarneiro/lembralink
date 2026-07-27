# Smart Bookmarks POC

Extensao Chrome para salvar paginas e reencontra-las por significado. Cada
usuario configura o proprio projeto Supabase e a propria chave Gemini; nenhum
segredo e distribuido com a extensao.

## O que a POC faz

- login por link enviado por email pelo Supabase;
- captura consentida do texto da pagina aberta;
- resumo, classificacao e embedding com Gemini;
- busca semantica, exclusao e registro de ultimo acesso;
- configuracao local da URL e chave publishable de cada projeto Supabase.

## Comece por aqui

Para criar seu proprio ambiente, siga o [guia de configuracao manual](docs/configuracao-manual.md).
Ele cobre, em ordem, Supabase Auth, banco com RLS, Gemini, Edge Function e a
configuracao da extensao no Chrome.

## Instalar uma versao publicada

Quando houver uma versao em **Releases** deste repositorio:

1. Baixe o arquivo `smart-bookmarks-extension-<versao>.zip` na secao **Assets**.
2. Descompacte-o. A pasta resultante deve conter `manifest.json` diretamente.
3. No Chrome, abra `chrome://extensions`, habilite **Modo do desenvolvedor** e
   clique em **Carregar sem compactacao**.
4. Selecione a pasta descompactada — nao o arquivo ZIP.
5. Abra a extensao e informe a URL e a chave publishable do seu proprio
   projeto Supabase.

Esse modo e adequado para a POC. Uma versao nova exige baixar o ZIP novo,
descompactar e recarregar a extensao. O pacote nunca contem chave Gemini, JWT,
refresh token ou `service_role`.

## Desenvolver a extensao

```bash
cd extension
npm install
npm run build
```

Depois carregue `extension/dist` no Chrome. A pasta `dist` e um artefato local:
ela fica no seu disco, mas nao e enviada ao Git.

## Estrutura

```text
docs/                 guia unico de configuracao manual
extension/            codigo-fonte da extensao Chrome
extension/dist/       extensao compilada local (ignorada pelo Git)
```

## Seguranca

Nao inclua no repositorio chaves Gemini, arquivos `.env`, sessoes, exports de
favoritos ou texto de paginas privadas. Consulte a secao de encerramento seguro
no [guia de configuracao](docs/configuracao-manual.md).
