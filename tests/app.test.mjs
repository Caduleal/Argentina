import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import {
  applyOperation,
  initialState,
  expenseFrom,
  DataError,
  publicState,
} from "../lib/model.js";
import { createStore } from "../lib/store.js";
import stateHandler from "../api/state.js";
import voucherHandler from "../api/voucher.js";
import { developmentStateHandler } from "../server.mjs";

const operation = (type, payload, id = "operation-" + crypto.randomUUID()) => ({
  id,
  type,
  payload,
});
const expense = (overrides = {}) => ({
  id: "expense-" + crypto.randomUUID(),
  name: "Teste automatizado",
  amount: 10000,
  currency: "ARS",
  rate: 0.0035,
  day: 22,
  payment: "Crédito",
  category: "Restaurante",
  other: "",
  ...overrides,
});

// The adapter is a test double of external storage, not a production fallback.
function durableAdapter() {
  let record = null;
  let version = 0;
  return {
    async read() {
      return record
        ? { data: structuredClone(record), etag: String(version) }
        : null;
    },
    async create(path, data) {
      if (record) throw Object.assign(Error("exists"), { code: "CAS" });
      record = structuredClone(data);
      version++;
    },
    async write(path, data, etag) {
      await new Promise((resolve) => setTimeout(resolve, 2));
      if (etag !== String(version))
        throw Object.assign(Error("conflict"), { code: "CAS" });
      record = structuredClone(data);
      version++;
    },
    conflict: (error) => error.code === "CAS",
  };
}

test("a seed contém seis dias planejados e dois dias em aberto", async () => {
  const data = await initialState();
  assert.equal(data.itinerary.length, 8);
  assert.ok(
    data.itinerary
      .filter((day) => day.day >= 28)
      .every((day) => day.places.length === 0 && day.photos.length === 0),
  );
  assert.equal(
    data.itinerary.find((day) => day.day === 22).places[0].name,
    "Obelisco",
  );
  assert.equal(
    data.itinerary.find((day) => day.day === 22).activities[1].name,
    "Restante do dia livre",
  );
  assert.equal(data.itinerary.find((day) => day.day === 23).places.length, 4);
  const monday = data.itinerary.find((day) => day.day === 23);
  assert.equal(monday.photos.length, 4);
  assert.ok(!monday.places.some((place) => place.name === "Floralis Genérica"));
  assert.deepEqual(
    monday.photos.map((photo) => photo.placeId),
    monday.places.map((place) => place.id),
  );
  assert.ok(
    monday.photos.every(
      (photo) =>
        photo.placeName &&
        photo.url.startsWith("https://turismo.buenosaires.gob.ar/"),
    ),
  );
  assert.equal(data.itinerary.find((day) => day.day === 24).places.length, 5);
  for (const number of [24, 25, 27]) {
    const day = data.itinerary.find((day) => day.day === number);
    assert.deepEqual(
      day.photos.map((photo) => photo.placeId),
      day.places.map((place) => place.id),
    );
    assert.ok(
      day.photos.every(
        (photo) => photo.placeName && photo.url.startsWith("https://"),
      ),
    );
    assert.ok(
      day.places.every(
        (place) => Number.isFinite(place.lat) && Number.isFinite(place.lon),
      ),
    );
    assert.equal(
      new Set(day.photos.map((photo) => photo.url)).size,
      day.places.length,
    );
  }
  assert.deepEqual(
    data.itinerary
      .find((day) => day.day === 25)
      .places.map((place) => place.name),
    ["La Boca", "La Bombonera", "Caminito"],
  );
  assert.equal(
    data.itinerary.find((day) => day.day === 26).weatherLocation.name,
    "Colonia del Sacramento",
  );
  assert.match(data.info.accommodation, /Paraguay 867/);
  const friday = data.itinerary.find((day) => day.day === 27);
  assert.deepEqual(
    friday.places.map((place) => place.name),
    [
      "Jardín Botánico Carlos Thays",
      "Jardín Japonés",
      "Planetario Galileo Galilei",
      "Rosedal de Palermo",
      "Floralis Genérica",
    ],
  );
  assert.equal(friday.photos.length, 5);
  assert.deepEqual(
    friday.places.map((place) => place.time),
    ["09:30", "11:00", "14:00", "15:00", "17:00"],
  );
  assert.match(data.info.accommodation, /15h.*10h/);
  assert.equal(data.flights[0].number, "7226");
  assert.equal(data.flights[1].number, "7669");
});

test("converte gastos no servidor e preserva a taxa histórica", async () => {
  let data = await initialState();
  data = applyOperation(data, operation("expense.save", expense()));
  data = applyOperation(data, operation("budget.rate", { rate: 0.004 }));
  data = applyOperation(
    data,
    operation(
      "expense.save",
      expense({ amount: 20.5, currency: "BRL", rate: 999 }),
    ),
  );
  assert.equal(
    data.budget.expenses.reduce((sum, item) => sum + item.brlCents, 0),
    5550,
  );
  assert.equal(data.budget.expenses[0].rate, 0.0035);
  assert.equal(data.budget.expenses[1].rate, 1);
  assert.throws(
    () => expenseFrom(expense({ category: "Outros", other: "  " })),
    DataError,
  );
  assert.throws(() => expenseFrom(expense({ day: 30 })), DataError);
  assert.equal(
    expenseFrom(
      expense({ category: "Outros", other: "Passeio", payment: "Dinheiro" }),
    ).other,
    "Passeio",
  );
});

