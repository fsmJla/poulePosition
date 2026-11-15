// Aperçu d'un PDF (US-072, ADR-0026) : la première page est dessinée sur un canevas par pdf.js, chargé à la demande
// (import dynamique) : ni le premier chargement de l'application ni l'usage hors ligne n'en dépendent. Aucun envoi : le
// fichier est lu dans le navigateur.
import urlTravailleur from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export interface ApercuPdf {
  canevas: HTMLCanvasElement;
  pages: number;
}

/** Octets d'un PDF donné par son contenu local ou par son adresse. */
async function lireOctets(source: Blob | string, signal?: AbortSignal): Promise<Uint8Array> {
  if (source instanceof Blob) return new Uint8Array(await source.arrayBuffer());
  const reponse = await fetch(source, { signal });
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
  return new Uint8Array(await reponse.arrayBuffer());
}

/** Dessine la première page à `largeur` pixels CSS (finesse doublée pour les écrans denses) ; lève une erreur si illisible. */
export async function apercuPdf(source: Blob | string, largeur: number, signal?: AbortSignal): Promise<ApercuPdf> {
  const [pdfjs, octets] = await Promise.all([import('pdfjs-dist'), lireOctets(source, signal)]);
  pdfjs.GlobalWorkerOptions.workerSrc = urlTravailleur;
  const tache = pdfjs.getDocument({ data: octets });
  const document = await tache.promise;
  try {
    const page = await document.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const echelle = (largeur / base.width) * Math.min(2, window.devicePixelRatio || 1);
    const vue = page.getViewport({ scale: echelle });
    const canevas = window.document.createElement('canvas');
    canevas.width = Math.ceil(vue.width);
    canevas.height = Math.ceil(vue.height);
    await page.render({ canvas: canevas, viewport: vue }).promise;
    return { canevas, pages: document.numPages };
  } finally {
    void tache.destroy();
  }
}
