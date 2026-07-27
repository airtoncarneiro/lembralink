# Smart Bookmarks Extension POC

## Para quem vai testar a extensao compilada

Nao e necessario instalar Node.js. Siga o guia completo em
[`../docs/configuracao-manual.md`](../docs/configuracao-manual.md): ele ensina a
criar seu proprio Supabase, sua chave Gemini, a Edge Function e, por fim,
carregar a pasta `dist` no Chrome.

No Chrome, abra `chrome://extensions`, ative **Modo do desenvolvedor**, clique
em **Carregar sem compactacao** e selecione esta pasta `extension/dist`.

No primeiro uso, a extensao pede:

- URL do seu Supabase (`https://<project-ref>.supabase.co`);
- chave **publishable** (`sb_publishable_...`), nao a chave Gemini;
- similaridade minima, de 0 a 1 (padrao `0,55`);
- maximo de resultados, de 1 a 20 (padrao `10`).

O popup segue automaticamente o modo claro ou escuro definido no Chrome ou no
sistema operacional.

Para login, copie o link completo recebido por email e cole-o no popup, sem
abri-lo. Esse e o fluxo padrao do Supabase no plano gratuito; “Magic Link” e
apenas o nome tecnico desse link. O campo tambem aceita codigo numerico se o
projeto tiver sido personalizado para envia-lo. O Chrome fecha o popup ao trocar
de aba; ao reabri-lo, a extensao mantem o email e mostra o campo de codigo/link.

## Para desenvolvimento ou recompilacao

1. Instale e gere a extensao:

   ```bash
   npm install
   npm run build
   ```

2. No Chrome, abra `chrome://extensions`, habilite **Modo do desenvolvedor** e
   use **Carregar sem compactacao** apontando para `extension/dist`.

3. Abra o popup. Na tela **Configurar POC**, informe a URL e a chave
   publishable do seu projeto. A extensao pedira permissao do Chrome apenas
   para o dominio desse projeto e guardara os valores em `chrome.storage.local`.

   Nessa mesma tela, escolha a **similaridade minima** (de 0 a 1; padrao
   `0,55`) e o **maximo de resultados** (de 1 a 20; padrao `10`). A quantidade
   limita a busca enviada ao servico; a similaridade filtra o que sera exibido
   na extensao.

Para o POC, as `host_permissions` permitem que o service worker acesse somente
este projeto Supabase. Antes de qualquer distribuicao fora do POC, use o ID
exibido pelo Chrome para restringir CORS na Edge Function a
`chrome-extension://<ID>`.

## Segredos

`GEMINI_API_KEY`, `service_role`, JWT e refresh token nunca entram no projeto.
A URL Supabase e a chave publishable sao valores publicos que cada pessoa
configura localmente; nao sao embutidos no build.

## Contrato da Edge Function

O cliente chama `save`, `search`, `access` e `delete`. O bloco completo do
item 5 do [guia principal](../docs/configuracao-manual.md) implementa todas
essas operacoes desde a criacao do ambiente. Exclusao e acesso continuam
exigindo JWT, `OWNER_USER_ID` e RLS; um clique normal em um resultado registra
`last_accessed_at` antes de abrir a pagina.
