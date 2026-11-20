<script lang="ts">
  // Retrait d'un tireur d'un match du tableau (US-113, planche 11 : « Abandon, forfait, exclusion… ») : fenêtre modale
  // qui demande le tireur et le motif, et annonce l'effet (« MICHEL Julia passe en quart de finale »). Échap ou
  // « Annuler » la ferme ; un refus du journal s'affiche dans la fenêtre, qui reste ouverte.
  import { MOTIFS_RETRAIT, type MotifRetrait } from '@poule-position/domaine';
  import { onMount } from 'svelte';
  import { textes } from '../lib/textes';

  interface Proprietes {
    /** Titre du match (« Tableau de 16 · match 5 »). */
    match: string;
    /** Les deux tireurs, dans l'ordre d'affichage : identifiant et nom. */
    tireurs: readonly [{ id: string; nom: string }, { id: string; nom: string }];
    /** Où passe l'adversaire (« en quart de finale », « en finale », « vainqueur de l'épreuve »). */
    suite: string;
    valider: (tireurId: string, motif: MotifRetrait) => Promise<string | null>;
    fermer: () => void;
  }

  let { match, tireurs, suite, valider, fermer }: Proprietes = $props();

  const t = textes.tableau;
  let dialogue: HTMLDialogElement | undefined = $state();
  let tireurId = $state<string | null>(null);
  let motif = $state<MotifRetrait>('abandon');
  let enCours = $state(false);
  let refus = $state<string | null>(null);

  onMount(() => dialogue?.showModal());

  const adversaire = $derived(tireurs.find(({ id }) => id !== tireurId && tireurId !== null) ?? null);

  async function confirmer() {
    if (enCours || !tireurId) return;
    enCours = true;
    refus = await valider(tireurId, motif);
    enCours = false;
    if (refus === null) fermer();
  }
</script>

<dialog
  bind:this={dialogue}
  aria-labelledby="titre-retrait-tableau"
  oncancel={(evenement) => {
    evenement.preventDefault();
    if (!enCours) fermer();
  }}
>
  <h2 id="titre-retrait-tableau">{t.retraitTitre(match)}</h2>
  <fieldset>
    <legend>{t.retraitQui}</legend>
    {#each tireurs as tireur (tireur.id)}
      <label><input type="radio" name="retrait-tireur" value={tireur.id} bind:group={tireurId} />{tireur.nom}</label>
    {/each}
  </fieldset>
  <fieldset>
    <legend>{t.retraitMotif}</legend>
    {#each MOTIFS_RETRAIT as valeur (valeur)}
      <label><input type="radio" name="retrait-motif" value={valeur} bind:group={motif} />{t.motifCourt(valeur)}</label>
    {/each}
  </fieldset>
  {#if adversaire}<p class="effet" role="status">{t.retraitEffet(adversaire.nom, suite)}</p>{/if}
  {#if refus}<p class="erreur" role="alert">{refus}</p>{/if}
  <div class="boutons">
    <button type="button" class="destructif" onclick={confirmer} disabled={enCours || !tireurId}
      >{enCours ? textes.archivage.enCours : t.retirer}</button
    >
    <button type="button" class="secondaire" onclick={fermer} disabled={enCours}>{textes.archivage.annuler}</button>
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

  fieldset {
    display: flex;
    flex-wrap: wrap;
    gap: 0 1rem;
    margin: 0;
    padding: 0.25rem 0.75rem 0.5rem;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
  }

  label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 44px;
  }

  p {
    margin: 0;
  }

  .erreur {
    color: var(--etat-erreur);
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
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .destructif {
    background: var(--etat-erreur);
    color: var(--sur-marque);
  }

  .secondaire {
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
