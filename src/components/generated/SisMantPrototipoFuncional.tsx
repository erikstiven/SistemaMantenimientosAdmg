import React, { useEffect, useState } from "react";
const TODAY = "2026-11-04";
function stored<T>(key: string, initial: T): T {
  try {
    const v = localStorage.getItem("sismant-v3-" + key);
    return v ? JSON.parse(v) : initial;
  } catch {
    return initial;
  }
}
function useSaved<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [v, setV] = useState<T>(() => stored(key, initial));
  useEffect(() => {
    try {
      localStorage.setItem("sismant-v3-" + key, JSON.stringify(v));
    } catch {}
  }, [key, v]);
  return [v, setV];
}
function addDuration(date: string, num: number, unit: string) {
  const d = new Date(date + "T12:00:00");
  if (Number.isNaN(d.getTime())) return TODAY;
  if (unit === "Meses") d.setMonth(d.getMonth() + num);else d.setDate(d.getDate() + num);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string) {
  return Math.round((new Date(a + "T12:00:00").getTime() - new Date(b + "T12:00:00").getTime()) / 86400000);
}
function money(x: number) {
  return x.toLocaleString("es-EC", {
    style: "currency",
    currency: "USD"
  });
}
type A = {
  id: number;
  code: string;
  name: string;
  type: string;
  active?: boolean;
};
type P = {
  id: number;
  asset: number;
  name: string;
  unit: string;
  freq: number;
  base: number;
  alert: number;
  second?: {
    unit: string;
    freq: number;
    base?: number;
    alert?: number;
    startDate?: string;
    meter?: number;
  };
  meter?: number;
  startDate?: string;
  active?: boolean;
  endDate?: string;
  note?: string;
};
type R = {
  id: number;
  asset: number;
  unit: string;
  value: number;
  date: string;
  meter?: number;
};
type M = {
  id: number;
  asset: number;
  unit: string;
  name: string;
  active: boolean;
};
type O = {
  id: number;
  plan: number;
  status: string;
  date: string;
  doneAt?: string;
  valueAt?: number;
  notes?: string;
  parts?: {
    index: number;
    quantity: number;
    price: number;
    name: string;
  }[];
  snapshot?: string;
};
const seedM: M[] = [{
  id: 1,
  asset: 1,
  unit: "Horas",
  name: "Horómetro principal",
  active: true
}, {
  id: 2,
  asset: 2,
  unit: "Kilómetros",
  name: "Odómetro principal",
  active: true
}, {
  id: 3,
  asset: 3,
  unit: "Horas",
  name: "Horómetro del generador",
  active: true
}, {
  id: 4,
  asset: 4,
  unit: "Horas",
  name: "Horómetro principal",
  active: true
}, {
  id: 5,
  asset: 5,
  unit: "Kilómetros",
  name: "Odómetro principal",
  active: true
}];
type MaintType = {
  id: number;
  name: string;
  description: string;
  active: boolean;
};
type AppSettings = {
  alerts: boolean;
  hours: number;
  km: number;
  days: number;
  months: number;
};
const initialTypes: MaintType[] = [{
  id: 1,
  name: "Motor",
  description: "Servicio y revisión del motor",
  active: true
}, {
  id: 2,
  name: "Hidráulico",
  description: "Circuitos y componentes hidráulicos",
  active: true
}, {
  id: 3,
  name: "Mandos",
  description: "Controles y mecanismos de mando",
  active: true
}, {
  id: 4,
  name: "Frenos",
  description: "Inspección y componentes de frenos",
  active: true
}, {
  id: 5,
  name: "Cambio de aceite",
  description: "Aceite y filtros",
  active: true
}, {
  id: 6,
  name: "Revisión general",
  description: "Inspección preventiva general",
  active: true
}];
const initialSettings: AppSettings = {
  alerts: true,
  hours: 50,
  km: 500,
  days: 7,
  months: 30
};
const controlUnits = [{
  code: "H",
  name: "Horas",
  kind: "MEDIDOR",
  detail: "Horas de funcionamiento"
}, {
  code: "KM",
  name: "Kilómetros",
  kind: "MEDIDOR",
  detail: "Distancia recorrida"
}, {
  code: "DIA",
  name: "Días",
  kind: "CALENDARIO",
  detail: "Intervalo de días"
}, {
  code: "MES",
  name: "Meses",
  kind: "CALENDARIO",
  detail: "Intervalo de meses"
}];
const seedHistory = [{
  id: 1,
  kind: "Plan",
  date: "2026-06-01",
  text: "Camión HINO: creado plan de aceite por kilómetros y meses."
}];
const seedA: A[] = [{
  id: 1,
  code: "EXC001",
  name: "Excavadora CAT 320",
  type: "Maquinaria pesada"
}, {
  id: 2,
  code: "CAM001",
  name: "Camión HINO 500",
  type: "Vehículo"
}, {
  id: 3,
  code: "GEN001",
  name: "Generador Honda",
  type: "Generador"
}, {
  id: 4,
  code: "RET001",
  name: "Retroexcavadora JCB",
  type: "Maquinaria pesada"
}, {
  id: 5,
  code: "VOL001",
  name: "Volqueta Volvo FMX",
  type: "Vehículo"
}];
const seedP: P[] = [{
  id: 1,
  asset: 1,
  name: "Motor",
  unit: "Horas",
  freq: 250,
  base: 1000,
  alert: 50,
  meter: 1,
  startDate: "2026-01-01",
  active: true
}, {
  id: 2,
  asset: 1,
  name: "Hidráulico",
  unit: "Horas",
  freq: 2000,
  base: 0,
  alert: 100,
  meter: 1,
  startDate: "2026-01-01",
  active: true
}, {
  id: 3,
  asset: 2,
  name: "Cambio de aceite",
  unit: "Kilómetros",
  freq: 5000,
  base: 50000,
  alert: 500,
  meter: 2,
  startDate: "2026-06-01",
  active: true,
  second: {
    unit: "Meses",
    freq: 6,
    startDate: "2026-06-01",
    alert: 30
  }
}, {
  id: 4,
  asset: 3,
  name: "Revisión general",
  unit: "Meses",
  freq: 6,
  base: 0,
  alert: 30,
  startDate: "2026-10-16",
  active: true
}, {
  id: 5,
  asset: 4,
  name: "Motor",
  unit: "Horas",
  freq: 500,
  base: 2900,
  alert: 50,
  meter: 4,
  startDate: "2026-01-01",
  active: true
}, {
  id: 6,
  asset: 5,
  name: "Cambio de aceite",
  unit: "Kilómetros",
  freq: 5000,
  base: 125000,
  alert: 500,
  meter: 5,
  startDate: "2026-01-01",
  active: true
}];
const seedR: R[] = [{
  id: 1,
  asset: 1,
  unit: "Horas",
  value: 1200,
  date: "2026-11-04"
}, {
  id: 2,
  asset: 2,
  unit: "Kilómetros",
  value: 53500,
  date: "2026-11-04"
}, {
  id: 3,
  asset: 3,
  unit: "Horas",
  value: 800,
  date: "2026-11-04"
}, {
  id: 4,
  asset: 4,
  unit: "Horas",
  value: 3420,
  date: "2026-11-04"
}, {
  id: 5,
  asset: 5,
  unit: "Kilómetros",
  value: 128400,
  date: "2026-11-04"
}];
const seedO: O[] = [{
  id: 101,
  plan: 1,
  status: "Pendiente",
  date: "2026-11-05"
}, {
  id: 102,
  plan: 3,
  status: "Programada",
  date: "2026-11-10"
}, {
  id: 103,
  plan: 4,
  status: "Realizada",
  date: "2026-10-16",
  doneAt: "2026-10-16",
  notes: "Revisión semestral completa",
  parts: [],
  snapshot: "Revisión general · cada 6 meses"
}];
const nav = ["Dashboard", "Activos", "Medidores y lecturas", "Planes", "Órdenes", "Repuestos", "Alertas e historial", "Simulación", "Configuración"];
const guideSteps = [{
  id: "configuracion",
  title: "Configuración",
  text: "Define los tipos de mantenimiento y confirma las unidades de control."
}, {
  id: "activo",
  title: "Activo",
  text: "Registra el equipo o vehículo que requiere seguimiento."
}, {
  id: "medidor",
  title: "Medidor",
  text: "Asocia uno o varios medidores de horas o kilómetros al activo."
}, {
  id: "lectura-inicial",
  title: "Lectura inicial",
  text: "Carga el valor base para calcular vencimientos reales."
}, {
  id: "plan",
  title: "Plan",
  text: "Crea el mantenimiento con frecuencia, unidad, medidor y alerta anticipada."
}, {
  id: "nueva-lectura",
  title: "Nueva lectura",
  text: "Actualiza el contador cuando el equipo avance en uso."
}, {
  id: "alerta",
  title: "Alerta",
  text: "Revisa próximos y vencidos desde el dashboard o alertas."
}, {
  id: "orden",
  title: "Orden",
  text: "Programa la intervención desde el plan correspondiente."
}, {
  id: "ejecucion",
  title: "Ejecución",
  text: "Registra fecha, lectura real y repuestos utilizados."
}, {
  id: "historial",
  title: "Historial",
  text: "Consulta órdenes realizadas y cambios conservados."
}];
const styles = {
  card: "rounded-xl border border-slate-200 bg-white shadow-sm",
  button: "rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800",
  input: "w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
};
const format = (n: number) => n.toLocaleString("es-EC");
function Tag({
  status
}: {
  status: string;
}) {
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === "Vencido" ? "bg-red-100 text-red-700" : status === "Próximo" || status === "Pendiente" ? "bg-amber-100 text-amber-700" : status === "Realizada" || status === "Al día" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{status}</span>;
}
export const SisMantPrototipoFuncional = () => {
  const [page, setPage] = useState("Dashboard"),
    [assets, setAssets] = useSaved("assets", seedA),
    [plans, setPlans] = useSaved("plans", seedP),
    [readings, setReadings] = useSaved("readings", seedR),
    [orders, setOrders] = useSaved("orders", seedO),
    [meters, setMeters] = useSaved("meters", seedM),
    [history, setHistory] = useSaved("history", seedHistory),
    [maintTypes, setMaintTypes] = useSaved<MaintType[]>("maintenance-types", initialTypes),
    [appSettings, setAppSettings] = useSaved<AppSettings>("general-settings", initialSettings),
    [configSearch, setConfigSearch] = useState(""),
    [configTab, setConfigTab] = useState("tipos"),
    [items, setItems] = useSaved("items", [{
      name: "Filtro de aceite",
      unit: "Unidad",
      price: 15
    }, {
      name: "Aceite 15W40",
      unit: "Litro",
      price: 8.5
    }, {
      name: "Filtro hidráulico",
      unit: "Unidad",
      price: 30
    }]),
    [dialog, setDialog] = useState(""),
    [draft, setDraft] = useState<any>({}),
    [filter, setFilter] = useState(""),
    [detail, setDetail] = useState<number | null>(null),
    [partRows, setPartRows] = useState<{
      index: number;
      quantity: number;
    }[]>([]),
    [message, setMessage] = useState("");
  const notice = (s: string) => {
    setMessage(s);
  };
  const log = (kind: string, text: string) => setHistory(h => [{
    id: Date.now() + Math.random(),
    kind,
    date: TODAY,
    text
  }, ...h]);
  const asset = (id: number) => assets.find(x => x.id === id)?.name || "—";
  const current = (id: number, u: string, meter?: number) => {
    const rows = readings.filter(r => r.asset === id && r.unit === u && (meter == null || r.meter === meter || !r.meter && meters.find(m => m.id === meter)?.asset === id && meters.find(m => m.id === meter)?.unit === u && meters.filter(m => m.asset === id && m.unit === u).length === 1));
    return rows.length ? rows[rows.length - 1].value : 0;
  };
  const ruleEval = (p: P, r: {
    unit: string;
    freq: number;
    base?: number;
    alert?: number;
    startDate?: string;
    meter?: number;
  }) => {
    if (r.unit === "Meses" || r.unit === "Días") {
      const due = addDuration(r.startDate || p.startDate || TODAY, r.freq, r.unit);
      const remain = daysBetween(due, TODAY);
      const warning = r.unit === "Meses" ? r.alert ?? 30 : r.alert ?? 7;
      return {
        status: remain <= 0 ? "Vencido" : appSettings.alerts && remain <= warning ? "Próximo" : "Al día",
        remaining: remain < 0 ? `Vencido hace ${-remain} días (${due})` : `Vence ${due} · ${remain} días restantes`,
        due
      };
    }
    const meter = r.meter ?? p.meter;
    const val = current(p.asset, r.unit, meter);
    const remaining = (r.base ?? 0) + r.freq - val;
    return {
      status: remaining <= 0 ? "Vencido" : appSettings.alerts && remaining <= (r.alert ?? 0) ? "Próximo" : "Al día",
      remaining: remaining < 0 ? `Excedido ${format(-remaining)} ${r.unit}` : `Faltan ${format(remaining)} ${r.unit} (meta ${format((r.base ?? 0) + r.freq)})`,
      due: String((r.base ?? 0) + r.freq)
    };
  };
  const evalPlan = (p: P) => {
    if (p.active === false) return {
      status: "Inactivo",
      remaining: "Plan cerrado",
      due: ""
    };
    const first = ruleEval(p, {
      unit: p.unit,
      freq: p.freq,
      base: p.base,
      alert: p.alert,
      startDate: p.startDate,
      meter: p.meter
    });
    if (!p.second) return first;
    const second = ruleEval(p, p.second);
    const severity = (v: string) => v === "Vencido" ? 3 : v === "Próximo" ? 2 : v === "Al día" ? 1 : 0;
    const worse = severity(first.status) >= severity(second.status) ? first : second;
    return {
      ...worse,
      remaining: worse.remaining + " · OR: " + (worse === first ? second.remaining : first.remaining)
    };
  };
  const alertCount = plans.filter(p => evalPlan(p).status === "Vencido").length;
  const close = () => {
    setDialog("");
    setMessage("");
  };
  const begin = (key: string, data: any = {}) => {
    if (key === "Plan" && data.alert == null) {
      setDraft({
        ...data,
        alert: appSettings.hours,
        startDate: TODAY
      });
    } else setDraft(data);
    setPartRows([]);
    setMessage("");
    setDialog(key);
  };
  const title = (heading: string, desc: string, button?: string, action?: () => void) => <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">{heading}</h1><p className="mt-1 text-sm text-slate-500">{desc}</p></div>{button && <button className={styles.button} onClick={action}>+ {button}</button>}</div>;
  const header = (cols: string[]) => <thead className="bg-slate-50"><tr>{cols.map(c => <th key={c} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{c}</th>)}</tr></thead>;
  const save = () => {
    if (dialog === "Tipo mantenimiento") {
      const name = String(draft.name || "").trim();
      const description = String(draft.description || "").trim();
      if (name.length < 3) {
        notice("Escribe un nombre de al menos 3 caracteres");
        return;
      }
      if (maintTypes.some(t => t.name.toLowerCase() === name.toLowerCase() && t.id !== draft.id)) {
        notice("Ya existe un tipo de mantenimiento con ese nombre");
        return;
      }
      if (draft.id) {
        setMaintTypes(ts => ts.map(t => t.id === draft.id ? {
          ...t,
          name,
          description
        } : t));
        log("Configuración", "Tipo de mantenimiento actualizado: " + name);
      } else {
        setMaintTypes(ts => [...ts, {
          id: Date.now(),
          name,
          description,
          active: true
        }]);
        log("Configuración", "Tipo de mantenimiento creado: " + name);
      }
    }
    if (dialog === "Activo") {
      if (!draft.code?.trim() || !draft.name?.trim()) {
        notice("Completa código y nombre");
        return;
      }
      if (assets.some(x => x.code.toLowerCase() === draft.code.toLowerCase() && x.id !== draft.id)) {
        notice("El código ya existe");
        return;
      }
      if (draft.id) {
        setAssets(a => a.map(x => x.id === draft.id ? {
          ...x,
          ...draft
        } : x));
        log("Activo", "Actualizado " + draft.name);
      } else {
        setAssets(a => [...a, {
          id: Date.now(),
          code: draft.code,
          name: draft.name,
          type: draft.type || "Maquinaria"
        }]);
        log("Activo", "Registrado " + draft.name);
      }
    }
    if (dialog === "Medidor") {
      if (!draft.asset || !draft.unit || !draft.name?.trim()) {
        notice("Completa equipo, unidad y nombre");
        return;
      }
      setMeters(m => [...m, {
        id: Date.now(),
        asset: Number(draft.asset),
        unit: draft.unit,
        name: draft.name,
        active: true
      }]);
      log("Medidor", "Nuevo " + draft.name + " para " + asset(Number(draft.asset)));
    }
    if (dialog === "Lectura") {
      const val = Number(draft.value),
        aid = Number(draft.asset),
        meter = Number(draft.meter);
      const mm = meters.find(m => m.id === meter);
      if (!mm || !Number.isFinite(val) || draft.value === "" || val < 0) {
        notice("Selecciona medidor e ingresa lectura válida");
        return;
      }
      if (val < current(aid, mm.unit, meter)) {
        notice("Lectura menor al último registro; debe corregirse con autorización");
        return;
      }
      setReadings(r => [...r, {
        id: Date.now(),
        asset: aid,
        meter,
        unit: mm.unit,
        value: val,
        date: draft.date || TODAY
      }]);
      log("Lectura", asset(aid) + " · " + mm.name + ": " + format(val) + " " + mm.unit);
    }
    if (dialog === "Plan") {
      if (!maintTypes.some(t => t.name === draft.name && t.active)) {
        notice("Selecciona un tipo de mantenimiento activo");
        return;
      }
      if (!draft.name?.trim() || !draft.asset || !draft.unit || !(Number(draft.freq) > 0)) {
        notice("Completa plan, equipo y frecuencia mayor a cero");
        return;
      }
      if (["Horas", "Kilómetros"].includes(draft.unit) && !meters.some(m => m.id === Number(draft.meter) && m.asset === Number(draft.asset) && m.unit === draft.unit)) {
        notice("Selecciona un medidor del activo");
        return;
      }
      setPlans(p => [...p, {
        id: Date.now(),
        name: draft.name,
        asset: Number(draft.asset),
        unit: draft.unit,
        meter: Number(draft.meter) || undefined,
        freq: Number(draft.freq),
        base: Number(draft.base || 0),
        alert: Number(draft.alert || 0),
        startDate: draft.startDate || TODAY,
        active: true
      }]);
      log("Plan", "Creado " + draft.name + " para " + asset(Number(draft.asset)));
    }
    if (dialog === "Regla") {
      if (!(Number(draft.freq) > 0)) {
        notice("Frecuencia requerida");
        return;
      }
      if (["Horas", "Kilómetros"].includes(draft.unit) && !meters.some(m => m.id === Number(draft.meter) && m.asset === Number(draft.asset || plans.find(p => p.id === Number(draft.plan))?.asset) && m.unit === draft.unit)) {
        notice("Selecciona medidor para esta regla");
        return;
      }
      setPlans(ps => ps.map(p => p.id === Number(draft.plan) ? {
        ...p,
        second: {
          unit: draft.unit,
          freq: Number(draft.freq),
          base: Number(draft.base || 0),
          alert: Number(draft.alert || 0),
          startDate: draft.startDate || p.startDate,
          meter: Number(draft.meter) || undefined
        }
      } : p));
      log("Regla", "Configurada condición adicional para plan " + draft.plan);
    }
    if (dialog === "Cambiar control") {
      const old = plans.find(p => p.id === Number(draft.plan));
      if (!old || !draft.unit || !(Number(draft.freq) > 0)) {
        notice("Configura la unidad y frecuencia nuevas");
        return;
      }
      if (["Horas", "Kilómetros"].includes(draft.unit) && !meters.some(m => m.id === Number(draft.meter) && m.asset === Number(draft.asset || plans.find(p => p.id === Number(draft.plan))?.asset) && m.unit === draft.unit)) {
        notice("Selecciona medidor");
        return;
      }
      const newP: P = {
        id: Date.now(),
        asset: old.asset,
        name: old.name,
        unit: draft.unit,
        meter: Number(draft.meter) || undefined,
        freq: Number(draft.freq),
        base: Number(draft.base || 0),
        alert: Number(draft.alert || 0),
        startDate: draft.startDate || TODAY,
        active: true,
        note: "Reemplaza plan " + old.id
      };
      setPlans(ps => [...ps.map(p => p.id === old.id ? {
        ...p,
        active: false,
        endDate: TODAY
      } : p), newP]);
      log("Cambio de estrategia", asset(old.asset) + " · " + old.name + ": " + old.unit + " → " + draft.unit + ". Historial anterior conservado.");
    }
    if (dialog === "Orden") {
      if (!draft.plan) {
        notice("Selecciona plan");
        return;
      }
      setOrders(os => [...os, {
        id: Date.now(),
        plan: Number(draft.plan),
        date: draft.date || TODAY,
        status: "Pendiente",
        notes: draft.notes || ""
      }]);
      log("Orden", "Nueva orden para plan " + draft.plan);
    }
    if (dialog === "Completar orden") {
      const order = orders.find(o => o.id === Number(draft.order));
      const plan = plans.find(p => p.id === order?.plan);
      if (!order || !plan) {
        notice("No se encontró la orden");
        return;
      }
      const value = Number(draft.valueAt);
      if (["Horas", "Kilómetros"].includes(plan.unit) && (!Number.isFinite(value) || draft.valueAt === "")) {
        notice("Registra la lectura al realizar el servicio");
        return;
      }
      if (["Horas", "Kilómetros"].includes(plan.unit) && value > current(plan.asset, plan.unit, plan.meter)) {
        notice("Registra primero la lectura actual en Medidores y lecturas");
        return;
      }
      const parts = partRows.map(pr => ({
        index: pr.index,
        quantity: pr.quantity,
        price: items[pr.index]?.price || 0,
        name: items[pr.index]?.name || "Repuesto"
      })).filter(x => x.quantity > 0);
      const snapshot = plan.name + " · " + plan.freq + " " + plan.unit + (plan.second ? " o " + plan.second.freq + " " + plan.second.unit : "");
      const doneAt = draft.doneAt || TODAY;
      setOrders(os => os.map(o => o.id === order.id ? {
        ...o,
        status: "Realizada",
        doneAt,
        valueAt: ["Horas", "Kilómetros"].includes(plan.unit) ? value : undefined,
        notes: draft.notes || o.notes || "",
        parts,
        snapshot
      } : o));
      if (plan.active !== false) setPlans(ps => ps.map(p => p.id === plan.id ? {
        ...p,
        base: ["Horas", "Kilómetros"].includes(p.unit) ? value : p.base,
        startDate: doneAt,
        second: p.second ? {
          ...p.second,
          startDate: doneAt,
          base: ["Horas", "Kilómetros"].includes(p.second.unit) ? current(p.asset, p.second.unit, p.second.meter) : p.second.base
        } : undefined
      } : p));
      log("Servicio realizado", "ORD-" + order.id + " · " + asset(plan.asset) + " · " + plan.name + " · " + money(parts.reduce((sum, x) => sum + x.price * x.quantity, 0)));
    }
    if (dialog === "Repuesto") {
      if (!draft.name?.trim() || Number(draft.price) < 0) {
        notice("Ingresa nombre y precio válido");
        return;
      }
      setItems(it => [...it, {
        name: draft.name,
        unit: draft.unit || "Unidad",
        price: Number(draft.price || 0)
      }]);
    }
    close();
  };
  const field = (label: string, key: string, type = "text") => <label className="block text-sm font-medium text-slate-600">{label}<input type={type} className={styles.input + " mt-1"} value={draft[key] ?? ""} onChange={e => setDraft({
      ...draft,
      [key]: e.target.value
    })} /></label>;
  const sel = (label: string, key: string, options: {
    value: string;
    label: string;
  }[]) => <label className="block text-sm font-medium text-slate-600">{label}<select className={styles.input + " mt-1"} value={draft[key] ?? ""} onChange={e => setDraft({
      ...draft,
      [key]: e.target.value
    })}><option value="">Seleccionar</option>{options.map(o => <option value={o.value} key={o.value}>{o.label}</option>)}</select></label>;
  const assetOptions = assets.map(a => ({
      value: String(a.id),
      label: a.name
    })),
    units = ["Horas", "Kilómetros", "Días", "Meses"].map(u => ({
      value: u,
      label: u
    }));
  return <div className="flex min-h-[860px] w-full bg-[#f4f6fa] font-sans text-slate-800">
<aside className="hidden w-60 shrink-0 flex-col bg-[#0d2240] px-3 py-5 text-white md:flex"><div className="flex items-center gap-3 border-b border-white/10 px-3 pb-6"><span className="rounded-xl bg-orange-500 px-3 py-2 text-xl">⚒</span><div><b className="text-lg">SisMant</b><p className="text-xs text-blue-200">Mantenimiento integral</p></div></div><nav className="mt-5 flex-1 space-y-1">{nav.map((n, i) => <button key={n} onClick={() => {
          setPage(n);
          setFilter("");
        }} className={`w-full rounded-lg px-3 py-3 text-left text-sm ${page === n ? "bg-blue-600 font-bold text-white" : "text-blue-100 hover:bg-white/10"}`}>{["▦", "▤", "◷", "▣", "☷", "⬡", "♧", "⚗", "⚙"][i]}　{n}</button>)}</nav><p className="rounded-lg border border-blue-900 p-3 text-xs text-blue-200">◉ MODO DEMO<br />Datos locales simulados</p></aside>
<div className="min-w-0 flex-1"><header className="flex items-center justify-between gap-2 border-b bg-white px-6 py-4"><div className="flex items-center gap-3"><b>SisMant</b><span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">MODO DEMOSTRACIÓN</span></div><div className="flex items-center gap-4"><span className="hidden text-xs text-slate-500 sm:block">04/11/2026</span><button className="rounded-lg border px-3 py-2 text-xs" onClick={() => {
            setAssets(seedA);
            setReadings(seedR);
            setPlans(seedP);
            setOrders(seedO);
            setMeters(seedM);
            setHistory(seedHistory);
            setMaintTypes(initialTypes);
            setAppSettings(initialSettings);
            setItems([{
              name: "Filtro de aceite",
              unit: "Unidad",
              price: 15
            }, {
              name: "Aceite 15W40",
              unit: "Litro",
              price: 8.5
            }, {
              name: "Filtro hidráulico",
              unit: "Unidad",
              price: 30
            }]);
          }}>↻ Restablecer demo</button><span className="rounded-full bg-[#0d2240] px-3 py-2 text-xs font-bold text-white">JP</span></div></header>
