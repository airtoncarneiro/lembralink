# LembraLink POC

Extensao Chrome para salvar paginas e reencontra-las por significado. Cada
usuario configura o proprio projeto Supabase e a propria chave Gemini; nenhum
segredo e distribuido com a extensao.

## Comece por aqui

Para criar seu proprio ambiente, siga o [guia de configuracao manual](docs/configuracao-manual.md).
Ele cobre, em ordem, Supabase Auth, banco com RLS, Gemini e Edge Function.

## Instalar uma versao publicada

Quando houver uma versao em **Releases** deste repositorio:

1. Baixe o arquivo `lembralink-extension-<versao>.zip` na secao **Assets**.
2. Descompacte-o. A pasta resultante deve conter `manifest.json` diretamente.
3. No Chrome, abra `chrome://extensions`, habilite **Modo do desenvolvedor** e
   clique em **Carregar sem compactacao**.
4. Selecione a pasta descompactada — nao o arquivo ZIP.
5. Abra a extensao e informe a URL e a chave publishable do seu proprio
   projeto Supabase.
6. Informe o email proprietario, copie o link recebido por email sem abri-lo e
   cole-o na extensao para entrar.
7. Abra uma pagina publica, use **Salvar esta pagina** e depois teste uma busca.

Esse modo e adequado para a POC. Uma versao nova exige baixar o ZIP novo,
descompactar e recarregar a extensao. O pacote nunca contem chave Gemini, JWT,
refresh token ou `service_role`.

## Compilar a extensao a partir do codigo-fonte

Esta secao e somente para quem clonou o repositorio e quer gerar uma versao
local da extensao. Quem baixou o ZIP de uma Release nao precisa executar estes
comandos.

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
supabase/             SQL e codigo da Edge Function copiados no Dashboard
extension/            codigo-fonte da extensao Chrome
extension/dist/       extensao compilada local (ignorada pelo Git)
```

## Seguranca

Nao inclua no repositorio chaves Gemini, arquivos `.env`, sessoes, exports de
favoritos ou texto de paginas privadas. Consulte a secao de encerramento seguro
no [guia de configuracao](docs/configuracao-manual.md).
