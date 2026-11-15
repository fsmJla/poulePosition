// Taille d'un fichier en français (US-072) : « 820 Ko », « 1,2 Mo ».
export function formaterTaille(octets: number): string {
  if (!Number.isFinite(octets) || octets < 0) return '';
  if (octets < 1000) return `${octets} o`;
  if (octets < 1_000_000) return `${Math.round(octets / 1000)} Ko`;
  const mo = octets / 1_000_000;
  return `${mo.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: mo < 10 ? 1 : 0 })} Mo`;
}
