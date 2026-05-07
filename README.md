# Site de Consulta de Precos (Adega Carvalho)

MVP de consulta publica com:

- Frontend estatico (Netlify)
- Busca com dropdown
- Netlify Function como proxy seguro para o backend

## Estrutura

- `public/index.html`: pagina principal
- `public/busca.html`: pagina dedicada para busca de produtos
- `public/admin.html`: painel admin de horarios (acesso via URL)
- `public/admin.js`: logica do painel admin
- `public/app.js`: logica da busca/dropdown
- `package.json`: dependencias das functions (inclui `@netlify/blobs`)
- `netlify/functions/buscar-precos.mjs`: funcao servidor
- `netlify/functions/horarios-publicos.mjs`: API publica de horarios
- `netlify/functions/horarios-admin.mjs`: API admin de horarios (protegida por senha)
- `netlify/functions/_lib/horarios-store.mjs`: persistencia/normalizacao dos horarios
- `netlify.toml`: publicacao e rota da funcao

## Fluxo

1. Usuario acessa a home e clica no botao da ferramenta de busca
2. Usuario digita no campo de busca em `busca.html`
3. Front chama `GET /api/precos?termo=...`
4. Redirect do Netlify envia para `/.netlify/functions/buscar-precos`
5. Function chama seu backend e devolve apenas `nome` e `precoVenda`

## Painel admin de horarios

- URL: `/admin.html`
- Protecao: senha via `ADMIN_PANEL_PASSWORD` (Netlify Functions)
- Permite:
  - editar horarios semanais (abertura/fechamento por dia)
  - criar sobrescritas por data
  - fechar loja em data especifica

### Persistencia dos horarios

- Em producao (Netlify): os horarios sao salvos no Netlify Blobs.
- Em desenvolvimento sem function (ex.: Live Server): o painel cai em modo local e salva no `localStorage` do navegador.
  - Senha local padrao: `1234` (pode ser alterada no `localStorage` pela chave `carvalho_admin_password`).

## Teste local (Live Server)

- No Live Server, a rota `/api/precos` nao existe.
- Para testar a busca localmente, rode com Netlify Dev (`netlify dev`) ou use um ambiente com as Functions/redirects ativos.

## Variaveis de ambiente (Netlify)

Defina no painel do Netlify (escopo `Functions`):

- `BACKEND_BASE_URL`: URL base da sua API
  - Exemplo: `https://adegacarvalho.com.br`
- `BACKEND_SEARCH_PATH`: caminho do endpoint de busca publica
  - Padrao: `/api/publico/produtos/buscar`
- `BACKEND_AUTH_HEADER`: nome do header de autenticacao da function para backend
  - Padrao: `x-public-api-token`
- `BACKEND_PUBLIC_TOKEN`: token secreto da function para backend
- `ADMIN_PANEL_PASSWORD`: senha do painel admin de horarios
- `ADMIN_HORARIOS_STORE_NAME`: nome do store no Netlify Blobs
  - Padrao: `carvalho-config`
- `ADMIN_HORARIOS_STORE_KEY`: chave da configuracao de horarios
  - Padrao: `horarios`

## Variaveis no backend (PDV)

No `.env` do backend `pdv`, configure:

```env
PUBLICO_PRODUTOS_TOKEN=troque-por-um-token-forte-e-longo
PUBLICO_PRODUTOS_HEADER=x-public-api-token
PUBLICO_RATE_LIMIT_JANELA_MS=60000
PUBLICO_RATE_LIMIT_MAX_REQUISICOES=180
```

Observacao:

- `PUBLICO_PRODUTOS_TOKEN` precisa ser exatamente o mesmo valor de `BACKEND_PUBLIC_TOKEN` no Netlify.
- `PUBLICO_PRODUTOS_HEADER` precisa bater com `BACKEND_AUTH_HEADER` no Netlify.

## Contrato esperado do backend

`GET /api/publico/produtos/buscar?termo=heineken`

Resposta esperada (array ou `{ items: [] }`):

```json
[
  { "nome": "Heineken 600ml", "precoVenda": 14.9 },
  { "nome": "Heineken Long Neck", "precoVenda": 9.5 }
]
```

A function sempre normaliza para:

```json
{
  "items": [
    { "nome": "...", "precoVenda": 0 }
  ]
}
```

## Deploy

1. Subir este projeto para um repo
2. Conectar no Netlify
3. Confirmar `publish = public` e `functions = netlify/functions`
4. Configurar as variaveis de ambiente
5. Publicar

## Bloco pronto (Netlify)

Use estes valores no painel do Netlify:

```env
BACKEND_BASE_URL=https://adegacarvalho.com.br
BACKEND_SEARCH_PATH=/api/publico/produtos/buscar
BACKEND_AUTH_HEADER=x-public-api-token
BACKEND_PUBLIC_TOKEN=mesmo-valor-do-PUBLICO_PRODUTOS_TOKEN
ADMIN_PANEL_PASSWORD=troque-por-uma-senha-forte
ADMIN_HORARIOS_STORE_NAME=carvalho-config
ADMIN_HORARIOS_STORE_KEY=horarios
```

## Checklist de go-live

1. Backend `pdv` atualizado com a rota `/api/publico/produtos/buscar`.
2. `.env` do backend com `PUBLICO_PRODUTOS_TOKEN` e `PUBLICO_PRODUTOS_HEADER`.
3. Site no Netlify com as variaveis (`BACKEND_*` e `ADMIN_*`) configuradas.
4. Deploy do backend e deploy do Netlify finalizados.
5. Teste manual:
   - Digitar parte do nome do produto na barra de busca.
   - Confirmar dropdown com `nome` e `precoVenda`.
6. Teste de seguranca:
   - Acessar endpoint backend sem header de token deve responder `401`.
