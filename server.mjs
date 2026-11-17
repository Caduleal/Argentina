import http from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import stateHandler from "./api/state.js";
import voucherHandler from "./api/voucher.js";
import { initialState, publicState } from "./lib/model.js";

// A local visual preview does not claim to have saved anything without a Blob store.
export async function developmentStateHandler(req, res) {
  if (
    !process.env.BLOB_READ_WRITE_TOKEN &&
    !process.env.BLOB_STORE_ID &&
    req.method === "GET"
  ) {
    res.setHeader("Cache-Control", "no-store");
    res
      .status(200)
      .json({ ...publicState(await initialState()), preview: true });
    return;
  }
  return stateHandler(req, res);
}

export function createAppServer(handleState = developmentStateHandler) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (value) => {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(value));
    };
    res.send = (value) => res.end(value);
    req.query = Object.fromEntries(url.searchParams);
    try {
      if (req.method === "POST") {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 16000) {
            res.status(413).json({ error: "Requisição muito grande." });
            return;
          }
        }
        try {
          req.body = JSON.parse(body);
        } catch {
          res.status(400).json({ error: "JSON inválido." });
          return;
        }
      }
      if (url.pathname === "/api/state") return await handleState(req, res);
      if (url.pathname === "/api/voucher")
        return await voucherHandler(req, res);
      if (url.pathname !== "/" && url.pathname !== "/index.html") {
        res.status(404).end();
        return;
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(await readFile(new URL("./dist/index.html", import.meta.url)));
    } catch {
      if (!res.writableEnded)
        res.status(500).end("Erro ao abrir o aplicativo.");
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  createAppServer().listen(Number(process.env.PORT || 4174), "127.0.0.1", () =>
    console.log("Guia: http://127.0.0.1:" + (process.env.PORT || 4174)),
  );
}
