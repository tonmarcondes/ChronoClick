const DATABASE = "chronoclick-projects";
const VERSION = 1;

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(mode, callback) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("assets", mode);
      const result = callback(transaction.objectStore("assets"));
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Operação cancelada."));
    });
  } finally {
    db.close();
  }
}

function assetKey(projectId, relativePath) {
  return `${projectId}:${relativePath}`;
}

export async function saveEventAssets(projectId, step, screenDataUrl, microDataUrl) {
  const screen = `screenshots/screen-${step.id}.png`;
  const microprint = microDataUrl ? `components/step-${step.id}.png` : null;
  await transact("readwrite", (store) => {
    store.put(screenDataUrl, assetKey(projectId, screen));
    if (microprint) store.put(microDataUrl, assetKey(projectId, microprint));
  });
  return { screen, microprint };
}

export async function readAsset(projectId, relativePath) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction("assets", "readonly")
        .objectStore("assets")
        .get(assetKey(projectId, relativePath));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function readProjectAssets(projectId, session) {
  const paths = new Set();
  for (const step of session.steps || []) {
    if (step.images?.screen) paths.add(step.images.screen);
    if (step.images?.microprint) paths.add(step.images.microprint);
  }
  for (const group of session.groups || []) if (group.screenshot) paths.add(group.screenshot);
  const entries = await Promise.all(
    [...paths].map(async (relativePath) => [
      relativePath,
      await readAsset(projectId, relativePath),
    ]),
  );
  return Object.fromEntries(entries.filter(([, value]) => value));
}

export async function removeProjectAssets(projectId) {
  const db = await database();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("assets", "readwrite");
      const store = transaction.objectStore("assets");
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (String(cursor.key).startsWith(`${projectId}:`)) cursor.delete();
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
