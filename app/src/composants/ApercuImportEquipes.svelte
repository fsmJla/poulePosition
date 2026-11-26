<script lang="ts">
  // Aperçu avant import du fichier d'équipes (US-156 CA-2) : équipes à créer, tireurs à inscrire ou déjà inscrits,
  // tireurs rapprochés par le nom, équipes écartées avec leur motif. Fenêtre modale sur le modèle de l'aperçu de
  // l'import des tireurs (US-083) : Échap ou « Annuler » la ferme, sauf pendant l'écriture.
  import { onMount } from 'svelte';
  import type { AnalyseImportEquipes } from '@poule-position/domaine';
  import { textes } from '../lib/textes';

  interface Proprietes {
    analyse: AnalyseImportEquipes;
    importer: () => Promise<void>;
    fermer: () => void;
  }

  let { analyse, importer, fermer }: Proprietes = $props();

  const t = textes.importEquipes;
  let dialogue: HTMLDialogElement | undefined = $state();
  let enCours = $state(false);
  const nombre = $derived(analyse.importables.length);

  onMount(() => dialogue?.showModal());

  async function valider() {
    if (enCours || nombre === 0) return;
    enCours = true;
    try {
      await importer();
    } finally {
      enCours = false;
    }
  }

  function annuler() {
    if (!enCours) fermer();
  }
</script>

<dialog
  bind:this={dialogue}
  aria-labelledby="titre-import-equipes"
  oncancel={(evenement) => {
    evenement.preventDefault();
    annuler();
  }}
>
  <h2 id="titre-import-equipes">{t.titre}</h2>
  <p>{t.resume(analyse.total)}</p>
  <ul class="bilan">
    <li>{t.importables(nombre)}</li>
    <li>{t.tireurs(analyse.aInscrire, analyse.dejaInscrits)}</li>
  </ul>

  {#if analyse.rapproches.length > 0}
    <details>
      <summary>{t.rapproches(analyse.rapproches.length)}</summary>
      <ul>
        {#each analyse.rapproches as { importe, inscrit }, rang (rang)}<li>{t.rapproche(importe, inscrit)}</li>{/each}
      </ul>
    </details>
  {/if}

  {#if analyse.ecartees.length > 0}
    <details>
      <summary>{t.ecartees(analyse.ecartees.length)}</summary>
      <ul>
        {#each analyse.ecartees as { nom, motif, tireur, equipe }, rang (rang)}
          <li>{nom} : {t.motif(motif, tireur, equipe)}</li>
        {/each}
      </ul>
    </details>
  {/if}

  <div class="boutons">
    <button type="button" class="principal" disabled={enCours || nombre === 0} onclick={valider}
      >{t.importer(nombre)}</button
    >
    <button type="button" class="secondaire" disabled={enCours} onclick={annuler}>{t.annuler}</button>
  </div>
</dialog>

<style>
  dialog {
    display: grid;
    gap: 0.75rem;
    width: min(100% - 2rem, 36rem);
    max-height: calc(100dvh - 2rem);
    overflow: auto;
    padding: 1.25rem;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
    color: var(--texte);
  }

  dialog:not([open]) {
    display: none;
  }

  dialog::backdrop {
    background: var(--voile);
  }

  h2,
  p {
    margin: 0;
  }

  h2 {
    font-size: 1.2rem;
  }

  .bilan,
  details ul {
    margin: 0;
    padding-left: 1.25rem;
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  button {
    min-height: 2.75rem;
    padding: 0 1rem;
    border-radius: var(--rayon);
    font: inherit;
    cursor: pointer;
  }

  .principal {
    border: none;
    background: var(--palette-tiffany);
    color: var(--sur-tiffany);
    font-weight: 600;
  }

  .secondaire {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
</style>
