export function getBrandColor(token) {
  if (typeof document === 'undefined') return `var(${token})`;
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || `var(${token})`;
}

export function getBrandRgba(token, alpha = 1) {
  const color = getBrandColor(token);
  const match = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return color;

  const hex = match[1].length === 3
    ? match[1].split('').map(value => value + value).join('')
    : match[1];
  const channels = [0, 2, 4].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
  return `rgba(${channels.join(', ')}, ${alpha})`;
}
