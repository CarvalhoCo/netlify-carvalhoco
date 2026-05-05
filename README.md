# Site de Consulta de Precos (Adega Carvalho)

MVP de consulta publica com:

- Frontend estatico (Netlify)
- Busca com dropdown
- Netlify Function como proxy seguro para o backend

## Estrutura

- `public/index.html`: pagina principal
- `public/app.js`: logica da busca/dropdown
- `netlify/functions/buscar-precos.mjs`: funcao servidor
- `netlify.toml`: publicacao e rota da funcao

## Fluxo

1. Usuario digita no campo de busca
2. Front chama `GET /api/precos?termo=...`
3. Redirect do Netlify envia para `/.netlify/functions/buscar-precos`
4. Function chama seu backend e devolve apenas `nome` e `precoVenda`

## Variaveis de ambiente (Netlify)

Defina no painel do Netlify (escopo `Functions`):

- `BACKEND_BASE_URL`: URL base da sua API
  - Exemplo: `https://adegacarvalho.com.br`
- `BACKEND_SEARCH_PATH`: caminho do endpoint de busca publica
  - Padrao: `/api/publico/produtos/buscar`
- `BACKEND_AUTH_HEADER`: nome do header de autenticacao da function para backend
  - Padrao: `x-public-api-token`
- `BACKEND_PUBLIC_TOKEN`: token secreto da function para backend

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
```

## Checklist de go-live

1. Backend `pdv` atualizado com a rota `/api/publico/produtos/buscar`.
2. `.env` do backend com `PUBLICO_PRODUTOS_TOKEN` e `PUBLICO_PRODUTOS_HEADER`.
3. Site no Netlify com as 4 variaveis (`BACKEND_*`) configuradas.
4. Deploy do backend e deploy do Netlify finalizados.
5. Teste manual:
   - Digitar parte do nome do produto na barra de busca.
   - Confirmar dropdown com `nome` e `precoVenda`.
6. Teste de seguranca:
   - Acessar endpoint backend sem header de token deve responder `401`.
