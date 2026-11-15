<script lang="ts">
  // Aperçu d'un document joint (US-072) : une vignette, qui s'ouvre en grand dans une fenêtre modale. L'affiche est une
  // image ; la feuille de route est un PDF dont la première page est dessinée par pdf.js (chargé à la demande). Une vignette
  // qui échoue est remplacée par l'icône « Document » et le nom, avec toujours « Ouvrir dans un nouvel onglet ». Réutilisé
  // par la ligne d'une épreuve (US-073).
  import type { SorteFichier } from '@poule-position/domaine';
  import { onMount } from 'svelte';
  import { apercuPdf } from '../lib/apercu-pdf';
  import { formaterTaille } from '../lib/taille';
  import { textes } from '../lib/textes';
  import Icone from './Icone.svelte';

  interface Proprietes {
    sorte: SorteFichier;
    nom: string;
    taille: number;
    /** Contenu affichable : copie gardée sur l'appareil, à défaut adresse du serveur ; absent hors ligne sans copie. */
    adresse: string | undefined;
  }

  let { sorte, nom, taille, adresse }: Proprietes = $props();

  const t = textes.fichiers.apercu;
  const libelle = $derived(sorte === 'affiche' ? textes.fichiers.affiche : textes.fichiers.feuilleDeRoute);
  type Etat = 'chargement' | 'pret' | 'illisible' | 'introuvable';

  let etat = $state<Etat>('chargement');
  let pages = $state(0);
  let ouverte = $state(false);
  let vignette: HTMLElement | undefined = $state();
  let fenetre: HTMLDialogElement | undefined = $state();
  let bouton: HTMLButtonElement | undefined = $state();
  let enLigne = $state(navigator.onLine);

  onMount(() => {
    const surReseau = () => (enLigne = navigator.onLine);
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    return () => {
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
    };
  });

  // PDF : la première page est dessinée sur un canevas, dans la vignette (jamais pour une image).
  $effect(() => {
    if (sorte !== 'feuilleDeRoute' || !adresse || !vignette) return;
    const controleur = new AbortController();
    etat = 'chargement';
    const cible = vignette;
    apercuPdf(adresse, 160, controleur.signal)
      .then(({ canevas, pages: nombre }) => {
        if (controleur.signal.aborted) return;
        canevas.setAttribute('role', 'img');
        canevas.setAttribute('aria-label', t.premierePage(libelle));
        cible.replaceChildren(canevas);
        pages = nombre;
        etat = 'pret';
      })
      .catch((erreur: unknown) => {
        if (controleur.signal.aborted) return;
        etat = /HTTP 404/.test(String(erreur)) ? 'introuvable' : 'illisible';
      });
    return () => controleur.abort();
  });

  function ouvrir() {
    ouverte = true;
    fenetre?.showModal();
  }

  /** Fermer (bouton, Échap) : le navigateur rend le focus au bouton d'origine ; on le garantit pour les anciens moteurs. */
  function fermee() {
    ouverte = false;
    bouton?.focus();
  }

  const description = $derived(
    [nom, formaterTaille(taille), sorte === 'feuilleDeRoute' && pages > 0 ? t.pages(pages) : '']
      .filter(Boolean)
      .join(' · '),
  );
  const illisible = $derived(etat === 'illisible' || etat === 'introuvable');
</script>

<div class="apercu" data-sorte={sorte}>
  {#if !adresse}
    <div class="remplacement" role="status">
      <Icone nom="document" taille={32} />
      <span>{enLigne ? t.indisponible : t.horsLigne}</span>
    </div>
  {:else if sorte === 'affiche'}
    {#if etat === 'introuvable'}
      <div class="remplacement" role="status"><Icone nom="document" taille={32} /><span>{t.introuvable}</span></div>
    {:else}
      <button type="button" class="vignette" bind:this={bouton} onclick={ouvrir} aria-label={t.agrandir(libelle)}>
        <img src={adresse} alt={libelle} onerror={() => (etat = 'introuvable')} />
      </button>
    {/if}
  {:else if illisible}
    <div class="remplacement" role="status">
      <Icone nom="document" taille={32} />
      <span>{etat === 'introuvable' ? t.introuvable : nom}</span>
    </div>
  {:else}
    <button type="button" class="vignette pdf" bind:this={bouton} onclick={ouvrir} aria-label={t.agrandir(libelle)}>
      <span class="page" bind:this={vignette}
        >{#if etat === 'chargement'}<small>{t.chargement}</small>{/if}</span
      >
    </button>
  {/if}
  <small class="description">{description}</small>
  {#if adresse && illisible}
    <a class="ouvrir" href={adresse} target="_blank" rel="noopener">{t.nouvelOnglet}</a>
  {/if}

  <dialog
    bind:this={fenetre}
    class="fenetre"
    aria-label={t.fenetre(libelle)}
    onclose={fermee}
    onclick={(evenement) => evenement.target === fenetre && fenetre?.close()}
  >
    {#if ouverte && adresse}
      <header>
        <strong>{libelle}</strong>
        <span class="boutons">
          <a class="neutre" href={adresse} target="_blank" rel="noopener">{t.nouvelOnglet}</a>
          <button type="button" class="neutre" onclick={() => fenetre?.close()}>{t.fermer}</button>
        </span>
      </header>
      {#if sorte === 'affiche'}
        <img class="grande" src={adresse} alt={libelle} />
      {:else}
        <iframe class="grande" src={adresse} title={t.fenetre(libelle)}></iframe>
      {/if}
    {/if}
  </dialog>
</div>

<style>
  .apercu {
    display: grid;
    gap: 0.35rem;
    justify-items: start;
  }

  .vignette {
    display: block;
    padding: 0;
    border: 1px solid var(--bordure);
    border-radius: 0.4rem;
    background: var(--surface);
    cursor: zoom-in;
    overflow: hidden;
  }

  .vignette:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .vignette img {
    display: block;
    max-width: min(100%, 220px);
    max-height: 160px;
    object-fit: contain;
  }

  /* Une page de PDF est toujours blanche, quel que soit le thème. */
  .page {
    display: grid;
    min-width: 120px;
    min-height: 160px;
    place-items: center;
    background: var(--surface-2);
    color: var(--texte-discret);
  }

  .page :global(canvas) {
    display: block;
    max-width: min(100%, 160px);
    height: auto;
  }

  .remplacement {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 3rem;
    padding: 0.5rem 0.75rem;
    border: 1px dashed var(--bordure);
    border-radius: 0.4rem;
    color: var(--texte-discret);
  }

  .description {
    color: var(--texte-discret);
    overflow-wrap: anywhere;
  }

  .ouvrir {
    color: var(--accent);
  }

  .fenetre {
    width: min(900px, 100vw - 2rem);
    height: min(700px, 100dvh - 2rem);
    padding: 0;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
    color: var(--texte);
  }

  .fenetre[open] {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .fenetre::backdrop {
    background: color-mix(in srgb, var(--texte) 55%, transparent);
  }

  .fenetre header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--bordure);
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .neutre {
    display: inline-flex;
    align-items: center;
    min-width: 44px;
    min-height: 44px;
    box-sizing: border-box;
    padding: 0 0.9rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }

  .grande {
    width: 100%;
    height: 100%;
    min-height: 0;
    border: none;
    object-fit: contain;
    background: var(--surface-2);
  }

  @media (max-width: 640px) {
    .fenetre {
      width: 100vw;
      height: 100dvh;
      max-width: 100vw;
      max-height: 100dvh;
      border-radius: 0;
    }
  }
</style>
