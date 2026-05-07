const TAMANHO_MINIMO_BUSCA = 2;
const TAMANHO_MAXIMO_BUSCA = 60;
const LIMITE_RESULTADOS_BACKEND = 50;

function responderJson(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function obterConfiguracao() {
  const baseUrl = String(process.env.BACKEND_BASE_URL ?? "").trim();
  const caminhoBusca =
    String(process.env.BACKEND_SEARCH_PATH ?? "/api/publico/produtos/buscar").trim() ||
    "/api/publico/produtos/buscar";
  const nomeHeaderToken =
    String(process.env.BACKEND_AUTH_HEADER ?? "x-public-api-token").trim() ||
    "x-public-api-token";
  const tokenAcesso = String(process.env.BACKEND_PUBLIC_TOKEN ?? "").trim();

  return {
    baseUrl,
    caminhoBusca,
    nomeHeaderToken,
    tokenAcesso
  };
}

function validarTermoBusca(termoEntrada) {
  const termo = String(termoEntrada ?? "").trim();

  if (termo.length < TAMANHO_MINIMO_BUSCA) {
    return {
      valido: false,
      mensagem: `Informe pelo menos ${TAMANHO_MINIMO_BUSCA} caracteres.`
    };
  }

  if (termo.length > TAMANHO_MAXIMO_BUSCA) {
    return {
      valido: false,
      mensagem: `A busca aceita no maximo ${TAMANHO_MAXIMO_BUSCA} caracteres.`
    };
  }

  return {
    valido: true,
    termo
  };
}

function normalizarItemProduto(item) {
  const nome = String(item?.nome ?? "").trim();
  const precoVenda = Number(item?.precoVenda);

  if (!nome || !Number.isFinite(precoVenda)) {
    return null;
  }

  return {
    nome,
    precoVenda
  };
}

export default async (request) => {
  if (request.method !== "GET") {
    return responderJson(405, { mensagem: "Metodo nao permitido." });
  }

  const urlRequisicao = new URL(request.url);
  const validacao = validarTermoBusca(urlRequisicao.searchParams.get("termo"));

  if (!validacao.valido) {
    return responderJson(400, { mensagem: validacao.mensagem });
  }

  const configuracao = obterConfiguracao();

  if (!configuracao.baseUrl || !configuracao.tokenAcesso) {
    return responderJson(200, {
      items: []
    });
  }

  const urlBackend = new URL(configuracao.caminhoBusca, configuracao.baseUrl);
  urlBackend.searchParams.set("termo", validacao.termo);
  urlBackend.searchParams.set("limite", String(LIMITE_RESULTADOS_BACKEND));

  const headers = {
    Accept: "application/json"
  };

  headers[configuracao.nomeHeaderToken] = configuracao.tokenAcesso;

  const controladorTimeout = new AbortController();
  const timeout = setTimeout(() => controladorTimeout.abort(), 8000);

  try {
    const respostaBackend = await fetch(urlBackend, {
      method: "GET",
      headers,
      signal: controladorTimeout.signal
    });

    if (!respostaBackend.ok) {
      return responderJson(502, {
        mensagem: "Nao foi possivel consultar os precos agora."
      });
    }

    const dados = await respostaBackend.json().catch(() => null);

    const lista = Array.isArray(dados)
      ? dados
      : Array.isArray(dados?.items)
        ? dados.items
        : [];

    const items = lista.map(normalizarItemProduto).filter(Boolean);

    return responderJson(200, {
      items
    });
  } catch (erro) {
    const ehTimeout = erro?.name === "AbortError";

    return responderJson(502, {
      mensagem: ehTimeout
        ? "A consulta demorou muito. Tente novamente em instantes."
        : "Erro ao consultar o backend de precos."
    });
  } finally {
    clearTimeout(timeout);
  }
};