test("nova instância lê as alterações sem reexecutar a seed sobre os dados", async () => {
  const adapter = durableAdapter();
  const first = createStore(adapter, "trip.json");
  await first.mutate(operation("budget.limit", { limit: 1234 }));
  await first.mutate(
    operation("info.update", {
      field: "reservations",
      value: "Informação do casal",
    }),
  );
  const reopened = createStore(adapter, "trip.json");
  const { data } = await reopened.read();
  assert.equal(data.budget.limit, 1234);
  assert.equal(data.info.reservations, "Informação do casal");
  assert.equal(data.revision, 2);
});

test("duas gravações simultâneas preservam ambas as despesas", async () => {
  const adapter = durableAdapter();
  const cadu = createStore(adapter, "trip.json");
  const vitor = createStore(adapter, "trip.json");
  await cadu.read();
  await Promise.all([
    cadu.mutate(operation("expense.save", expense({ id: "cadu-expense" }))),
    vitor.mutate(operation("expense.save", expense({ id: "vitor-expense" }))),
  ]);
  const { data } = await vitor.read();
  assert.equal(data.budget.expenses.length, 2);
  assert.equal(data.revision, 2);
});

test("repetir uma gravação após falha de rede não duplica gastos", async () => {
  const store = createStore(durableAdapter(), "trip.json");
  const action = operation("expense.save", expense());
  await store.mutate(action);
  await store.mutate(action);
  const { data } = await store.read();
  assert.equal(data.budget.expenses.length, 1);
  assert.equal(data.revision, 1);
});

test("erro no armazenamento não reinicializa dados nem anuncia sucesso", async () => {
  let created = false;
  const store = createStore(
    {
      read: async () => {
        throw Error("offline");
      },
      create: async () => {
        created = true;
      },
    },
    "trip.json",
  );
  await assert.rejects(store.read(), /offline/);
  assert.equal(created, false);
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_STORE_ID;
  const res = fakeResponse();
  await stateHandler({ method: "GET", headers: {} }, res);
  assert.equal(res.code, 503);
  assert.match(res.body.error, /Conecte um Vercel Blob/);
  if (token !== undefined) process.env.BLOB_READ_WRITE_TOKEN = token;
  if (storeId !== undefined) process.env.BLOB_STORE_ID = storeId;
});

test("fotos pertencem apenas ao dia escolhido e aceitam somente HTTPS", async () => {
  const original = await initialState();
  const data = applyOperation(
    original,
    operation("photos.set", {
      day: 23,
      photos: [
        {
          url: "https://example.com/photo.jpg",
          alt: "Imagem fornecida pelo usuário",
        },
      ],
    }),
  );
  assert.deepEqual(
    data.itinerary.find((day) => day.day === 22).photos,
    original.itinerary.find((day) => day.day === 22).photos,
  );
  assert.equal(data.itinerary.find((day) => day.day === 23).photos.length, 1);
  assert.throws(
    () =>
      applyOperation(
        data,
        operation("photos.set", {
          day: 23,
          photos: [{ url: "javascript:alert(1)", alt: "x" }],
        }),
      ),
    DataError,
  );
});

function fakeResponse() {
  return {
    code: null,
    body: null,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(value) {
      this.body = value;
    },
    send(value) {
      this.body = value;
    },
    end() {},
  };
}

test("prévia local apresenta os documentos sem simular gravação ou reiniciar o Blob", async () => {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const storeId = process.env.BLOB_STORE_ID;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_STORE_ID;
  try {
    const response = fakeResponse();
    await developmentStateHandler({ method: "GET", headers: {} }, response);
    assert.equal(response.code, 200);
    assert.equal(response.body.preview, true);
    assert.equal(response.body.insurance.length, 2);
    assert.match(response.body.info.accommodation, /Paraguay 867/);
    const production = fakeResponse();
    await stateHandler({ method: "GET", headers: {} }, production);
    assert.equal(production.code, 503);
  } finally {
    if (token !== undefined) process.env.BLOB_READ_WRITE_TOKEN = token;
    if (storeId !== undefined) process.env.BLOB_STORE_ID = storeId;
  }
});

