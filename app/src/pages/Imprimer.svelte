<script lang="ts">
  // Page d'impression d'un document de l'épreuve (US-120, ADR-0009) : le document choisi dans l'étape « Impressions »,
  // construit à partir du journal local (hors ligne compris), mis en feuilles par le gabarit commun, puis la fenêtre
  // d'impression du navigateur s'ouvre. « Retour aux impressions » et « Imprimer » ne s'impriment pas.
  import { onMount, tick } from 'svelte';
  import {
    DOCUMENTS_IMPRIMES,
    poulesDe,
    raisonIndisponible,
    tableauDe,
    tireursDe,
    type DocumentImprime,
    type Epreuve,
    type SourceImpression,
  } from '@poule-position/domaine';
  import Icone from '../composants/Icone.svelte';
  import type { Accueil } from '../lib/accueil';
  import { documentLivre } from '../lib/impressions';
  import type { Journal } from '../lib/journal';
  import { cheminImpressionsEpreuve, optionsImpression, type OptionsImpression } from '../lib/routes';
  import { textes } from '../lib/textes';

  interface Proprietes {
    epreuveId: string;
    journal: Journal;
    accueil: Accueil;
    naviguer: (chemin: string) => void;
    /** Lance l'impression du navigateur (remplaçable dans les tests). */
    imprimer?: () => void;
  }

  let { epreuveId, journal, accueil, naviguer, imprimer = () => window.print() }: Proprietes = $props();

  const t = textes.impressions;
  const options: OptionsImpression | null = optionsImpression(location.search);
  const document = (
    options && (DOCUMENTS_IMPRIMES as readonly string[]).includes(options.document) ? options.document : null
  ) as DocumentImprime | null;

  let epreuve = $state<Epreuve | null>(null);
  let competition = $state<string | null>(null);
  let charge = $state(false);

  const source = $derived<SourceImpression | null>(
    epreuve
      ? {
          tireurs: tireursDe(epreuve),
          poules: poulesDe(epreuve),
          tableau: tableauDe(epreuve),
          matchTroisieme: epreuve.formule.matchTroisieme,
        }
      : null,
  );
  const raison = $derived(document && source ? raisonIndisponible(document, source) : null);
  const pret = $derived(document !== null && documentLivre(document) && source !== null && raison === null);
  /** En-tête des feuilles : épreuve, arme, compétition, date. */
  const contexte = $derived(
    epreuve
      ? [
          epreuve.nom,
          textes.epreuves.armes[epreuve.arme],
          competition,
          epreuve.date ? textes.epreuves.dateLongue(epreuve.date) : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : '',
  );

  onMount(() => {
    void (async () => {
      epreuve = (await journal.lire(epreuveId)).epreuve;
      const hierarchie = await accueil.hierarchie().catch(() => null);
      competition = hierarchie?.competitions.find(({ id }) => id === epreuve?.rattachement?.competitionId)?.nom ?? null;
      charge = true;
      await tick();
      if (pret) imprimer();
    })();
  });
</script>

<main class="impression">
  <div class="actions pas-imprime">
    <button type="button" class="neutre" onclick={() => naviguer(cheminImpressionsEpreuve(epreuveId))}
      >{t.retour}</button
    >
    {#if pret}
      <button type="button" class="principal" onclick={imprimer}><Icone nom="imprimante" />{t.imprimerPage}</button>
    {/if}
  </div>

  {#if charge}
    {#if !epreuve || !document || !documentLivre(document)}
      <p role="alert">{t.introuvable}</p>
    {:else if raison}
      <p role="status">{t.indisponible(t.raisons[raison])}</p>
    {:else if source}
      <div class="feuilles" data-document={document} data-contexte={contexte}>
        <!-- Les documents de l'Epic 7 (US-121 à US-128) se branchent ici. -->
      </div>
    {/if}
  {/if}
</main>

<style>
  .impression {
    display: grid;
    justify-items: center;
    gap: 1.5rem;
    padding: 1.5rem 1rem 3rem;
    background: var(--surface-2);
  }

  .feuilles {
    display: grid;
    justify-items: center;
    gap: 1.5rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
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

  .neutre {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
  }

  /* À l'impression, seules les feuilles restent : ni l'entête de l'application, ni les boutons. */
  @media print {
    .pas-imprime,
    :global(.pages-connectees > header) {
      display: none !important;
    }

    .impression,
    .feuilles {
      display: block;
      padding: 0;
      background: none;
    }

    :global(html),
    :global(body) {
      background: #ffffff !important;
    }
  }
</style>
