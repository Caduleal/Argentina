// Isolated UI test harness. Never imported by a production endpoint.
// It substitutes external Blob storage; it does not demonstrate a live Blob connection.
import { createAppServer } from "../server.mjs";
import { makeStateHandler } from "../api/state.js";
import { createStore } from "../lib/store.js";

let data = null;
let etag = 0;
const adapter = {
  async read() {
    return data ? { data: structuredClone(data), etag: String(etag) } : null;
  },
  async create(path, value) {
    if (data) throw Object.assign(Error(), { code: "CAS" });
    data = structuredClone(value);
    etag++;
  },
  async write(path, value, match) {
    if (match !== String(etag)) throw Object.assign(Error(), { code: "CAS" });
    data = structuredClone(value);
    etag++;
  },
  conflict: (error) => error.code === "CAS",
};
const store = createStore(adapter, "test-only.json");
createAppServer(makeStateHandler(() => store)).listen(4175, "127.0.0.1", () =>
  console.log("TESTE DE UI ISOLADO: http://127.0.0.1:4175"),
);
