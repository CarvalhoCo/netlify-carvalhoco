import { lerConfiguracaoHorarios, obterConfigPadrao } from "./_lib/horarios-store.mjs";

const CABECALHOS_CACHE_HORARIOS_PUBLICOS = {
  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  "CDN-Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
  "Netlify-CDN-Cache-Control": "public, max-age=300, stale-while-revalidate=86400"
};

function responderJson(statusCode, payload, headersExtras = {}) {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headersExtras
    }
  });
}

export default async (request) => {
  if (request.method !== "GET") {
    return responderJson(405, { mensagem: "Metodo nao permitido." });
  }

  try {
    const configuracao = await lerConfiguracaoHorarios();
    return responderJson(200, configuracao, CABECALHOS_CACHE_HORARIOS_PUBLICOS);
  } catch {
    return responderJson(200, obterConfigPadrao(), CABECALHOS_CACHE_HORARIOS_PUBLICOS);
  }
};
