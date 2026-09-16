// Shared memory cache across API requests when running locally without MongoDB
if (!global._appMemoryStore) {
  global._appMemoryStore = {
    activeUploadId: null,
    uploads: new Map(),
    checks: new Map() // uploadId -> array of checks
  };
}

export const memoryStore = global._appMemoryStore;
