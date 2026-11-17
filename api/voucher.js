import { readFile } from "node:fs/promises";

const documents = {
  vitor: "vitor-voo.pdf",
  cadu: "carlos-voo.pdf",
  "seguro-vitor": "vitor-seguro.pdf",
  "seguro-cadu": "carlos-seguro.pdf",
};
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }
  const name = Object.hasOwn(documents, req.query?.id)
    ? documents[req.query.id]
    : null;
  if (!name) {
    res.status(404).end();
    return;
  }
  try {
    const data = await readFile(
      new URL("../data/vouchers/" + name, import.meta.url),
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="' + name + '"');
    res.status(200).send(data);
  } catch {
    res.status(503).json({ error: "Documento indisponível." });
  }
}
