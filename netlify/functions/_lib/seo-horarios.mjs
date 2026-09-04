const DIAS_SCHEMA = {
  "0": "https://schema.org/Sunday",
  "1": "https://schema.org/Monday",
  "2": "https://schema.org/Tuesday",
  "3": "https://schema.org/Wednesday",
  "4": "https://schema.org/Thursday",
  "5": "https://schema.org/Friday",
  "6": "https://schema.org/Saturday"
};

function criarHorarioSemanal(configuracao) {
  return Object.entries(configuracao.weekly ?? {})
    .filter(([, horario]) => !horario.closed && horario.open && horario.close)
    .map(([dia, horario]) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: DIAS_SCHEMA[dia],
      opens: horario.open,
      closes: horario.close
    }));
}

function criarHorariosEspeciais(configuracao) {
  return (configuracao.dateOverrides ?? []).map((horario) => ({
    "@type": "OpeningHoursSpecification",
    validFrom: horario.date,
    validThrough: horario.date,
    opens: horario.closed ? "00:00" : horario.open,
    closes: horario.closed ? "00:00" : horario.close
  }));
}

export function criarDadosEstruturadosLoja(configuracao) {
  const dados = {
    "@context": "https://schema.org",
    "@type": "LiquorStore",
    "@id": "https://adegacarvalho.com/#loja",
    name: "Carvalho&Co.",
    alternateName: "Adega Carvalho",
    legalName: "Carvalho&Co. LTDA",
    taxID: "55.061.604/0001-30",
    url: "https://adegacarvalho.com/",
    telephone: "+55 11 91010-0155",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Rua Ohio, 101",
      addressLocality: "Mauá",
      addressRegion: "SP",
      postalCode: "09351-260",
      addressCountry: "BR"
    },
    hasMap: "https://maps.app.goo.gl/53wnFwKywyg69iVP7",
    sameAs: ["https://www.instagram.com/adegatabacariacarvalho/"],
    openingHoursSpecification: criarHorarioSemanal(configuracao)
  };

  const horariosEspeciais = criarHorariosEspeciais(configuracao);
  if (horariosEspeciais.length) {
    dados.specialOpeningHoursSpecification = horariosEspeciais;
  }

  return dados;
}

export function serializarJsonLd(dados) {
  return JSON.stringify(dados).replaceAll("<", "\\u003c");
}

export function dataAtualizacaoValida(valor) {
  const data = new Date(valor ?? "");
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}
