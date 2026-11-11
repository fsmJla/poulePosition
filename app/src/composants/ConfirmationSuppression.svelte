<script lang="ts">
  // Confirmation du « Supprimer… » unique d'une manifestation ou d'une compétition (US-057), en fenêtre modale : Échap
  // ou « Annuler » la ferme (sauf pendant la suppression). Un objet vide se confirme d'un clic (CA-2) ; un objet non vide
  // annonce son contenu et ses épreuves, et exige son nom (CA-3, comme US-041 CA-4 et US-042 CA-4).
  import { onMount } from 'svelte';
  import type { ContenuASupprimer } from '@poule-position/domaine';
  import type { ResultatSuppressionUnique } from '../lib/suppression-unique';
  import { nomConfirme } from '../lib/suppression';
  import { textes } from '../lib/textes';

  interface Proprietes {
    contenu: ContenuASupprimer & { type: 'manifestation' | 'competition' };
    /** Lance la suppression ; la progression se rapporte morceau par morceau. */
    supprimer: (surProgression: (faites: number, total: number) => void) => Promise<ResultatSuppressionUnique>;
    /** Appelé quand la fenêtre se ferme, suppression faite ou non (la liste se relit alors). */
    fermer: (supprime: boolean) => void;
  }

  let { contenu, supprimer, fermer }: Proprietes = $props();

  const t = textes.suppressionUnique;
  let dialogue: HTMLDialogElement | undefined = $state();
  let saisie = $state('');
  let enCours = $state(false);
  let message: string | null = $state(null);
  let progression: { faites: number; total: number } | null = $state(null);
  const autorise = $derived(contenu.vide || nomConfirme(saisie, contenu.nom));

  onMount(() => dialogue?.showModal());

  async function valider() {
    if (enCours || !autorise) return;
    enCours = true;
    message = null;
    const resultat = await supprimer((faites, total) => (progression = { faites, total }));
    enCours = false;
    progression = null;
    if (resultat.ok) fermer(true);
    else message = resultat.message;
  }

  function annuler() {
    if (!enCours) fermer(false);
  }
</script>

<dialog
  bind:this={dialogue}
  aria-labelledby="titre-suppression"
  oncancel={(evenement) => {
    evenement.preventDefault();
    annuler();
  }}
>
  <h2 id="titre-suppression">
    {contenu.vide ? t.titreVide(contenu.nom) : t.titre(contenu.type, contenu.nom)}
  </h2>

  {#if !contenu.vide}
    <p>{t.annonce(contenu.competitions, contenu.epreuves)}</p>
    {#if contenu.nomsEpreuves.length > 0}
      <ul class="noms">
        {#each contenu.nomsEpreuves as nom, rang (rang)}<li>{nom}</li>{/each}
      </ul>
    {/if}
    <p class="avertissement" role="status">{t.avertissement}</p>
  {/if}

  {#if message}<p class="erreur" role="alert">{message}</p>{/if}

  {#if progression}
    <p role="status">{t.progression(progression.faites, progression.total)}</p>
  {:else}
    {#if !contenu.vide}
      <label>
        {t.saisie(contenu.nom)}
        <input type="text" bind:value={saisie} autocomplete="off" />
      </label>
    {/if}
    <div class="boutons">
      <button type="button" class="danger" onclick={valider} disabled={enCours || !autorise}>
        {contenu.vide ? t.supprimer : t.supprimerDefinitivement}
      </button>
      <button type="button" class="secondaire" onclick={annuler} disabled={enCours}>{t.annuler}</button>
    </div>
  {/if}
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
    background: rgb(0 0 0 / 0.45);
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

  .noms {
    display: grid;
    gap: 0.25rem;
    max-height: 10rem;
    margin: 0;
    padding: 0 0 0 1.25rem;
    overflow-y: auto;
  }

  .avertissement {
    padding: 0.6rem 0.75rem;
    border-left: 4px solid var(--etat-attente);
    background: var(--surface);
  }

  .erreur {
    color: var(--etat-erreur);
  }

  label {
    display: grid;
    gap: 0.25rem;
  }

  input[type='text'] {
    padding: 0.55rem 0.65rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte);
    font: inherit;
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

  button.danger {
    background: var(--etat-erreur);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
