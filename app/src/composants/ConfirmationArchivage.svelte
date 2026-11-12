<script lang="ts">
  // Confirmation de l'archivage ou du désarchivage d'une épreuve ou d'une manifestation (US-033), en fenêtre modale : Échap
  // ou « Annuler » la ferme (sauf pendant l'écriture). L'action réversible ne demande pas de saisie, seulement un clic.
  import { onMount } from 'svelte';
  import { textes } from '../lib/textes';

  import type { VerdictArchivage } from '../lib/archivage';

  interface Proprietes {
    titre: string;
    detail: string;
    /** Libellé du bouton de confirmation (« Archiver » ou « Désarchiver »). */
    action: string;
    /** Lance l'opération ; en cas de refus, le message s'affiche dans la fenêtre, qui reste ouverte. */
    valider: () => Promise<VerdictArchivage>;
    /** Appelé quand la fenêtre se ferme, opération faite ou non (la liste se relit alors). */
    fermer: (fait: boolean, remarque?: string) => void;
  }

  let { titre, detail, action, valider, fermer }: Proprietes = $props();

  const t = textes.archivage;
  let dialogue: HTMLDialogElement | undefined = $state();
  let enCours = $state(false);
  let refus: { message: string; noms: string[] } | null = $state(null);

  onMount(() => dialogue?.showModal());

  async function confirmer() {
    if (enCours) return;
    enCours = true;
    refus = null;
    const resultat = await valider();
    enCours = false;
    if (resultat.ok) fermer(true, resultat.remarque);
    else refus = { message: resultat.message, noms: resultat.noms ?? [] };
  }

  function annuler() {
    if (!enCours) fermer(false);
  }
</script>

<dialog
  bind:this={dialogue}
  aria-labelledby="titre-archivage"
  oncancel={(evenement) => {
    evenement.preventDefault();
    annuler();
  }}
>
  <h2 id="titre-archivage">{titre}</h2>
  <p>{detail}</p>

  {#if refus}
    <div class="erreur" role="alert">
      <p>{refus.message}</p>
      {#if refus.noms.length > 0}
        <ul class="noms">
          {#each refus.noms as nom, rang (rang)}<li>{nom}</li>{/each}
        </ul>
      {/if}
    </div>
  {/if}

  <div class="boutons">
    <button type="button" onclick={confirmer} disabled={enCours}>{enCours ? t.enCours : action}</button>
    <button type="button" class="secondaire" onclick={annuler} disabled={enCours}>{t.annuler}</button>
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
    overflow-wrap: anywhere;
  }

  p {
    margin: 0;
  }

  .erreur {
    display: grid;
    gap: 0.4rem;
    color: var(--etat-erreur);
  }

  .noms {
    display: grid;
    gap: 0.25rem;
    max-height: 10rem;
    margin: 0;
    padding: 0 0 0 1.25rem;
    overflow-y: auto;
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
