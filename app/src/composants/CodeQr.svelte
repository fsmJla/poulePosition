<script lang="ts">
  // QR code (US-096) dessiné en SVG dans l'application, sans réseau (bibliothèque qrcode-generator, MIT). Il reste noir
  // sur blanc dans les deux thèmes : les lecteurs de QR lisent mal un code inversé.
  import qrcode from 'qrcode-generator';

  interface Proprietes {
    /** Texte codé (le lien du QR). */
    texte: string;
    /** Nom accessible de l'image. */
    nom: string;
    /** Côté, en pixels CSS. */
    taille?: number;
  }

  let { texte, nom, taille = 160 }: Proprietes = $props();

  /** Modules sombres en un seul tracé, et nombre de modules par côté (marge de 4 modules autour). */
  const dessin = $derived.by(() => {
    const qr = qrcode(0, 'M');
    qr.addData(texte);
    qr.make();
    const n = qr.getModuleCount();
    let trace = '';
    for (let ligne = 0; ligne < n; ligne++) {
      for (let colonne = 0; colonne < n; colonne++) {
        if (qr.isDark(ligne, colonne)) trace += `M${colonne + 4} ${ligne + 4}h1v1h-1z`;
      }
    }
    return { trace, cote: n + 8 };
  });
</script>

<svg
  class="qr"
  role="img"
  aria-label={nom}
  width={taille}
  height={taille}
  viewBox={`0 0 ${dessin.cote} ${dessin.cote}`}
  shape-rendering="crispEdges"
>
  <rect width={dessin.cote} height={dessin.cote} class="fond" />
  <path d={dessin.trace} class="encre" />
</svg>

<style>
  .qr {
    display: block;
    border-radius: 8px;
  }

  .fond {
    fill: var(--qr-fond);
  }

  .encre {
    fill: var(--qr-encre);
  }
</style>
