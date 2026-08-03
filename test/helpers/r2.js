function bytesFrom(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof value === 'string') return new TextEncoder().encode(value);
  return new Uint8Array(value || []);
}

function etagFor(bytes) {
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return `"${(hash >>> 0).toString(16)}"`;
}

export class MemoryR2 {
  constructor() {
    this.objects = new Map();
  }

  async put(key, value, options = {}) {
    let bytes;
    if (value && typeof value.arrayBuffer === 'function') bytes = new Uint8Array(await value.arrayBuffer());
    else if (value && typeof value.getReader === 'function') bytes = new Uint8Array(await new Response(value).arrayBuffer());
    else bytes = bytesFrom(value);
    this.objects.set(String(key), {
      bytes,
      etag: etagFor(bytes),
      uploaded: new Date().toISOString(),
      httpMetadata: options.httpMetadata || {},
      customMetadata: options.customMetadata || {},
    });
  }

  object(key, entry) {
    const bytes = entry.bytes;
    return {
      key,
      size: bytes.byteLength,
      etag: entry.etag,
      uploaded: entry.uploaded,
      httpEtag: entry.etag,
      httpMetadata: entry.httpMetadata,
      customMetadata: entry.customMetadata,
      body: new Response(bytes).body,
      text: async () => new TextDecoder().decode(bytes),
      arrayBuffer: async () => bytes.slice().buffer,
      writeHttpMetadata(headers) {
        for (const [name, value] of Object.entries(entry.httpMetadata || {})) headers.set(name, value);
      },
    };
  }

  async get(key) {
    const entry = this.objects.get(String(key));
    return entry ? this.object(String(key), entry) : null;
  }

  async head(key) {
    const entry = this.objects.get(String(key));
    return entry ? this.object(String(key), entry) : null;
  }

  async delete(keys) {
    for (const key of Array.isArray(keys) ? keys : [keys]) this.objects.delete(String(key));
  }

  async list({ prefix = '', cursor } = {}) {
    const keys = [...this.objects.keys()].filter(key => key.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    const page = keys.slice(start, start + 1000);
    const next = start + page.length;
    return {
      objects: page.map(key => this.object(key, this.objects.get(key))),
      truncated: next < keys.length,
      cursor: next < keys.length ? String(next) : undefined,
    };
  }
}
