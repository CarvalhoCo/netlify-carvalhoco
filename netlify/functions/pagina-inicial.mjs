import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { lerConfiguracaoHorarios } from "./_lib/horarios-store.mjs";
import {
  criarDadosEstruturadosLoja,
  serializarJsonLd
} from "./_lib/seo-horarios.mjs";

const CAMINHO_HTML = resolve(process.cwd(), "public", "index.html");
const PADRAO_JSON_LD = /(<script id="dados-estruturados-loja" type="application\/ld\+json">)\s*[\s\S]*?\s*(<\/script>)/;

export default async (request) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Método não permitido.", {
      status: 405,
      headers: { Allow: "GET, HEAD" }
    });
  }

  try {
    const [html, configuracao] = await Promise.all([
      readFile(CAMINHO_HTML, "utf8"),
      lerConfiguracaoHorarios()
    ]);
    const jsonLd = serializarJsonLd(criarDadosEstruturadosLoja(configuracao));
    const pagina = html.replace(PADRAO_JSON_LD, `$1\n      ${jsonLd}\n    $2`);

    return new Response(request.method === "HEAD" ? null : pagina, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=0, must-revalidate",
        "X-Robots-Tag": "index, follow"
      }
    });
  } catch {
    return new Response("Não foi possível carregar a página.", { status: 500 });
  }
};
