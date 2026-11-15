// Fichiers de test des documents joints (US-072, US-073) : une image PNG, un vrai PDF et un PDF illisible, chacun au contenu unique
// (le serveur partage les contenus identiques).
import zlib from 'node:zlib';

/** Image PNG de 1 × 1 pixel, de couleur tirée au hasard (le serveur partage les contenus identiques). */
export function pngUnique() {
  const bloc = (type: string, donnees: Buffer) => {
    const corps = Buffer.concat([Buffer.from(type), donnees]);
    const longueur = Buffer.alloc(4);
    longueur.writeUInt32BE(donnees.length);
    const somme = Buffer.alloc(4);
    somme.writeUInt32BE(zlib.crc32(corps));
    return Buffer.concat([longueur, corps, somme]);
  };
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(1, 0);
  entete.writeUInt32BE(1, 4);
  entete.set([8, 2, 0, 0, 0], 8);
  const pixel = zlib.deflateSync(Buffer.from([0, ...crypto.getRandomValues(new Uint8Array(3))]));
  const octets = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc('IHDR', entete),
    bloc('IDAT', pixel),
    bloc('IEND', Buffer.alloc(0)),
  ]);
  return { name: 'affiche.png', mimeType: 'image/png', buffer: octets };
}

/** Un vrai PDF de `pages` pages A6, avec une table des références exacte ; le texte rend le contenu unique. */
export function pdfValide(pages: number) {
  const unique = crypto.randomUUID();
  const objets: string[] = [];
  const kids = Array.from({ length: pages }, (_, i) => `${4 + i * 2} 0 R`).join(' ');
  objets.push('<< /Type /Catalog /Pages 2 0 R >>');
  objets.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`);
  objets.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  for (let i = 0; i < pages; i++) {
    objets.push('PAGE');
    objets.push('FLUX');
    void i;
  }
  let sortie = '%PDF-1.4\n';
  const positions: number[] = [];
  const ecrire = (numero: number, corps: string) => {
    positions[numero] = sortie.length;
    sortie += `${numero} 0 obj\n${corps}\nendobj\n`;
  };
  ecrire(1, objets[0]!);
  ecrire(2, objets[1]!);
  ecrire(3, objets[2]!);
  for (let i = 0; i < pages; i++) {
    const page = 4 + i * 2;
    const flux = `BT /F1 18 Tf 20 100 Td (Page ${i + 1} ${unique.slice(0, 8)}) Tj ET`;
    ecrire(
      page,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 298 420] /Resources << /Font << /F1 3 0 R >> >> /Contents ${page + 1} 0 R >>`,
    );
    ecrire(page + 1, `<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`);
  }
  const total = 4 + pages * 2;
  const debutTable = sortie.length;
  sortie += `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) sortie += `${String(positions[n]).padStart(10, '0')} 00000 n \n`;
  sortie += `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${debutTable}\n%%EOF\n`;
  return { name: 'feuille-de-route.pdf', mimeType: 'application/pdf', buffer: Buffer.from(sortie, 'latin1') };
}

/** Un « PDF » que le navigateur ne sait pas lire : l'en-tête seul, complété d'espaces. */
export const pdfIllisible = () => {
  const octets = Buffer.alloc(2_000, 0x20);
  octets.write(`%PDF-1.4\n% ${crypto.randomUUID()}\n`);
  return { name: 'feuille-de-route.pdf', mimeType: 'application/pdf', buffer: octets };
};
