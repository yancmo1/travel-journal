const buildTimeConfig = {
  cartoBasemapKey: String(import.meta.env.VITE_CARTO_BASEMAP_KEY || '').trim(),
};

let runtimeConfig = { ...buildTimeConfig };
let runtimeConfigPromise;

export function getRuntimeConfig() {
  return runtimeConfig;
}

export function loadRuntimeConfig() {
  if (runtimeConfigPromise) return runtimeConfigPromise;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 1500);
  runtimeConfigPromise = fetch('/api/runtime-config', {
    headers: { accept: 'application/json' },
    signal: controller.signal,
  })
    .then(response => (response.ok ? response.json() : null))
    .then(config => {
      if (config && typeof config.cartoBasemapKey === 'string') {
        runtimeConfig = {
          ...runtimeConfig,
          cartoBasemapKey: config.cartoBasemapKey.trim(),
        };
      }
      return runtimeConfig;
    })
    .catch(() => runtimeConfig)
    .finally(() => window.clearTimeout(timeoutId));

  return runtimeConfigPromise;
}
