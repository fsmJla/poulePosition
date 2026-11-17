<script lang="ts">
  // Aperçu avant import du fichier de la Fédération (US-083 CA-2) : nouveaux, déjà inscrits (même licence), homonymes à
  // cocher, écartés avec leur motif, avertissement si le fichier concerne une autre épreuve. Fenêtre modale sur le modèle
  // de la confirmation d'import d'une épreuve (US-035) : Échap ou « Annuler » la ferme, sauf pendant l'écriture.
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import type { AnalyseImport } from '@poule-position/domaine';
  import { textes } from '../lib/textes';

  interface Proprietes {
    analyse: AnalyseImport;
    /** Avertissement si le fichier concerne une autre épreuve (arme, catégorie) ; null sinon. */
    avertissement: string | null;
    /** Lance l'import avec les homonymes cochés (rangs dans `analyse.homonymes`). */
    importer: (homonymesCoches: ReadonlySet<number>) => Promise<void>;
    fermer: () => void;
  }

  let { analyse, avertissement, importer, fermer }: Proprietes = $props();

  const t = textes.importFfe;
  let dialogue: HTMLDialogElement | undefined = $state();
  let enCours = $state(false);
  const coches = new SvelteSet<number>();

  const aMettreAJour = $derived(analyse.dejaInscrits.filter(({ changes }) => Object.keys(changes).length > 0).length);
  const nombre = $derived(analyse.nouveaux.length + coches.size + aMettreAJour);

  onMount(() => dialogue?.showModal());

  async function valider() {
    if (enCours || nombre === 0) return;
    enCours = true;
    try {
      await importer(coches);
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
  aria-labelledby="titre-import-ffe"
  oncancel={(evenement) => {
    evenement.preventDefault();
    annuler();
  }}
>
  <h2 id="titre-import-ffe">{t.titre}</h2>
  <p>{t.resume(analyse.total)}</p>
  {#if avertissement}<p class="avertissement" role="status">{avertissement}</p>{/if}
  <ul class="bilan">
    <li>{t.nouveaux(analyse.nouveaux.length)}</li>
    {#if analyse.dejaInscrits.length > 0}<li>{t.deja(analyse.dejaInscrits.length, aMettreAJour)}</li>{/if}
  </ul>

  {#if analyse.homonymes.length > 0}
    <fieldset>
      <legend>{t.homonymes(analyse.homonymes.length)}</legend>
      {#each analyse.homonymes as { inscrit, importe }, rang (rang)}
        <label class="case">
          <input
            type="checkbox"
            checked={coches.has(rang)}
            onchange={(e) => (e.currentTarget.checked ? coches.add(rang) : coches.delete(rang))}
          />
          {t.homonyme(
            `${importe.nom.toUpperCase()} ${importe.prenom}${importe.club ? ` (${importe.club})` : ''}`,
            `${inscrit.nom.toUpperCase()} ${inscrit.prenom}${inscrit.club ? ` (${inscrit.club})` : ''}`,
          )}
        </label>
      {/each}
    </fieldset>
  {/if}

  {#if analyse.ecartes.length > 0}
    <details>
      <summary>{t.ecartes(analyse.ecartes.length)}</summary>
      <ul>
        {#each analyse.ecartes as { nom, motif }, rang (rang)}<li>{nom} : {t.motifs[motif]}</li>{/each}
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

  fieldset {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
  }

  legend {
    font-weight: 600;
  }

  .case {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.75rem;
  }

  .avertissement {
    padding: 0.5rem 0.75rem;
    border-left: 4px solid var(--etat-attente);
    background: var(--etat-attente-fond);
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
