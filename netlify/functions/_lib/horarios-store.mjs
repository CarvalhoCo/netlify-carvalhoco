import { getStore } from "@netlify/blobs";

const STORE_NAME = String(process.env.ADMIN_HORARIOS_STORE_NAME ?? "carvalho-config").trim() || "carvalho-config";
const STORE_KEY = String(process.env.ADMIN_HORARIOS_STORE_KEY ?? "horarios").trim() || "horarios";
const TTL_CACHE_MEMORIA_MS = 30_000;
let cacheMemoria = null;
let cacheMemoriaAtualizadaEm = 0;

export const DIA_LABELS = {
  0: "domingo",
  1: "segunda",
  2: "terça",
  3: "quarta",
  4: "quinta",
  5: "sexta",
  6: "sábado"
};

const CONFIG_PADRAO = {
  weekly: {
    "0": { day: DIA_LABELS[0], closed: false, open: "11:00", close: "17:00" },
    "1": { day: DIA_LABELS[1], closed: true, open: null, close: null },
    "2": { day: DIA_LABELS[2], closed: false, open: "14:00", close: "23:00" },
    "3": { day: DIA_LABELS[3], closed: false, open: "14:00", close: "23:00" },
    "4": { day: DIA_LABELS[4], closed: false, open: "14:00", close: "23:00" },
    "5": { day: DIA_LABELS[5], closed: false, open: "14:00", close: "23:00" },
    "6": { day: DIA_LABELS[6], closed: false, open: "11:00", close: "23:00" }
  },
  dateOverrides: [],
  updatedAt: null
};

function clonar(valor) {
  return JSON.parse(JSON.stringify(valor));
}

export function obterConfigPadrao() {
  return clonar(CONFIG_PADRAO);
}

function horarioValido(horario) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(horario ?? ""));
}

function horarioParaMinutos(horario) {
  if (!horarioValido(horario)) {
    return null;
  }

  const [hora, minuto] = horario.split(":").map(Number);
  return hora * 60 + minuto;
}

function dataValida(dataTexto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataTexto ?? ""))) {
    return false;
  }

  const [ano, mes, dia] = dataTexto.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  return (
    data.getFullYear() === ano &&
    data.getMonth() === mes - 1 &&
    data.getDate() === dia
  );
}

function normalizarDiaSemana(chaveDia, entrada, base) {
  const dia = DIA_LABELS[Number(chaveDia)] ?? base.day;
  const fechado = Boolean(entrada?.closed);

  if (fechado) {
    return {
      day: dia,
      closed: true,
      open: null,
      close: null
    };
  }

  const openEntrada = entrada?.open;
  const closeEntrada = entrada?.close;
  const open = horarioValido(openEntrada) ? openEntrada : base.open;
  const close = horarioValido(closeEntrada) ? closeEntrada : base.close;

  if (!horarioValido(open) || !horarioValido(close)) {
    return {
      day: dia,
      closed: true,
      open: null,
      close: null
    };
  }

  if (horarioParaMinutos(open) >= horarioParaMinutos(close)) {
    return {
      day: dia,
      closed: true,
      open: null,
      close: null
    };
  }

  return {
    day: dia,
    closed: false,
    open,
    close
  };
}

function normalizarSobrescrita(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const date = String(data.date ?? "").trim();
  if (!dataValida(date)) {
    return null;
  }

  const closed = Boolean(data.closed);
  if (closed) {
    return {
      date,
      closed: true,
      open: null,
      close: null
    };
  }

  const open = String(data.open ?? "").trim();
  const close = String(data.close ?? "").trim();

  if (!horarioValido(open) || !horarioValido(close)) {
    return null;
  }

  if (horarioParaMinutos(open) >= horarioParaMinutos(close)) {
    return null;
  }

  return {
    date,
    closed: false,
    open,
    close
  };
}

export function normalizarConfiguracao(entrada) {
  const base = obterConfigPadrao();
  const dados = entrada && typeof entrada === "object" ? entrada : {};

  const weeklyEntrada = dados.weekly && typeof dados.weekly === "object" ? dados.weekly : {};
  const weekly = {};

  Object.keys(base.weekly).forEach((chaveDia) => {
    weekly[chaveDia] = normalizarDiaSemana(chaveDia, weeklyEntrada[chaveDia], base.weekly[chaveDia]);
  });

  const sobrescritasEntrada = Array.isArray(dados.dateOverrides) ? dados.dateOverrides : [];
  const mapaSobrescritas = new Map();

  sobrescritasEntrada.forEach((item) => {
    const normalizado = normalizarSobrescrita(item);
    if (normalizado) {
      mapaSobrescritas.set(normalizado.date, normalizado);
    }
  });

  const dateOverrides = Array.from(mapaSobrescritas.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return {
    weekly,
    dateOverrides,
    updatedAt: typeof dados.updatedAt === "string" && dados.updatedAt ? dados.updatedAt : null
  };
}

export async function lerConfiguracaoHorarios() {
  const agora = Date.now();
  if (cacheMemoria && agora - cacheMemoriaAtualizadaEm < TTL_CACHE_MEMORIA_MS) {
    return normalizarConfiguracao(cacheMemoria);
  }

  try {
    const store = getStore(STORE_NAME);
    const salvo = await store.get(STORE_KEY, { type: "json" });

    if (!salvo || typeof salvo !== "object") {
      const padrao = obterConfigPadrao();
      const inicial = {
        ...padrao,
        updatedAt: new Date().toISOString()
      };
      await store.setJSON(STORE_KEY, inicial);
      cacheMemoria = inicial;
      cacheMemoriaAtualizadaEm = Date.now();
      return padrao;
    }

    cacheMemoria = salvo;
    cacheMemoriaAtualizadaEm = Date.now();
    return normalizarConfiguracao(salvo);
  } catch {
    if (!cacheMemoria) {
      cacheMemoria = {
        ...obterConfigPadrao(),
        updatedAt: null
      };
    }

    cacheMemoriaAtualizadaEm = Date.now();

    return normalizarConfiguracao(cacheMemoria);
  }
}

export async function salvarConfiguracaoHorarios(configuracao) {
  const normalizado = normalizarConfiguracao(configuracao);
  const atualizado = {
    ...normalizado,
    updatedAt: new Date().toISOString()
  };

  try {
    const store = getStore(STORE_NAME);
    await store.setJSON(STORE_KEY, atualizado);
  } catch {
    // Em ambiente sem contexto do Netlify Blobs, salva em memoria.
  }

  cacheMemoria = atualizado;
  cacheMemoriaAtualizadaEm = Date.now();
  return atualizado;
}
