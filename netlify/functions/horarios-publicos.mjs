import { lerConfiguracaoHorarios, obterConfigPadrao } from "./_lib/horarios-store.mjs";

function responderJson(statusCode, payload) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export default async (request) => {
  if (request.method !== "GET") {
    return responderJson(405, { mensagem: "Metodo nao permitido." });
  }

  try {
    const configuracao = await lerConfiguracaoHorarios();
    return responderJson(200, configuracao);
  } catch {
    return responderJson(200, obterConfigPadrao());
  }
};
