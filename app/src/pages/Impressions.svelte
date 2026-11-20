<script lang="ts">
  // Étape « Impressions » (US-120, planche 22) : tous les documents de l'épreuve, regroupés (Avant les poules, Poules,
  // Tableau), chacun avec ses choix et « Imprimer ». Un document dont les données manquent est grisé avec la raison ; un
  // document pas encore livré, « À venir ». Tout se lit dans le journal local : la page marche hors ligne.
  import { onMount } from 'svelte';
  import {
    poulesDe,
    raisonIndisponible,
    structureTableau,
    toursAImprimer,
    tableauDe,
    tireursDe,
    type Epreuve,
    type SourceImpression,
  } from '@poule-position/domaine';
  import GabaritEpreuve from '../composants/GabaritEpreuve.svelte';
  import type { Accueil } from '../lib/accueil';
  import { CATALOGUE_IMPRESSIONS, GROUPES_IMPRESSION, type LigneImpression } from '../lib/impressions';
  import type { Journal } from '../lib/journal';
  import { cheminImpressionAcces, cheminImprimer } from '../lib/routes';
  import type { SessionAppareil } from '../lib/stockage';
  import type { Synchronisation } from '../lib/synchronisation';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: SessionAppareil;
    epreuveId: string;
    journal: Journal;
    synchronisation: Synchronisation;
    accueil: Accueil;
    naviguer: (chemin: string) => void;
  }

  let { epreuveId, journal, synchronisation, accueil, naviguer }: Proprietes = $props();

  const t = textes.impressions;
  const te = textes.epreuves;

  let epreuve = $state<Epreuve | null>(null);
  let chargee = $state(false);
  /** Les choix de chaque ligne : poule (0 : toutes), tour, format. */
  let poule = $state<Record<string, number>>({});
  let tour = $state<number | null>(null);
  let format = $state<'a4' | 'a3'>('a4');

  onMount(() => {
    void (async () => {
      await synchronisation.telechargerCopie(epreuveId);
      epreuve = (await journal.lire(epreuveId)).epreuve;
      chargee = true;
    })();
  });

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
  const numerosPoules = $derived(source ? source.poules.poules.map(({ numero }) => numero) : []);
  const structure = $derived(source ? structureTableau(source.tableau, source.matchTroisieme) : null);
  /** Les tours du tableau qui ont un match à tirer (feuilles de match). */
  const tours = $derived(structure ? toursAImprimer(structure) : []);
  const tourChoisi = $derived(tour !== null && tours.includes(tour) ? tour : (tours[0] ?? null));

  const raison = (ligne: LigneImpression) =>
    !ligne.livre ? t.aVenir : source ? (raisonIndisponible(ligne.document, source) ?? null) : null;
  const libelleRaison = (ligne: LigneImpression) => {
    const r = raison(ligne);
    return r === null ? null : r === t.aVenir ? t.aVenir : t.raisons[r as keyof typeof t.raisons];
  };

  function imprimer(ligne: LigneImpression) {
    if (ligne.document === 'qrCodes') return naviguer(cheminImpressionAcces(epreuveId));
    const choixPoule = poule[ligne.document] ?? 0;
    naviguer(
      cheminImprimer(epreuveId, {
        document: ligne.document,
        ...(ligne.choix === 'poules' && choixPoule > 0 ? { poule: choixPoule } : {}),
        ...(ligne.choix === 'tours' && tourChoisi !== null ? { tour: tourChoisi } : {}),
        ...(ligne.choix === 'format' ? { format } : {}),
      }),
    );
  }
</script>