<div className="flex gap-2 overflow-x-auto border-b bg-white p-2 md:hidden">{nav.map(n => <button key={n} onClick={() => setPage(n)} className={`shrink-0 rounded-lg px-3 py-2 text-xs ${page === n ? "bg-blue-700 text-white" : "bg-slate-100"}`}>{n}</button>)}</div>
<main className="mx-auto max-w-[1400px] space-y-5 p-5 md:p-8">
{page === "Dashboard" && <>{title("Dashboard", "Resumen general del estado de mantenimiento de la flota")}
<section className={styles.card + " p-5"} aria-labelledby="guided-flow-title">
<div className="flex flex-wrap items-start justify-between gap-3">
<div>
<h2 id="guided-flow-title" className="text-lg font-bold text-slate-900">Flujo guiado del prototipo</h2>
<p className="mt-1 text-sm text-slate-500">Sigue esta ruta para demostrar SisMant al cliente sin perder historial ni datos simulados.</p>
</div>
<span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">10 pasos</span>
</div>
<ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
{guideSteps.map(step => <li key={step.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
<span className="text-xs font-bold uppercase tracking-wide text-blue-700">{step.title}</span>
<p className="mt-2 text-sm text-slate-600">{step.text}</p>
</li>)}
</ol>
</section>
<div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
{[["Activos", assets.length, "Activos"], ["Al día", plans.filter(p => evalPlan(p).status === "Al día").length, "Planes"], ["Próximos", plans.filter(p => evalPlan(p).status === "Próximo").length, "Alertas e historial"], ["Vencidos", alertCount, "Alertas e historial"], ["Órdenes realizadas", orders.filter(o => o.status === "Realizada").length, "Órdenes"]].map(([name, n, target]) => <button className={styles.card + " p-5 text-left hover:border-blue-400"} onClick={() => setPage(String(target))} key={name}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{name}</p><p className="mt-3 text-3xl font-extrabold">{n}</p><p className="mt-2 text-xs font-semibold text-blue-700">Ver detalle →</p></button>)}
</div>
<div className={styles.card}>
<h3 className="border-b px-5 py-4 font-bold">Próximos mantenimientos</h3>
<div className="overflow-x-auto">
<table className="w-full">
{header(["Equipo", "Mantenimiento", "Vencimiento", "Estado"])}
<tbody>
{plans.map(p => <tr className="border-t text-sm" key={p.id}><td className="px-4 py-4 font-semibold">{asset(p.asset)}</td><td className="px-4 py-4">{p.name}</td><td className="px-4 py-4">{evalPlan(p).remaining}</td><td className="px-4 py-4"><Tag status={evalPlan(p).status} /></td></tr>)}
</tbody>
</table>
</div>
</div>
<div className={styles.card + " p-5"}>
<b>Simulador de mantenimiento</b>
<p className="mt-2 text-sm text-slate-500">Prueba cómo cambian los estados cuando aumentan las lecturas del horómetro o del odómetro.</p>
<button className={styles.button + " mt-4"} onClick={() => setPage("Simulación")}>Abrir simulación →</button>
</div>
</>}
{page === "Activos" && <>{title("Gestión de activos", "Registro de equipos y vehículos", "Nuevo activo", () => begin("Activo"))}<div className={styles.card}><div className="flex flex-wrap gap-3 border-b p-4"><input value={filter} onChange={e => setFilter(e.target.value)} className={styles.input + " max-w-sm"} placeholder="Buscar por código o nombre" /><span className="self-center text-sm text-slate-500">{assets.length} equipos registrados</span></div><div className="overflow-x-auto"><table className="w-full">{header(["Código", "Nombre", "Tipo", "Planes activos", "Acciones"])}<tbody>{assets.filter(a => (a.name + a.code).toLowerCase().includes(filter.toLowerCase())).map(a => <tr className="border-t text-sm" key={a.id}><td className="px-4 py-4 font-bold text-blue-800">{a.code}</td><td className="px-4 py-4">{a.name}</td><td className="px-4 py-4">{a.type}</td><td className="px-4 py-4">{plans.filter(p => p.asset === a.id && p.active !== false).length}</td><td className="px-4 py-4"><button className="mr-4 font-semibold text-blue-700" onClick={() => setDetail(detail === a.id ? null : a.id)}>Ver ficha</button><button className="text-slate-500" onClick={() => begin("Activo", a)}>Editar</button><button className="ml-3 text-amber-700" onClick={() => {
                        setAssets(xs => xs.map(x => x.id === a.id ? {
                          ...x,
                          active: x.active === false
                        } : x));
                        log("Activo", "Estado modificado: " + a.name);
                      }}>{a.active === false ? "Activar" : "Desactivar"}</button></td></tr>)}</tbody></table></div></div>{detail !== null && <div className={styles.card + " p-5"}><div className="flex justify-between"><h3 className="text-lg font-bold">Ficha: {asset(detail)}</h3><button onClick={() => setDetail(null)}>✕</button></div><div className="mt-4 grid gap-5 md:grid-cols-3"><div><b className="text-sm">Medidores</b>{meters.filter(m => m.asset === detail).map(m => <div key={m.id} className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">{m.name}<b className="block">{format(current(detail, m.unit, m.id))} {m.unit}</b></div>)}</div><div><b className="text-sm">Planes</b>{plans.filter(p => p.asset === detail).map(p => <div key={p.id} className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">{p.name} · {p.active === false ? "Histórico" : evalPlan(p).status}</div>)}</div><div><b className="text-sm">Historial de órdenes</b>{orders.filter(o => plans.some(p => p.id === o.plan && p.asset === detail)).map(o => <div key={o.id} className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">ORD-{o.id} · {o.status}</div>)}</div></div></div>}</>}
{page === "Medidores y lecturas" && <>{title("Medidores y lecturas", "Identificación de medidores e historial acumulado", "Registrar lectura", () => begin("Lectura"))}<div className="flex flex-wrap gap-2"><button className={styles.button} onClick={() => begin("Medidor")}>+ Nuevo medidor</button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{meters.map(m => <div key={m.id} className={styles.card + " p-5"}><p className="text-xs text-slate-500">{asset(m.asset)}</p><div className="mt-1 flex justify-between"><b>{m.name}</b><Tag status={m.active ? "Activo" : "Inactivo"} /></div><p className="mt-4 text-3xl font-extrabold">{format(current(m.asset, m.unit, m.id))}<span className="ml-2 text-sm text-slate-400">{m.unit === "Horas" ? "h" : "km"}</span></p><button className="mt-3 text-sm font-semibold text-blue-700" onClick={() => begin("Lectura", {
                asset: m.asset,
                meter: m.id,
                unit: m.unit
              })}>+ Registrar lectura</button></div>)}</div><div className={styles.card}><h3 className="border-b p-4 font-bold">Historial de lecturas</h3><div className="overflow-x-auto"><table className="w-full">{header(["Equipo", "Medidor", "Fecha", "Valor"])}<tbody>{[...readings].reverse().map(r => <tr className="border-t text-sm" key={r.id}><td className="px-4 py-3">{asset(r.asset)}</td><td className="px-4 py-3">{meters.find(m => m.id === r.meter)?.name || r.unit}</td><td className="px-4 py-3">{r.date}</td><td className="px-4 py-3 font-semibold">{format(r.value)} {r.unit === "Horas" ? "h" : "km"}</td></tr>)}</tbody></table></div></div></>}
{page === "Planes" && <>{title("Planes de mantenimiento", "Definición de frecuencias, reglas combinadas y vigencias", "Nuevo plan", () => begin("Plan"))}<div className="grid gap-4 lg:grid-cols-2">{plans.map(p => <div className={styles.card + " p-5"} key={p.id}><div className="flex justify-between gap-4"><div><p className="text-xs font-semibold text-blue-700">{asset(p.asset)}</p><h3 className="mt-1 text-lg font-bold">{p.name}</h3><p className="mt-1 text-xs text-slate-500">Plan #{p.id} · Inicio {p.startDate || "No registrado"}</p></div>{p.active === false ? <Tag status="Inactivo" /> : <Tag status={evalPlan(p).status} />}</div><div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">Regla 1: cada <b>{format(p.freq)} {p.unit.toLowerCase()}</b><p className="mt-1 text-slate-500">{["Horas", "Kilómetros"].includes(p.unit) ? "Base: " + format(p.base) + " · Medidor: " + (meters.find(m => m.id === p.meter)?.name || p.unit) : "Desde: " + (p.startDate || TODAY)} · Avisar antes: {p.alert}</p></div>{p.second && <div className="mt-2 rounded-lg bg-blue-50 p-3 text-sm">Regla 2 (OR): cada <b>{format(p.second.freq)} {p.second.unit.toLowerCase()}</b> · {ruleEval(p, p.second).remaining}</div>}<div className="mt-4 flex flex-wrap justify-between gap-3 text-sm"><span className="text-slate-500">{evalPlan(p).remaining}</span><div className="flex flex-wrap gap-3">{p.active !== false && <><button className="font-semibold text-blue-700" onClick={() => begin("Regla", {
                      plan: p.id,
                      unit: "Meses",
                      freq: 6,
                      startDate: p.startDate,
                      alert: 30
                    })}>+ Regla</button><button className="font-semibold text-blue-700" onClick={() => begin("Cambiar control", {
                      plan: p.id,
                      asset: p.asset,
                      unit: p.unit,
                      freq: p.freq,
                      base: p.base,
                      alert: p.alert,
                      startDate: TODAY,
                      meter: p.meter
                    })}>Cambiar control</button><button className="text-red-700" onClick={() => {
                      setPlans(ps => ps.map(x => x.id === p.id ? {
                        ...x,
                        active: false,
                        endDate: TODAY
                      } : x));
                      log("Plan", "Desactivado plan #" + p.id);
                    }}>Cerrar plan</button></>}</div></div></div>)}</div><p className="text-sm text-slate-500">Al cambiar la unidad se cierra el plan previo y se crea otro: las órdenes anteriores conservan su referencia histórica.</p></>}
{page === "Órdenes" && <>{title("Órdenes de mantenimiento", "Programación, cierre de servicios y consumo de repuestos", "Nueva orden", () => begin("Orden"))}<div className={styles.card + " overflow-x-auto"}><table className="w-full">{header(["Orden", "Equipo", "Mantenimiento", "Programada", "Estado", "Costo", "Acciones"])}<tbody>{[...orders].reverse().map(o => {
                  const p = plans.find(x => x.id === o.plan);
                  const cost = (o.parts || []).reduce((sum, pr) => sum + pr.price * pr.quantity, 0);
                  return <tr key={o.id} className="border-t text-sm"><td className="px-4 py-4 font-bold">ORD-{o.id}</td><td className="px-4 py-4">{asset(p?.asset || 0)}</td><td className="px-4 py-4">{o.snapshot || p?.name}</td><td className="px-4 py-4">{o.date}</td><td className="px-4 py-4"><Tag status={o.status} /></td><td className="px-4 py-4">{money(cost)}</td><td className="px-4 py-4">{o.status !== "Realizada" && o.status !== "Cancelada" ? <div className="flex gap-3"><button className="font-semibold text-blue-700" onClick={() => begin("Completar orden", {
                          order: o.id,
                          doneAt: TODAY,
                          valueAt: p && ["Horas", "Kilómetros"].includes(p.unit) ? current(p.asset, p.unit, p.meter) : "",
                          notes: o.notes || ""
                        })}>Ejecutar</button><button className="font-semibold text-red-700" onClick={() => {
                          setOrders(os => os.map(x => x.id === o.id ? {
                            ...x,
                            status: "Cancelada"
                          } : x));
                          log("Orden", "Cancelada ORD-" + o.id);
                        }}>Cancelar</button></div> : <button className="font-semibold text-blue-700" onClick={() => begin("Detalle orden", {
                        order: o.id
                      })}>Ver detalle</button>}</td></tr>;
                })}</tbody></table></div></>}
{page === "Repuestos" && <>{title("Catálogo de repuestos", "Insumos y materiales utilizados en las órdenes", "Nuevo repuesto", () => begin("Repuesto"))}<div className={styles.card + " overflow-x-auto"}><table className="w-full">{header(["Código", "Nombre", "Unidad", "Costo referencial"])}<tbody>{items.map((r, i) => <tr key={i} className="border-t text-sm"><td className="px-4 py-4">REP{String(i + 1).padStart(3, "0")}</td><td className="px-4 py-4 font-semibold">{r.name}</td><td className="px-4 py-4">{r.unit}</td><td className="px-4 py-4">{money(r.price)}</td></tr>)}</tbody></table></div><div className={styles.card + " p-5"}><h3 className="font-bold">Consumo histórico en órdenes realizadas</h3>{orders.filter(o => o.status === "Realizada").map(o => <div key={o.id} className="mt-3 border-t pt-3 text-sm"><b>ORD-{o.id}</b> · {(o.parts || []).map(p => p.name + " × " + p.quantity).join(", ") || "Sin repuestos"} · {money((o.parts || []).reduce((sum, p) => sum + p.price * p.quantity, 0))}</div>)}</div></>}
{page === "Alertas e historial" && <>{title("Alertas e historial", "Mantenimientos vencidos, próximos y seguimiento de actividad")}
<div className="flex gap-3">
{["Vencido", "Próximo", "Al día"].map(x => <div className={styles.card + " px-5 py-4"}><Tag status={x} /><p className="mt-2 text-2xl font-bold">{plans.filter(p => evalPlan(p).status === x).length}</p></div>)}
</div>
<div className="space-y-3">
{plans.filter(p => p.active !== false).map(p => <div className={styles.card + " flex flex-wrap items-center justify-between gap-3 p-4"} key={p.id}><div><b>{asset(p.asset)} — {p.name}</b><p className="text-sm text-slate-500">{evalPlan(p).remaining}</p></div><Tag status={evalPlan(p).status} /></div>)}
</div>
<div className={styles.card + " p-5"}>
<b>Bitácora de actividad</b>
{history.map(h => <div key={h.id} className="mt-3 border-t pt-3 text-sm"><span className="font-semibold text-blue-700">{h.kind}</span> · {h.date} · {h.text}</div>)}
</div>
</>}
{page === "Simulación" && <>{title("Simulación de mantenimiento", "Ajusta las lecturas y verifica qué planes se aproximan o vencen")}
<div className="grid gap-4 lg:grid-cols-2">
<div className={styles.card + " p-5"}>
<h3 className="font-bold">Contadores</h3>
<p className="mt-1 text-sm text-slate-500">Al mover un deslizador se registra una lectura simulada.</p>
{meters.filter(m => ["Horas", "Kilómetros"].includes(m.unit)).map(m => <div className="mt-5 rounded-lg border p-4" key={m.id}><p className="text-sm font-semibold">{asset(m.asset)} · {m.name}</p><p className="text-sm text-slate-500">{format(current(m.asset, m.unit, m.id))} {m.unit}</p><input type="range" className="mt-3 w-full accent-blue-700" min={seedR.find(r => r.asset === m.asset && r.unit === m.unit)?.value || 0} max={(seedR.find(r => r.asset === m.asset && r.unit === m.unit)?.value || 0) + (m.unit === "Horas" ? 750 : 10000)} step={m.unit === "Horas" ? 25 : 250} value={current(m.asset, m.unit, m.id)} onChange={e => setReadings(rs => [...rs, {
                  id: Date.now() + Math.random(),
                  asset: m.asset,
                  meter: m.id,
                  unit: m.unit,
                  value: Number(e.target.value),
                  date: TODAY
                }])} />
</div>)}
</div>
<div className={styles.card + " p-5"}>
<h3 className="font-bold">Evaluación automática</h3>
{plans.filter(p => p.active !== false).map(p => <div className="mt-4 flex items-center justify-between gap-3 border-b pb-3 text-sm" key={p.id}><div><b>{p.name}</b><p className="text-slate-500">{asset(p.asset)} · {evalPlan(p).remaining}</p></div><Tag status={evalPlan(p).status} /></div>)}
</div>
</div>
</>}
{page === "Configuración" && <>{title("Configuración", "Administra los catálogos base de SisMant")}
<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
{[{
              label: "Tipos activos",
              value: maintTypes.filter(t => t.active).length
            }, {
              label: "Unidades de control",
              value: controlUnits.length
            }, {
              label: "Planes configurados",
              value: plans.length
            }, {
              label: "Lecturas registradas",
              value: readings.length
            }].map(k => <div className={styles.card + " p-4"} key={k.label}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k.label}</p><p className="mt-2 text-2xl font-bold text-slate-900">{k.value}</p></div>)}
</div>
<div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
{[{
              id: "tipos",
              label: "Tipos de mantenimiento"
            }, {
              id: "unidades",
              label: "Unidades de control"
            }].map(x => <button key={x.id} onClick={() => {
              setConfigTab(x.id);
              setConfigSearch("");
            }} className={`rounded-lg px-4 py-2 text-sm font-semibold ${configTab === x.id ? "bg-blue-700 text-white" : "bg-white text-slate-600 hover:bg-slate-100"}`}>{x.label}</button>)}
</div>
{configTab === "tipos" && <div className={styles.card}><div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><h3 className="font-bold">saetima_mant · Tipos de mantenimiento</h3><p className="mt-1 text-xs text-slate-500">Los tipos desactivados dejan de aparecer en nuevos planes, pero sus registros históricos se conservan.</p></div><button className={styles.button} onClick={() => begin("Tipo mantenimiento")}>+ Nuevo tipo</button></div><div className="border-b p-4"><input className={styles.input + " max-w-md"} value={configSearch} onChange={e => setConfigSearch(e.target.value)} placeholder="Buscar tipos por nombre o descripción..." /></div><div className="overflow-x-auto"><table className="w-full">{header(["Nombre", "Descripción", "Planes vinculados", "Estado", "Acciones"])}<tbody>{maintTypes.filter(t => (t.name + " " + t.description).toLowerCase().includes(configSearch.toLowerCase())).map(t => <tr className="border-t text-sm" key={t.id}><td className="px-4 py-4 font-semibold">{t.name}</td><td className="px-4 py-4 text-slate-600">{t.description || "—"}</td><td className="px-4 py-4">{plans.filter(p => p.name === t.name).length}</td><td className="px-4 py-4"><Tag status={t.active ? "Al día" : "Inactivo"} /></td><td className="px-4 py-4"><div className="flex flex-wrap gap-3"><button className="font-semibold text-blue-700" onClick={() => begin("Tipo mantenimiento", t)}>Editar</button><button className={t.active ? "font-semibold text-red-700" : "font-semibold text-green-700"} onClick={() => {
                          setMaintTypes(ts => ts.map(x => x.id === t.id ? {
                            ...x,
                            active: !x.active
                          } : x));
                          log("Configuración", (t.active ? "Desactivado" : "Activado") + " tipo: " + t.name);
                        }}>{t.active ? "Desactivar" : "Activar"}</button></div></td></tr>)}</tbody></table>{maintTypes.filter(t => (t.name + " " + t.description).toLowerCase().includes(configSearch.toLowerCase())).length === 0 && <div className="p-6 text-center text-sm text-slate-500">No hay tipos que coincidan con la búsqueda.</div>}</div></div>}
{configTab === "unidades" && <div className={styles.card}><div className="border-b px-5 py-4"><h3 className="font-bold">saeumd_mant · Unidades de control</h3><p className="mt-1 text-sm text-slate-500">Catálogo protegido: cambiar el significado de una unidad alteraría el cálculo de vencimientos. Para añadir otra unidad se requiere ampliar la lógica del sistema.</p></div><div className="overflow-x-auto"><table className="w-full">{header(["Código", "Unidad", "Tipo de control", "Descripción", "Estado"])}<tbody>{controlUnits.map(u => <tr className="border-t text-sm" key={u.code}><td className="px-4 py-4 font-bold text-blue-800">{u.code}</td><td className="px-4 py-4">{u.name}</td><td className="px-4 py-4">{u.kind}</td><td className="px-4 py-4 text-slate-500">{u.detail}</td><td className="px-4 py-4"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Protegida</span></td></tr>)}</tbody></table></div><p className="p-4 text-xs text-slate-500">Las unidades HORAS y KM necesitan un medidor físico del activo. DÍAS y MESES se calculan mediante fechas de referencia.</p></div>}
</>}
</main></div>
{dialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex justify-between"><h2 className="text-xl font-bold">{dialog}</h2><button onClick={close} className="text-xl">✕</button></div><div className="mt-5 space-y-4">
{dialog === "Tipo mantenimiento" && <>{field("Nombre del tipo de mantenimiento", "name")}{field("Descripción", "description")}</>}
{dialog === "Activo" && <>{field("Código", "code")}{field("Nombre", "name")}{field("Tipo", "type")}</>}
{dialog === "Medidor" && <>{sel("Activo", "asset", assetOptions)}{sel("Unidad de medición", "unit", units.slice(0, 2))}{field("Nombre del medidor", "name")}</>}
{(dialog === "Lectura" || dialog === "Plan") && sel("Activo", "asset", assetOptions)}
{dialog === "Lectura" && <>{sel("Medidor", "meter", meters.filter(m => m.asset === Number(draft.asset)).map(m => ({
              value: String(m.id),
              label: m.name + " (" + m.unit + ")"
            })))}{field("Fecha de lectura", "date", "date")}{field("Valor de lectura", "value", "number")}</>}
{(dialog === "Plan" || dialog === "Regla" || dialog === "Cambiar control") && <>
{dialog === "Plan" && sel("Tipo de mantenimiento", "name", maintTypes.filter(t => t.active).map(t => ({
              value: t.name,
              label: t.name
            })))}
<label className="block text-sm font-medium text-slate-600">Unidad de control<select className={styles.input + " mt-1"} value={draft.unit ?? ""} onChange={e => {
                const u = e.target.value;
                const defaults = u === "Horas" ? appSettings.hours : u === "Kilómetros" ? appSettings.km : u === "Días" ? appSettings.days : appSettings.months;
                setDraft((d: any) => ({
                  ...d,
                  unit: u,
                  meter: "",
                  alert: defaults
                }));
              }}><option value="">Seleccionar unidad</option>{units.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}</select></label>
{["Horas", "Kilómetros"].includes(draft.unit) && sel("Medidor del equipo", "meter", meters.filter(m => m.asset === Number(draft.asset || plans.find(p => p.id === Number(draft.plan))?.asset) && m.unit === draft.unit).map(m => ({
              value: String(m.id),
              label: m.name
            })))}
{field("Frecuencia", "freq", "number")}
{["Horas", "Kilómetros"].includes(draft.unit) && field("Lectura base del ciclo", "base", "number")}
{field("Alerta anticipada (unidades o días)", "alert", "number")}
{field("Fecha de referencia", "startDate", "date")}
</>}
{dialog === "Orden" && <>{sel("Plan activo", "plan", plans.filter(p => p.active !== false).map(p => ({
              value: String(p.id),
              label: asset(p.asset) + " — " + p.name
            })))}{field("Fecha programada", "date", "date")}{field("Observación", "notes")}</>}
{dialog === "Completar orden" && <>{(() => {
              const ord = orders.find(o => o.id === Number(draft.order));
              const p = plans.find(x => x.id === ord?.plan);
              return <><div className="rounded-lg bg-blue-50 p-3 text-sm"><b>ORD-{draft.order}</b> · {p?.name} · {asset(p?.asset || 0)}</div>{field("Fecha efectiva de ejecución", "doneAt", "date")}{p && ["Horas", "Kilómetros"].includes(p.unit) && field("Lectura real al terminar (" + p.unit + ")", "valueAt", "number")}{field("Observaciones del servicio", "notes")}<div className="border-t pt-3"><h3 className="mb-3 font-semibold">Repuestos utilizados</h3>{partRows.map((pr, i) => <div className="mb-2 flex items-center gap-2" key={i}><select className={styles.input} value={pr.index} onChange={e => setPartRows(rows => rows.map((x, k) => k === i ? {
                      ...x,
                      index: Number(e.target.value)
                    } : x))}>{items.map((it, j) => <option key={j} value={j}>{it.name} · {money(it.price)}</option>)}</select><input type="number" min="1" className={styles.input + " w-20"} value={pr.quantity} onChange={e => setPartRows(rows => rows.map((x, k) => k === i ? {
                      ...x,
                      quantity: Number(e.target.value)
                    } : x))} /><button onClick={() => setPartRows(rows => rows.filter((_, k) => i !== k))}>✕</button></div>)}<button className="text-sm font-semibold text-blue-700" onClick={() => setPartRows(rows => [...rows, {
                    index: 0,
                    quantity: 1
                  }])}>+ Añadir repuesto</button><div className="mt-4 text-right font-bold">Total: {money(partRows.reduce((sum, pr) => sum + (items[pr.index]?.price || 0) * pr.quantity, 0))}</div></div></>;
            })()}</>}
{dialog === "Detalle orden" && <>{(() => {
              const ord = orders.find(o => o.id === Number(draft.order));
              return <><p className="text-sm"><b>ORD-{ord?.id}</b> · {ord?.status}</p><p className="text-sm">Fecha: {ord?.doneAt || ord?.date} · Lectura: {ord?.valueAt ?? "No aplica"}</p><p className="text-sm">Configuración histórica: {ord?.snapshot || "No registrada"}</p><p className="text-sm">Observaciones: {ord?.notes || "Sin observaciones"}</p><div className="border-t pt-3">{(ord?.parts || []).map(p => <div className="flex justify-between text-sm" key={p.index}><span>{p.name} × {p.quantity}</span><span>{money(p.price * p.quantity)}</span></div>)}<p className="mt-3 text-right font-bold">Total: {money((ord?.parts || []).reduce((x, p) => x + p.price * p.quantity, 0))}</p></div></>;
            })()}</>}
{dialog === "Repuesto" && <>{field("Nombre", "name")}{field("Unidad", "unit")}{field("Costo de referencia USD", "price", "number")}</>}
{message && <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{message}</p>}
<div className="flex justify-end gap-3 border-t pt-4"><button className="rounded-lg border px-4 py-2 text-sm" onClick={close}>Cerrar</button>{dialog !== "Detalle orden" && <button className={styles.button} onClick={save}>Guardar</button>}</div></div></div></div>}
</div>;
};