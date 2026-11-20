<script lang="ts">
  // Gabarit commun d'une page imprimée (US-120 CA-3, ADR-0009, planches 23 à 30) : une feuille A4 (portrait ou paysage)
  // ou A3 paysage, avec l'en-tête (Poule Position, épreuve, arme, compétition, date, titre) et le pied (« Imprimé le … »,
  // « Page n / N »). À l'écran, la feuille se montre comme du papier ; à l'impression, chaque feuille est une page.
  import type { Snippet } from 'svelte';
  import { textes } from '../lib/textes';

  interface Proprietes {
    /** Ligne discrète de l'en-tête : épreuve, arme, compétition, date. */
    contexte: string;
    titre: string;
    numero: number;
    total: number;
    imprimeLe: Date;
    /** Texte du pied, après la date d'impression. */
    pied?: string;
    /** Numérotation propre au document (« Poule 2 / 4 ») à la place de « Page n / N ». */
    pagination?: string;
    orientation?: 'portrait' | 'paysage';
    papier?: 'a4' | 'a3';
    /** À droite du titre (mention « Provisoire », QR code…). */
    aDroite?: Snippet;
    children: Snippet;
  }

  let {
    contexte,
    titre,
    numero,
    total,
    imprimeLe,
    pied,
    pagination,
    orientation = 'portrait',
    papier = 'a4',
    aDroite,
    children,
  }: Proprietes = $props();

  const t = textes.impressions;
</script>

<section
  class="feuille {orientation} {papier}"
  aria-label={`${titre} · ${pagination ?? t.page(numero, total)}`}
  data-page={numero}
>
  <header>
    <div class="titres">
      <p class="contexte">{t.marque} · {contexte}</p>
      <h1>{titre}</h1>
    </div>
    {#if aDroite}<div class="droite">{@render aDroite()}</div>{/if}
  </header>
  <div class="contenu">{@render children()}</div>
  <footer>
    <span>{t.imprimeLe(imprimeLe)}{pied ? ` · ${pied}` : ''}</span>
    <span>{pagination ?? t.page(numero, total)}</span>
  </footer>
</section>

<style>
  /* Le papier reste noir sur blanc, quel que soit le thème de l'application. */
  .feuille {
    --encre: var(--papier-encre);
    --encre-discrete: var(--papier-encre-discrete);
    --trait: var(--papier-trait);
    --marque-papier: var(--papier-marque);
    display: flex;
    flex-direction: column;
    gap: 4mm;
    box-sizing: border-box;
    width: 210mm;
    height: 297mm;
    padding: 12mm 13mm 10mm;
    overflow: hidden;
    background: var(--papier-fond);
    color: var(--encre);
    font-family: var(--police-texte);
    font-size: 10pt;
    line-height: 1.35;
    box-shadow: var(--papier-ombre);
    page: a4portrait;
  }

  .feuille.paysage {
    width: 297mm;
    height: 210mm;
    page: a4paysage;
  }

  .feuille.paysage.a3 {
    width: 420mm;
    height: 297mm;
    page: a3paysage;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 6mm;
    padding-bottom: 2.5mm;
    border-bottom: 2px solid var(--marque-papier);
  }

  .contexte {
    margin: 0;
    color: var(--encre-discrete);
    font-size: 9pt;
  }

  h1 {
    margin: 1mm 0 0;
    color: var(--marque-papier);
    font-family: var(--police-titre);
    font-size: 21pt;
    line-height: 1.15;
  }

  .contenu {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4mm;
    min-height: 0;
  }

  footer {
    display: flex;
    justify-content: space-between;
    gap: 6mm;
    padding-top: 2mm;
    border-top: 1px solid var(--trait);
    color: var(--encre-discrete);
    font-size: 9pt;
  }

  @media print {
    .feuille {
      box-shadow: none;
      break-after: page;
    }

    .feuille:last-child {
      break-after: auto;
    }
  }

  @page a4portrait {
    size: A4 portrait;
    margin: 0;
  }

  @page a4paysage {
    size: A4 landscape;
    margin: 0;
  }

  @page a3paysage {
    size: A3 landscape;
    margin: 0;
  }
</style>
