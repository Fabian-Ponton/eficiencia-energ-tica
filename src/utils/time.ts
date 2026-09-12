const rtf = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto' });

/** «hace 3 horas», «ayer», «hace 2 semanas»… */
export function relativeTime(timestamp: number, now = Date.now()): string {
  const seconds = (timestamp - now) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 60) return 'hace un momento';
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86_400 * 14) return rtf.format(Math.round(seconds / 86_400), 'day');
  if (abs < 86_400 * 60) return rtf.format(Math.round(seconds / (86_400 * 7)), 'week');
  if (abs < 86_400 * 365) return rtf.format(Math.round(seconds / (86_400 * 30)), 'month');
  return rtf.format(Math.round(seconds / (86_400 * 365)), 'year');
}
