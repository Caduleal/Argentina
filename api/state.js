import { configuredStore } from "../lib/store.js";
import { DataError, publicState } from "../lib/model.js";

export function makeStateHandler(getStore = configuredStore) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      const store = getStore();
      if (req.method === "GET") {
        const { data } = await store.read();
        res.status(200).json(publicState(data));
        return;
      }
      if (req.method !== "POST") {
        res.setHeader("Allow", "GET, POST");
        throw new DataError("Método não permitido.", 405);
      }
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host)
        throw new DataError("Origem não permitida.", 403);
      if (!(req.headers["content-type"] || "").startsWith("application/json"))
        throw new DataError("Envie JSON.", 415);
      const body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!body || JSON.stringify(body).length > 16000)
        throw new DataError("Requisição inválida.");
      const data = await store.mutate(body);
      res.status(200).json(publicState(data));
    } catch (error) {
      const known = error instanceof DataError;
      res.status(known ? error.status : 503).json({
        error: known
          ? error.message
          : "O armazenamento online não respondeu. Nenhuma alteração foi confirmada. Tente novamente.",
      });
    }
  };
}
export default makeStateHandler();
