const DB_NAME = "replay-assistant";
const DB_VERSION = 1;
const STORE_NAME = "saved-replays";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
        store.createIndex("gymnast", "gymnast");
      }
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function request(mode, operation) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const req = operation(store);
      req.addEventListener("success", () => resolve(req.result));
      req.addEventListener("error", () => reject(req.error));
    });
  } finally {
    db.close();
  }
}

export const saveReplay = (record) => request("readwrite", (store) => store.put(record));
export const getReplay = (id) => request("readonly", (store) => store.get(id));
export const getAllReplays = () => request("readonly", (store) => store.getAll());
export const deleteReplay = (id) => request("readwrite", (store) => store.delete(id));
