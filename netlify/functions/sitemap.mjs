import { lerConfiguracaoHorarios } from "./_lib/horarios-store.mjs";
import { dataAtualizacaoValida } from "./_lib/seo-horarios.mjs";

function escaparXml(valor) {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export default async (request) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Método não permitido.", {
      status: 405,
      headers: { Allow: "GET, HEAD" }
    });
  }

  const configuracao = await lerConfiguracaoHorarios();
  const atualizacao = dataAtualizacaoValida(configuracao.updatedAt);
  const lastmod = atualizacao ? `\n    <lastmod>${escaparXml(atualizacao)}</lastmod>` : "";
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://adegacarvalho.com/</loc>${lastmod}
  </url>
  <url>
    <loc>https://adegacarvalho.com/busca</loc>
  </url>
</urlset>`;

  return new Response(request.method === "HEAD" ? null : xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600"
    }
  });
};