{#snippet pastille(libelle: string, presse: boolean, choisir: () => void)}
  <button type="button" class="pastille" aria-pressed={presse} onclick={choisir}>{libelle}</button>
{/snippet}

{#snippet etape()}
  {#if !chargee}
    <p role="status">{te.chargement}</p>
  {:else if !epreuve}
    <p class="message" role="alert">{te.introuvable}</p>
  {:else}
    <div class="titre-etape">
      <h2>{t.titre}</h2>
      <p class="discret">{t.explication}</p>
    </div>
    {#each GROUPES_IMPRESSION as groupe (groupe)}
      <section class="carte" aria-labelledby={`groupe-${groupe}`}>
        <h3 id={`groupe-${groupe}`}>{t.groupes[groupe]}</h3>
        <ul>
          {#each CATALOGUE_IMPRESSIONS.filter((l) => l.groupe === groupe) as ligne (ligne.document)}
            {@const r = libelleRaison(ligne)}
            <li class:indisponible={r !== null}>
              <div class="quoi">
                <p class="nom">{t.documents[ligne.document].nom}</p>
                <p class="detail">{r ?? t.documents[ligne.document].detail}</p>
              </div>
              <div class="choix">
                {#if r === null && ligne.choix === 'poules' && numerosPoules.length > 1}
                  <div role="group" aria-label={t.choixPoules} class="pastilles">
                    {@render pastille(t.toutes, (poule[ligne.document] ?? 0) === 0, () => (poule[ligne.document] = 0))}
                    {#each numerosPoules as n (n)}
                      {@render pastille(String(n), poule[ligne.document] === n, () => (poule[ligne.document] = n))}
                    {/each}
                  </div>
                {:else if r === null && ligne.choix === 'tours'}
                  <div role="group" aria-label={t.choixTour} class="pastilles">
                    {#each tours as taille (taille)}
                      {@render pastille(textes.tableau.nomDuTour(taille), tourChoisi === taille, () => (tour = taille))}
                    {/each}
                  </div>
                {:else if r === null && ligne.choix === 'format'}
                  <div role="group" aria-label={t.choixFormat} class="pastilles">
                    {@render pastille(t.formats.a4, format === 'a4', () => (format = 'a4'))}
                    {@render pastille(t.formats.a3, format === 'a3', () => (format = 'a3'))}
                  </div>
                {/if}
              </div>
              <button
                type="button"
                class="imprimer"
                disabled={r !== null}
                aria-label={`${t.imprimer} : ${t.documents[ligne.document].nom}`}
                onclick={() => imprimer(ligne)}>{t.imprimer}</button
              >
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
{/snippet}

{#if epreuve}
  <GabaritEpreuve {accueil} {epreuve} courante="impressions" suite={t.titre} {naviguer}>
    {@render etape()}
  </GabaritEpreuve>
{:else}
  <main class="seul">{@render etape()}</main>
{/if}

<style>
  .seul {
    padding: 2rem 1rem;
  }

  .titre-etape {
    display: grid;
    gap: 0.25rem;
  }

  h2 {
    margin: 0;
    font-family: var(--police-titre, inherit);
    font-size: 1.6rem;
  }

  .discret {
    margin: 0;
    color: var(--texte-discret);
  }

  .message {
    color: var(--etat-erreur);
  }

  .carte {
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
    overflow: hidden;
  }

  h3 {
    margin: 0;
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var(--bordure);
    color: var(--texte-discret);
    font-size: 0.95rem;
    font-weight: 600;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto 9rem;
    align-items: center;
    gap: 0.5rem 1rem;
    padding: 0.75rem 1rem;
  }

  li + li {
    border-top: 1px solid var(--surface-2);
  }

  .quoi p {
    margin: 0;
  }

  .nom {
    font-weight: 600;
  }

  .detail {
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .indisponible .nom {
    color: var(--texte-inactif);
  }

  .pastilles {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
  }

  .pastille {
    min-width: 44px;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--bordure-champ);
    border-radius: 999px;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
  }

  .pastille[aria-pressed='true'] {
    border-color: var(--marque);
    background: var(--marque);
    color: var(--sur-marque);
  }

  .imprimer {
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid var(--bordure-champ);
    border-radius: 10px;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .imprimer:disabled {
    border-style: dashed;
    color: var(--texte-inactif);
    cursor: not-allowed;
  }

  /* Écran étroit (principe 13) : le nom, puis les choix, puis « Imprimer ». */
  @media (max-width: 40rem) {
    li {
      grid-template-columns: minmax(0, 1fr);
    }

    .pastilles {
      justify-content: flex-start;
    }
  }
</style>
