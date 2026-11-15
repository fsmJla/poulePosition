<script lang="ts">
  // Fenêtre d'aperçu d'un document (US-072) : une fenêtre modale qui montre l'affiche en image ou la feuille de route en PDF,
  // avec « Ouvrir dans un nouvel onglet » et « Fermer ». Le navigateur piège le focus (showModal) et le rend au bouton
  // d'origine à la fermeture. Partagée par la vignette (ApercuDocument) et le repère des lignes (US-073).
  import type { Snippet } from 'svelte';
  import type { SorteFichier } from '@poule-position/domaine';
  import { textes } from '../lib/textes';

  interface Proprietes {
    sorte: SorteFichier;
    adresse: string | undefined;
    /** Appelée à la fermeture (bouton, Échap, clic sur le fond). */
    surFermeture?: () => void;
    /** Contenu supplémentaire de l'entête (le choix « Affiche / Feuille de route » du repère). */
    choix?: Snippet;
  }

  let { sorte, adresse, surFermeture, choix }: Proprietes = $props();

  const t = textes.fichiers.apercu;
  const libelle = $derived(sorte === 'affiche' ? textes.fichiers.affiche : textes.fichiers.feuilleDeRoute);

  let fenetre: HTMLDialogElement | undefined = $state();
  let ouverte = $state(false);

  export function ouvrir() {
    ouverte = true;
    fenetre?.showModal();
  }

  function fermee() {
    ouverte = false;
    surFermeture?.();
  }
</script>

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
      {@render choix?.()}
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
  {:else if ouverte}
    <header>
      <strong>{libelle}</strong>
      {@render choix?.()}
      <button type="button" class="neutre" onclick={() => fenetre?.close()}>{t.fermer}</button>
    </header>
    <p class="indisponible">{t.horsLigne}</p>
  {/if}
</dialog>

<style>
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

  .indisponible {
    margin: 0;
    padding: 1rem;
    color: var(--texte-discret);
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