test("passagens e seguros são PDFs completos e somente IDs conhecidos são aceitos", async () => {
  for (const id of ["cadu", "vitor", "seguro-cadu", "seguro-vitor"]) {
    const res = fakeResponse();
    await voucherHandler({ method: "GET", query: { id } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.subarray(0, 5).toString(), "%PDF-");
    const expectedFile = {
      cadu: "carlos-voo.pdf",
      vitor: "vitor-voo.pdf",
      "seguro-cadu": "carlos-seguro.pdf",
      "seguro-vitor": "vitor-seguro.pdf",
    }[id];
    assert.deepEqual(
      res.body,
      await fs.readFile(
        new URL("../data/vouchers/" + expectedFile, import.meta.url),
      ),
    );
  }
  const invalid = fakeResponse();
  await voucherHandler(
    { method: "GET", query: { id: "../initial.json" } },
    invalid,
  );
  assert.equal(invalid.code, 404);
});

test("seguros são incluídos sem reiniciar o JSON da viagem já existente", async () => {
  const existing = applyOperation(
    await initialState(),
    operation("budget.limit", { limit: 4321 }),
  );
  const result = publicState(existing);
  assert.equal(result.budget.limit, 4321);
  assert.equal(result.revision, existing.revision);
  assert.equal(result.insurance.length, 2);
  assert.equal(
    result.insurance.find((policy) => policy.label === "Vítor").cardNumber,
    "550 32801677 0C72",
  );
  assert.ok(
    result.insurance.every(
      (policy) =>
        policy.validFrom === "2026-11-22" && policy.validTo === "2026-11-29",
    ),
  );
  assert.equal(existing.insurance, undefined);
});

test("Airbnb é um ponto fixo separado dos passeios e os cards removidos não deixam referências", async () => {
  const data = publicState(await initialState());
  assert.equal(data.fixedPlaces.length, 1);
  assert.equal(data.fixedPlaces[0].id, "airbnb");
  assert.equal(data.fixedPlaces[0].lat, -34.59767);
  assert.equal(data.fixedPlaces[0].lon, -58.379297);
  assert.ok(
    data.itinerary.every(
      (day) => !day.places.some((place) => place.id === "airbnb"),
    ),
  );
  const html = await fs.readFile(
    new URL("../dist/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /id="center-airbnb"/);
  assert.doesNotMatch(html, /trip-info-form|info-field|info-value|id="export"/);
  assert.match(html, /Voos e vouchers/);
  assert.match(html, /Seguros de viagem/);
});

test("seleção automática respeita o fuso de Buenos Aires e conversor funciona nas duas direções", async () => {
  const html = await fs.readFile(
    new URL("../dist/index.html", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(html, /localStorage|sessionStorage|\/\/\s*TODO/);
  const script = html.match(/<script id="app">([\s\S]*?)<\/script>/)[1];
  new vm.Script(script);
  class Element {
    constructor() {
      this.value = "";
      this.style = {};
      this.dataset = {};
      this.children = [];
      this.classList = { toggle() {} };
    }
    append(...children) {
      this.children.push(...children);
    }
    replaceChildren() {
      this.children = [];
    }
    addEventListener() {}
    setAttribute() {}
    removeAttribute() {}
    scrollIntoView() {}
  }
  const nodes = new Map();
  const node = (name) => {
    if (!nodes.has(name)) nodes.set(name, new Element());
    return nodes.get(name);
  };
  node('input[name="category"]:checked').value = "Restaurante";
  node("#expense-currency").value = "ARS";
  node("#quick-currency").value = "ARS";
  const context = vm.createContext({
    document: {
      querySelector: node,
      querySelectorAll: () => [],
      createElement: () => new Element(),
      addEventListener() {},
    },
    window: { addEventListener() {}, scrollTo() {} },
    Intl,
    Date,
    Number,
    Math,
    JSON,
    URL,
    Set,
    AbortSignal,
    matchMedia: () => ({ matches: true }),
    setInterval() {},
    fetch: async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: "Teste sem conexão" }),
    }),
  });
  vm.runInContext(script, context);
  assert.equal(
    vm.runInContext('automaticDay(new Date("2026-11-23T02:59:59Z"))', context),
    22,
  );
  assert.equal(
    vm.runInContext('automaticDay(new Date("2026-11-23T03:00:00Z"))', context),
    23,
  );
  assert.equal(
    vm.runInContext('automaticDay(new Date("2026-11-17T12:00:00Z"))', context),
    22,
  );
  node("#exchange-rate").value = "0.004";
  node("#quick-amount").value = "10000";
  vm.runInContext("renderQuickConverter()", context);
  assert.match(node("#quick-result").textContent, /40,00/);
  node("#quick-currency").value = "BRL";
  node("#quick-amount").value = "40";
  vm.runInContext("renderQuickConverter()", context);
  assert.match(node("#quick-result").textContent, /10.000,00/);
  const plan = (await initialState()).itinerary;
  vm.runInContext(
    "TRIP.days = " + JSON.stringify(plan) + "; selectedDay = 26",
    context,
  );
  assert.equal(
    vm.runInContext("weatherLocation().name", context),
    "Colonia del Sacramento",
  );
  vm.runInContext("selectedDay = 23", context);
  assert.equal(
    vm.runInContext("weatherLocation().name", context),
    "Buenos Aires",
  );
});
