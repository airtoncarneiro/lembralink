<p align="center">
  <img src="../extension/public/icons/icon.svg" width="72" alt="Ícone do LembraLink" />
</p>

# Configuração manual — LembraLink POC

Este guia cria um ambiente isolado para uma pessoa usar a extensao: um projeto
Supabase, uma chave Gemini e uma Edge Function propria. A instalacao da extensao
baixada por Release esta no [README](../README.md).

> [!IMPORTANT]
> Execute os itens na ordem. Os valores, usuários e chaves criados aqui devem
> pertencer ao seu próprio projeto Supabase e Google AI Studio.

## Roteiro para quem quer usar a extensão

| Etapa | Resultado |
| --- | --- |
| 1–2 | Projeto Supabase e usuário proprietário autenticado |
| 3 | Banco, RLS, busca e rate limit ativos |
| 4–5 | Gemini e Edge Function configurados |
| 6 | Salvamento e busca validados |

1. Crie o projeto e o usuário proprietário no Supabase (itens 1 e 2).
2. Crie banco, RLS, busca e rate limit (item 3).
3. Crie a chave Gemini e os secrets (item 4).
4. Publique a Edge Function (item 5).
5. Execute um teste de salvar e buscar (item 6).

---

## Antes de começar

Voce precisara de uma conta no [Supabase](https://supabase.com/dashboard), uma
conta no [Google AI Studio](https://aistudio.google.com/) e um email a que voce
tenha acesso. No macOS, `curl` e `python3` ja estao disponiveis.

Crie uma pasta local temporaria para os comandos abaixo. Ela nao pertence ao
repositorio e pode conter tokens temporarios:

```bash
mkdir -p ~/lembralink-poc
cd ~/lembralink-poc
```

> [!CAUTION]
> Nunca coloque chaves Gemini, JWTs, refresh tokens, `service_role` ou arquivos
> de exportação de favoritos no Git.

---

## 1. Criar e preparar o projeto Supabase

1. No Supabase, escolha **New project**, defina nome e senha de banco e espere
   o projeto ficar saudavel.
2. Em **Project Settings > API**, copie a **Project URL**
   (`https://<project-ref>.supabase.co`) e a chave **Publishable**
   (`sb_publishable_...`).
3. Em **Authentication > Providers**, deixe **Email** habilitado e permita
   novos cadastros ate criar o primeiro usuario.
4. Nao e necessario configurar uma opcao separada chamada Magic Link. O email
   padrao contem um link de confirmacao/acesso; basta copia-lo quando solicitado.

Defina estas variaveis somente no terminal atual:

```bash
export SB_URL='https://SEU_PROJECT_REF.supabase.co'
export SB_PUBLISHABLE_KEY='sb_publishable_SEU_VALOR'
export SB_EMAIL='seu-email@exemplo.com'
```

---

## 2. Criar o usuário proprietário e obter um JWT

Envie o primeiro email, permitindo que a conta seja criada:

```bash
curl --fail-with-body -sS -X POST "$SB_URL/auth/v1/otp" \
  -H "apikey: $SB_PUBLISHABLE_KEY" \
  -H 'Content-Type: application/json' \
  --data "{\"email\":\"$SB_EMAIL\",\"create_user\":true}"
```

Nao abra o link recebido. Copie-o e cole no comando abaixo; ele extrai o token
localmente e grava a sessao em `session.json`:

```bash
read -r 'SB_MAGIC_LINK?Cole o link recebido por email: '
export SB_TOKEN_HASH="$(python3 -c 'import sys, urllib.parse as u; print(u.parse_qs(u.urlparse(sys.argv[1]).query)["token"][0])' "$SB_MAGIC_LINK")"
export SB_VERIFY_TYPE="$(python3 -c 'import sys, urllib.parse as u; print(u.parse_qs(u.urlparse(sys.argv[1]).query)["type"][0])' "$SB_MAGIC_LINK")"
curl --fail-with-body -sS -X POST "$SB_URL/auth/v1/verify" \
  -H "apikey: $SB_PUBLISHABLE_KEY" \
  -H 'Content-Type: application/json' \
  --data "{\"token_hash\":\"$SB_TOKEN_HASH\",\"type\":\"$SB_VERIFY_TYPE\"}" > session.json
unset SB_MAGIC_LINK SB_TOKEN_HASH SB_VERIFY_TYPE
export SB_ACCESS_TOKEN="$(python3 -c 'import json; print(json.load(open("session.json"))["access_token"])')"
export SB_OWNER_USER_ID="$(python3 -c 'import json; print(json.load(open("session.json"))["user"]["id"])')"
chmod 600 session.json
```

Confirme a sessao e, depois, desabilite novos cadastros em
**Authentication > Providers > Email**:

```bash
curl --fail-with-body -sS "$SB_URL/auth/v1/user" \
  -H "apikey: $SB_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $SB_ACCESS_TOKEN"
```

---

## 3. Criar banco, RLS, busca e rate limit

No **SQL Editor > New query**, abra [schema.sql](../supabase/schema.sql), copie
todo o conteudo, cole no editor e clique **Run**. O arquivo ja cria a tabela,
RLS, permissoes, busca vetorial, exclusao e registro de ultimo acesso.

> [!TIP]
> O SQL não deve ser ajustado para uma POC nova. Ele já cria exclusão, registro
> de último acesso e as datas retornadas na busca.

Confirme que existem as tabelas `bookmarks` e `bookmark_rate_limits`. Em
**Database > Policies**, `bookmarks` deve ter RLS ativo e a politica criada pelo
script.

---

## 4. Criar chave Gemini e configurar secrets

1. No [Google AI Studio](https://aistudio.google.com/app/apikey), crie uma
   chave de API e copie-a.
2. Em **Edge Functions > Secrets** do Supabase, crie:

| Nome | Valor |
| --- | --- |
| `GEMINI_API_KEY` | chave criada no AI Studio |
| `OWNER_USER_ID` | valor de `SB_OWNER_USER_ID` |
| `RATE_LIMIT_SAVE_PER_MINUTE` | `5` |
| `RATE_LIMIT_SEARCH_PER_MINUTE` | `15` |
| `RATE_LIMIT_ACCESS_PER_MINUTE` | `60` |

Nao crie `SUPABASE_SERVICE_ROLE_KEY`. A funcao usa o JWT do usuario e RLS.

---

## 5. Criar a Edge Function manualmente

Em **Edge Functions > Deploy a new function**, use exatamente o nome
`bookmark-service`. Abra [index.ts](../supabase/functions/bookmark-service/index.ts),
copie todo o arquivo para o editor e clique **Deploy**.

Depois, em **Function configuration**, desligue **Verify JWT with legacy
secret** (em algumas telas: **Enforce JWT Verification**). A funcao valida o JWT
por `supabase.auth.getUser()` antes de executar qualquer operacao e continua
sujeita a RLS.

---

## 6. Testar salvar e buscar

Crie um texto publico com ao menos 200 caracteres:

```bash
cat > page.txt <<'EOF'
O Apache Parquet e um formato colunar para dados analiticos. Em workloads de
leitura, colunas permitem que mecanismos como Spark leiam apenas os atributos
necessarios, reduzindo transferencia e custo. O particionamento deve ser usado
com cuidado para evitar milhares de arquivos pequenos. Estatisticas por coluna
tambem permitem pular grupos de linhas que nao satisfazem um filtro.
EOF
export SB_CONTENT_JSON="$(python3 -c 'import json; print(json.dumps(open("page.txt").read()))')"
```

Salve o favorito:

```bash
curl --fail-with-body -sS -X POST "$SB_URL/functions/v1/bookmark-service" \
  -H "apikey: $SB_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $SB_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  --data "{\"action\":\"save\",\"title\":\"Parquet para analise de dados\",\"url\":\"https://example.com/parquet?utm_source=manual\",\"language\":\"pt-BR\",\"content\":$SB_CONTENT_JSON}"
```

Espere HTTP `201`. Depois pesquise usando outras palavras:

```bash
curl --fail-with-body -sS -X POST "$SB_URL/functions/v1/bookmark-service" \
  -H "apikey: $SB_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $SB_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"action":"search","query":"como diminuir a quantidade de dados lidos em consultas Spark?","limit":5}'
```

Espere HTTP `200`, o favorito em `results` e uma similaridade positiva.

---

## 7. Validar segurança e limites

> [!NOTE]
> Embora não seja necessário para instalar e usar a extensão, é **importante**
> executar estes testes antes de considerar a POC aprovada.

1. Repita a busca sem `Authorization`: espere `401`.
2. Com outro usuario autenticado, espere `403`, sem chamada ao Gemini.
3. Envie `content` com 199 caracteres: espere `400`.
4. Envie seis `save` no mesmo minuto: espere cinco `201` e um `429`.

**Sem token (`401`):**

```bash
curl -i -sS -X POST "$SB_URL/functions/v1/bookmark-service" \
  -H "apikey: $SB_PUBLISHABLE_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"action":"search","query":"formato colunar"}'
```

**Outro usuario (`403`):** habilite temporariamente novos cadastros, repita o
item 2 usando outro email e guarde o token em `SB_OTHER_ACCESS_TOKEN`. Em
seguida, desabilite os cadastros novamente e execute:

```bash
curl -i -sS -X POST "$SB_URL/functions/v1/bookmark-service" \
  -H "apikey: $SB_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $SB_OTHER_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"action":"search","query":"formato colunar"}'
```

**Conteudo curto (`400`):**

```bash
export SB_SHORT_CONTENT="$(python3 -c 'import json; print(json.dumps("x" * 199))')"
curl -i -sS -X POST "$SB_URL/functions/v1/bookmark-service" \
  -H "apikey: $SB_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer $SB_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  --data "{\"action\":\"save\",\"title\":\"Teste curto\",\"url\":\"https://example.com/short-content\",\"content\":$SB_SHORT_CONTENT}"
```

**Limite de save (`201` cinco vezes e `429` na sexta):** espere a virada de um
minuto antes de executar o lote.

```bash
for n in 1 2 3 4 5 6; do
  curl -sS -o /dev/null -w "save $n: HTTP %{http_code}\n" -X POST "$SB_URL/functions/v1/bookmark-service" \
    -H "apikey: $SB_PUBLISHABLE_KEY" \
    -H "Authorization: Bearer $SB_ACCESS_TOKEN" \
    -H 'Content-Type: application/json' \
    --data "{\"action\":\"save\",\"title\":\"Teste de limite $n\",\"url\":\"https://example.com/rate-limit-$n\",\"language\":\"pt-BR\",\"content\":$SB_CONTENT_JSON}"
done
```

---

## Encerramento seguro

Ao terminar, apague os arquivos de sessao e de teste da pasta temporaria:

```bash
rm -f session.json page.txt
unset SB_URL SB_PUBLISHABLE_KEY SB_EMAIL SB_ACCESS_TOKEN SB_OWNER_USER_ID SB_CONTENT_JSON
```

Antes de trocar modelo ou dimensao de embedding, reindexe todos os favoritos.

---

## Referências oficiais

- [Gemini Embeddings](https://ai.google.dev/gemini-api/docs/embeddings)
- [Gemini Structured Output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Seguranca de Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Email por link ou OTP no Supabase](https://supabase.com/docs/guides/auth/auth-email-passwordless)
