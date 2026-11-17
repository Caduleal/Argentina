import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

const insuranceDocuments = JSON.parse(
  readFileSync(new URL("../data/insurance.json", import.meta.url), "utf8"),
);
const fixedPlaces = JSON.parse(
  readFileSync(new URL("../data/fixed-places.json", import.meta.url), "utf8"),
);

export class DataError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const validMoney = (n) => Number.isFinite(n) && n >= 0 && n <= 999999999;
export const validRate = (n) =>
  Number.isFinite(n) && n >= 0.000001 && n <= 1000000;
const cents = (n) => Math.round((n + Number.EPSILON) * 100);
const text = (value, max, required = false) => {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new DataError("Texto inválido.");
  return value.trim();
};
const id = (value) => {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(value))
    throw new DataError("Identificador inválido.");
  return value;
};
const day = (value) => {
  if (!Number.isInteger(value) || value < 22 || value > 29)
    throw new DataError("Dia inválido.");
  return value;
};

export async function initialState() {
  const seed = JSON.parse(
    await readFile(new URL("../data/initial.json", import.meta.url), "utf8"),
  );
  const plannedDays = JSON.parse(
    await readFile(
      new URL("../data/planned-days.json", import.meta.url),
      "utf8",
    ),
  );
  seed.itinerary = Array.from({ length: 8 }, (_, index) => ({
    day: 22 + index,
    places: [],
    photos: [],
    activities: [],
    ...plannedDays.find((entry) => entry.day === 22 + index),
  }));
  return seed;
}

export function expenseFrom(input) {
  if (
    !validMoney(input.amount) ||
    input.amount <= 0 ||
    !["ARS", "BRL"].includes(input.currency)
  )
    throw new DataError("Valor ou moeda inválidos.");
  if (!["Crédito", "Débito", "Dinheiro"].includes(input.payment))
    throw new DataError("Pagamento inválido.");
  if (
    !["Restaurante", "Transporte", "Presentes", "Mercado", "Outros"].includes(
      input.category,
    )
  )
    throw new DataError("Categoria inválida.");
  const rate = input.currency === "BRL" ? 1 : input.rate;
  if (!validRate(rate)) throw new DataError("Informe uma cotação válida.");
  const amount = cents(input.amount) / 100;
  const brlCents = cents(amount * rate);
  if (!Number.isSafeInteger(brlCents))
    throw new DataError("Valor convertido acima do limite.");
  return {
    id: id(input.id),
    name: text(input.name, 80, true),
    day: day(input.day),
    amount,
    currency: input.currency,
    rate,
    brlCents,
    payment: input.payment,
    category: input.category,
    other: input.category === "Outros" ? text(input.other, 60, true) : "",
  };
}

export function placeFrom(input) {
  if (
    !Number.isFinite(input.lat) ||
    Math.abs(input.lat) > 90 ||
    !Number.isFinite(input.lon) ||
    Math.abs(input.lon) > 180
  )
    throw new DataError("Coordenadas inválidas.");
  const time = text(input.time || "", 5);
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new DataError("Horário inválido.");
  return {
    id: id(input.id),
    name: text(input.name, 100, true),
    lat: input.lat,
    lon: input.lon,
    time,
    price: text(input.price || "", 100),
    transport: text(input.transport || "", 250),
    note: text(input.note || "", 500),
  };
}

// Each operation changes only its own fields, so simultaneous additions are merged.
export function applyOperation(
  current,
  operation,
  now = new Date().toISOString(),
) {
  if (
    !current ||
    current.schemaVersion !== 1 ||
    !Array.isArray(current.itinerary) ||
    !Array.isArray(current.budget?.expenses)
  )
    throw new DataError(
      "O arquivo de dados existente precisa de revisão. Nenhum dado foi reiniciado.",
      503,
    );
  id(operation.id);
  if (current.recentOperations.includes(operation.id)) return current;
  const next = structuredClone(current);
  const payload = operation.payload || {};
  switch (operation.type) {
    case "budget.limit":
      if (!validMoney(payload.limit)) throw new DataError("Limite inválido.");
      next.budget.limit = cents(payload.limit) / 100;
      break;
    case "budget.rate":
      if (!validRate(payload.rate)) throw new DataError("Cotação inválida.");
      next.budget.rate = payload.rate;
      break;
    case "expense.save": {
      const expense = expenseFrom(payload);
      const index = next.budget.expenses.findIndex((e) => e.id === expense.id);
      if (index < 0) next.budget.expenses.push(expense);
      else next.budget.expenses[index] = expense;
      if (expense.currency === "ARS") next.budget.rate = expense.rate;
      break;
    }
    case "expense.delete":
      next.budget.expenses = next.budget.expenses.filter(
        (e) => e.id !== id(payload.id),
      );
      break;
    case "place.save": {
      const entry = next.itinerary.find((d) => d.day === day(payload.day));
      const place = placeFrom(payload.place);
      const index = entry.places.findIndex((p) => p.id === place.id);
      if (index < 0) entry.places.push(place);
      else entry.places[index] = place;
      break;
    }
    case "place.delete": {
      const entry = next.itinerary.find((d) => d.day === day(payload.day));
      entry.places = entry.places.filter((p) => p.id !== id(payload.id));
      break;
    }
    case "place.up": {
      const entry = next.itinerary.find((d) => d.day === day(payload.day));
      const index = entry.places.findIndex((p) => p.id === id(payload.id));
      if (index > 0)
        [entry.places[index - 1], entry.places[index]] = [
          entry.places[index],
          entry.places[index - 1],
        ];
      break;
    }
    case "info.update":
      if (
        !["accommodation", "transfers", "reservations"].includes(payload.field)
      )
        throw new DataError("Informação inválida.");
      next.info[payload.field] = text(payload.value, 3000);
      break;
    case "photos.set": {
      const entry = next.itinerary.find((d) => d.day === day(payload.day));
      if (!Array.isArray(payload.photos) || payload.photos.length > 6)
        throw new DataError("Use até seis fotos por dia.");
      entry.photos = payload.photos.map((photo) => {
        let url;
        try {
          url = new URL(text(photo.url, 2000, true));
        } catch {
          throw new DataError("Endereço de imagem inválido.");
        }
        if (url.protocol !== "https:")
          throw new DataError("Use uma imagem com endereço HTTPS.");
        return { url: url.href, alt: text(photo.alt, 160, true) };
      });
      break;
    }
    default:
      throw new DataError("Operação desconhecida.");
  }
  if (JSON.stringify(next).length > 1000000)
    throw new DataError("O arquivo atingiu o limite de tamanho.");
  next.revision += 1;
  next.updatedAt = now;
  next.recentOperations = [...current.recentOperations, operation.id].slice(
    -200,
  );
  return next;
}

export function publicState(state) {
  const { recentOperations, ...data } = state;
  // Include new document metadata without replacing any existing shared trip data.
  return { ...data, insurance: insuranceDocuments, fixedPlaces };
}
