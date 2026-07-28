<p align="center">
  <img src="extension/public/icons/icon.svg" width="96" alt="Ícone do LembraLink" />
</p>

<h1 align="center">LembraLink</h1>

<p align="center">
  Salve links agora. Reencontre-os pelo significado depois.
</p>

<p align="center">
  <a href="docs/configuracao-manual.md"><strong>Configurar meu ambiente</strong></a>
  &nbsp;·&nbsp;
  <a href="#instalar-uma-versao-publicada">Instalar extensão</a>
  &nbsp;·&nbsp;
  <a href="#compilar-a-extensao-a-partir-do-codigo-fonte">Compilar código</a>
</p>

---

## Comece por aqui

| Seu objetivo | Caminho recomendado |
| --- | --- |
| Criar seu próprio Supabase e Gemini | Siga o [guia de configuração manual](docs/configuracao-manual.md). |
| Apenas testar uma versão pronta | Baixe o ZIP de uma Release e siga os passos abaixo. |
| Alterar o código da extensão | Clone o repositório e compile localmente. |

O guia manual cobre Supabase Auth, banco com RLS, Gemini e Edge Function. Cada
pessoa usa o próprio projeto e a própria chave Gemini.

## Modos de uso

Ao abrir a extensão, escolha um dos modos. **Local** é o caminho mais simples:
não exige conta, Supabase ou chave e processa os favoritos no navegador. Os
dados não são sincronizados para outro perfil ou computador. **Online** usa o
Supabase e Gemini configurados manualmente e mantém o fluxo de login e busca
remota já existente. Alternar o modo não mistura nem apaga as duas coleções.

Nos dois modos é possível importar um HTML exportado pelo Chrome. A extensão
abre os links em segundo plano, um por vez, e mostra o andamento. No modo
online a importação respeita o limite de chamadas configurado na Edge Function.

## Instalar uma versão publicada

> [!TIP]
> Este é o caminho para quem quer testar a extensão. Não requer Node.js nem
> compilação.

Quando houver uma versão em **Releases** deste repositório:

1. Baixe `lembralink-extension-<versao>.zip` na seção **Assets**.
2. Descompacte o arquivo. A pasta resultante deve conter `manifest.json`.
3. No Chrome, abra `chrome://extensions` e habilite **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta descompactada —
   não o arquivo ZIP.
5. Abra o LembraLink e informe a URL e a chave publishable do seu Supabase.
6. Informe o email proprietário, copie o link recebido por email sem abri-lo e
   cole-o na extensão para entrar.
7. Abra uma página pública, use **Salvar esta página** e depois faça uma busca.

> [!NOTE]
> Para atualizar, baixe o ZIP da nova versão, descompacte-o e recarregue a
> extensão em `chrome://extensions`.

## Compilar a extensão a partir do código-fonte

> [!IMPORTANT]
> Esta seção é somente para quem clonou o repositório e quer gerar uma versão
> local. Quem baixou o ZIP de uma Release não precisa executar estes comandos.

```bash
cd extension
npm install
npm run build
```

Depois, carregue `extension/dist` no Chrome. A pasta `dist` é um artefato local:
ela fica no seu disco, mas não é enviada ao Git.

## Estrutura do repositório

```text
docs/                 guia único de configuração manual
supabase/             SQL e Edge Function copiados no Dashboard
extension/            código-fonte da extensão Chrome
extension/dist/       extensão compilada local (ignorada pelo Git)
```

## Segurança

> [!CAUTION]
> Nunca inclua no repositório chaves Gemini, arquivos `.env`, sessões, exports
> de favoritos ou texto de páginas privadas.

Consulte o [encerramento seguro](docs/configuracao-manual.md#encerramento-seguro)
ao terminar os testes.
