<script lang="ts">
  // Fenêtre « Sauvegarde automatique » (US-131), ouverte depuis le menu de compte : le dossier choisi et l'heure de la
  // dernière sauvegarde ; « Choisir un dossier » est l'action principale, « Arrêter » la secondaire. Échap ou « Fermer »
  // la referment. Aucune planche : écart déclaré dans l'US.
  import { onMount } from 'svelte';
  import type { EtatSauvegarde, SauvegardeAuto } from '../lib/sauvegarde-auto';
  import { textes } from '../lib/textes';

  interface Proprietes {
    sauvegarde: SauvegardeAuto;
    fermer: () => void;
  }

  let { sauvegarde, fermer }: Proprietes = $props();
  const t = textes.sauvegardeAuto;
  let dialogue: HTMLDialogElement | undefined = $state();
  let etat = $state<EtatSauvegarde>({ etat: 'inactive' });
  let enCours = $state(false);

  onMount(() => {
    dialogue?.showModal();
    etat = sauvegarde.etat();
    return sauvegarde.surEtat((nouvel) => (etat = nouvel));
  });

  async function agir(action: () => Promise<unknown>) {
    if (enCours) return;
    enCours = true;
    try {
      await action();
    } finally {
      enCours = false;
    }
  }
</script>

<dialog
  bind:this={dialogue}
  aria-labelledby="titre-sauvegarde"
  oncancel={(evenement) => {
    evenement.preventDefault();
    fermer();
  }}
>
  <h2 id="titre-sauvegarde">{t.titre}</h2>
  <p>{t.explication}</p>

  <p class="etat" role="status">
    {#if etat.etat === 'active'}
      {t.active(etat.dossier)}
      {#if etat.derniere !== null}<br /><small>{t.derniere(etat.derniere)}</small>{/if}
    {:else if etat.etat === 'pause'}
      {t.pause(etat.dossier)}
    {:else if etat.etat === 'erreur'}
      {t.erreur}
    {:else}
      {t.inactive}
    {/if}
  </p>

  <div class="boutons">
    {#if etat.etat === 'pause'}
      <button type="button" onclick={() => agir(() => sauvegarde.reprendre())} disabled={enCours}>{t.reprendre}</button>
    {:else}
      <button type="button" onclick={() => agir(() => sauvegarde.choisir())} disabled={enCours}>{t.choisir}</button>
    {/if}
    {#if etat.etat !== 'inactive' && etat.etat !== 'indisponible'}
      <button type="button" class="secondaire" onclick={() => agir(() => sauvegarde.arreter())} disabled={enCours}
        >{t.arreter}</button
      >
    {/if}
    <button type="button" class="secondaire" onclick={fermer}>{t.fermer}</button>
  </div>
</dialog>

<style>
  dialog {
    width: min(32rem, calc(100% - 2rem));
    max-height: calc(100% - 2rem);
    padding: 1.25rem;
    overflow-y: auto;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--fond);
    box-shadow: var(--ombre-flottante);
    color: var(--texte);
  }

  dialog::backdrop {
    background: var(--voile);
  }

  dialog[open] {
    display: grid;
    gap: 0.75rem;
  }

  h2 {
    margin: 0;
    font-size: 1.15rem;
  }

  p {
    margin: 0;
  }

  .etat {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .etat small {
    color: var(--texte-discret);
    font-weight: 400;
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
  }

  button {
    padding: 0.5rem 0.9rem;
    border: none;
    border-radius: var(--rayon);
    background: var(--accent-fond);
    color: var(--sur-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button.secondaire {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
    font-weight: 400;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
