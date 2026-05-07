import {
  lerConfiguracaoHorarios,
  normalizarConfiguracao,
  salvarConfiguracaoHorarios
} from "./_lib/horarios-store.mjs";

function responderJson(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function obterSenhaInformada(request) {
  const senhaHeader = String(request.headers.get("x-admin-password") ?? "").trim();
  if (senhaHeader) {
    return senhaHeader;
  }

  const autorizacao = String(request.headers.get("authorization") ?? "").trim();
  if (autorizacao.toLowerCase().startsWith("bearer ")) {
    return autorizacao.slice(7).trim();
  }

  return "";
}

function validarAcesso(request) {
  const senhaEsperada = String(process.env.ADMIN_PANEL_PASSWORD ?? "").trim();
  if (!senhaEsperada) {
    return {
      permitido: false,
      statusCode: 500,
      mensagem: "Configuracao ausente. Defina ADMIN_PANEL_PASSWORD no Netlify."
    };
  }

  const senhaInformada = obterSenhaInformada(request);
  if (!senhaInformada || senhaInformada !== senhaEsperada) {
    return {
      permitido: false,
      statusCode: 401,
      mensagem: "Senha invalida."
    };
  }

  return {
    permitido: true,
    statusCode: 200,
    mensagem: "ok"
  };
}

export default async (request) => {
  if (request.method !== "GET" && request.method !== "PUT") {
    return responderJson(405, { mensagem: "Metodo nao permitido." });
  }

  const acesso = validarAcesso(request);
  if (!acesso.permitido) {
    return responderJson(acesso.statusCode, { mensagem: acesso.mensagem });
  }

  if (request.method === "GET") {
    try {
      const configuracao = await lerConfiguracaoHorarios();
      return responderJson(200, configuracao);
    } catch {
      return responderJson(500, { mensagem: "Erro ao carregar configuracao de horarios." });
    }
  }

  try {
    const payload = await request.json();
    const configuracaoNormalizada = normalizarConfiguracao(payload);
    const configuracaoSalva = await salvarConfiguracaoHorarios(configuracaoNormalizada);
    return responderJson(200, configuracaoSalva);
  } catch {
    return responderJson(400, { mensagem: "Dados invalidos para salvar horarios." });
  }
};
