import { get, put, BlobPreconditionFailedError } from "@vercel/blob";
import { applyOperation, DataError, initialState } from "./model.js";

// Never fall back to browser storage, process memory or the function filesystem.
export function createStore(adapter, pathname) {
  async function read() {
    const stored = await adapter.read(pathname);
    if (stored) {
      if (stored.data.schemaVersion !== 1)
        throw new DataError(
          "Versão de dados incompatível. O arquivo existente foi preservado.",
          503,
        );
      return stored;
    }
    const seed = await initialState();
    try {
      await adapter.create(pathname, seed);
    } catch (error) {
      if (!adapter.conflict(error)) throw error;
    }
    const created = await adapter.read(pathname);
    if (!created)
      throw new DataError("Não foi possível inicializar o armazenamento.", 503);
    return created;
  }

  async function mutate(operation) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const existing = await read();
      const next = applyOperation(existing.data, operation);
      if (next === existing.data) return existing.data;
      try {
        await adapter.write(pathname, next, existing.etag);
        return next;
      } catch (error) {
        if (!adapter.conflict(error)) throw error;
      }
    }
    throw new DataError(
      "Outra alteração está sendo gravada. Tente novamente.",
      409,
    );
  }
  return { read, mutate };
}

const options = () => ({
  access: "private",
  ...(process.env.BLOB_READ_WRITE_TOKEN
    ? { token: process.env.BLOB_READ_WRITE_TOKEN }
    : {}),
});
const adapter = {
  async read(pathname) {
    const result = await get(pathname, {
      ...options(),
      useCache: false,
      abortSignal: AbortSignal.timeout(12000),
    });
    if (!result) return null;
    if (!result.stream)
      throw new DataError("Resposta de armazenamento incompleta.", 503);
    const data = JSON.parse(await new Response(result.stream).text());
    return { data, etag: result.blob.etag };
  },
  async create(pathname, data) {
    await put(pathname, JSON.stringify(data, null, 2), {
      ...options(),
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: false,
    });
  },
  async write(pathname, data, etag) {
    await put(pathname, JSON.stringify(data, null, 2), {
      ...options(),
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      ifMatch: etag,
    });
  },
  conflict(error) {
    return (
      error instanceof BlobPreconditionFailedError ||
      /already exists/i.test(error.message)
    );
  },
};

export function configuredStore() {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID)
    throw new DataError(
      "Conecte um Vercel Blob privado ao projeto para ativar o salvamento online.",
      503,
    );
  const pathname = process.env.TRIP_DATA_PATH || "argentina-2026/trip.json";
  return createStore(adapter, pathname);
}
