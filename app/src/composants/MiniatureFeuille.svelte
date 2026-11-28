<script lang="ts">
  // Miniature de la feuille de route sur l'accueil public (US-157 CA-2) : la première page du PDF, dessinée par pdf.js
  // (chargé à la demande), à la taille de l'affiche ; un lien l'ouvre dans un nouvel onglet. Tant que la page n'est pas
  // dessinée, ou si elle ne peut pas l'être (hors ligne, fichier illisible), l'icône « Document » la remplace.
  import { apercuPdf } from '../lib/apercu-pdf';
  import Icone from './Icone.svelte';

  interface Proprietes {
    /** Absente si le serveur public n’est pas configuré : l’icône « Document » reste seule. */
    adresse: string | null;
    /** Nom accessible et infobulle du lien. */
    libelle: string;
  }

  let { adresse, libelle }: Proprietes = $props();

  let page: HTMLElement | undefined = $state();
  let prete = $state(false);

  $effect(() => {
    if (!page || !adresse) return;
    const controleur = new AbortController();
    const cible = page;
    prete = false;
    apercuPdf(adresse, 112, controleur.signal)
      .then(({ canevas }) => {
        if (controleur.signal.aborted) return;
        canevas.setAttribute('aria-hidden', 'true');
        cible.replaceChildren(canevas);
        prete = true;
      })
      .catch(() => {});
    return () => controleur.abort();
  });
</script>

<a class="feuille" class:prete href={adresse} target="_blank" rel="noopener" aria-label={libelle} title={libelle}>
  <span class="page" bind:this={page}><Icone nom="document" taille={28} /></span>
</a>

<style>
  .feuille {
    display: inline-grid;
    place-items: center;
    min-width: 2.75rem;
    min-height: 2.75rem;
    border: 1px solid var(--bordure);
    border-radius: 0.4rem;
    overflow: hidden;
    color: var(--texte-discret);
    background: var(--surface-2);
  }

  .feuille:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .feuille:not(.prete) {
    width: 5rem;
    height: 7rem;
  }

  .page {
    display: grid;
    place-items: center;
  }

  /* Même encombrement que l'affiche : 7rem au plus dans chaque sens. */
  .page :global(canvas) {
    display: block;
    max-width: 7rem;
    max-height: 7rem;
    width: auto;
    height: auto;
  }
</style>
