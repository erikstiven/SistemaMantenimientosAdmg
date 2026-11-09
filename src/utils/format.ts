export const TODAY = new Date().toLocaleDateString('en-CA');
export const format = (n: number) => n.toLocaleString('es-EC');
export function addDuration(date: string, num: number, unit: string) {
  const d = new Date(date + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return TODAY;
  if (unit === 'Meses') {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + num);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  } else d.setDate(d.getDate() + num);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 86400000);
}
export function money(x: number) {
  return x.toLocaleString('es-EC', {
    style: 'currency',
    currency: 'USD',
  });
}
