<script lang="ts">
  // Page d'impression d'un document de l'épreuve (US-120, ADR-0009) : le document choisi dans l'étape « Impressions »,
  // construit à partir du journal local (hors ligne compris), mis en feuilles par le gabarit commun, puis la fenêtre
  // d'impression du navigateur s'ouvre. « Retour aux impressions » et « Imprimer » ne s'impriment pas. US-153 et
  // US-154 : par équipes, les documents montrent les équipes, et les feuilles de rencontre remplacent celles de match.
  import { onMount, tick } from 'svelte';
  import {
    DOCUMENTS_IMPRIMES,
    contexteTableau,
    equipesDe,
    lienQr,
    membresDe,
    participantsDe,
    qualifiesDirects,
    rangEquipes,
    rencontresDesPoules,
    rencontresDuTableau,
    tailleEquipe,
    structureTableau,
    toursAImprimer,
    poulesDe,
    raisonIndisponible,
    tableauDe,
    tireursDe,
    type DocumentImprime,
    type Epreuve,
    type SourceImpression,
  } from '@poule-position/domaine';
  import Icone from '../composants/Icone.svelte';
  import ImpressionPresence from '../composants/impressions/ImpressionPresence.svelte';
  import ImpressionPoulesVierges from '../composants/impressions/ImpressionPoulesVierges.svelte';
  import ImpressionPoulesResultats from '../composants/impressions/ImpressionPoulesResultats.svelte';
  import ImpressionPoulesPistes from '../composants/impressions/ImpressionPoulesPistes.svelte';
  import ImpressionClassementPoules from '../composants/impressions/ImpressionClassementPoules.svelte';
  import ImpressionFeuillesMatch from '../composants/impressions/ImpressionFeuillesMatch.svelte';
  import ImpressionTableau from '../composants/impressions/ImpressionTableau.svelte';
  import ImpressionClassementFinal from '../composants/impressions/ImpressionClassementFinal.svelte';
  import ImpressionFeuillesRencontre from '../composants/impressions/ImpressionFeuillesRencontre.svelte';
  import type { AccesQrClient } from '../lib/acces-qr';
  import type { Accueil } from '../lib/accueil';
  import { documentLivre } from '../lib/impressions';
  import type { Journal } from '../lib/journal';
  import { cheminImpressionsEpreuve, optionsImpression, type OptionsImpression } from '../lib/routes';
  import { textes } from '../lib/textes';

  interface Proprietes {
    epreuveId: string;
    journal: Journal;
    accueil: Accueil;
    /** US-122 : le jeton des arbitres gardé sur ce PC, pour le QR des feuilles de poule. */
    acces: AccesQrClient;
    naviguer: (chemin: string) => void;
    /** Lance l'impression du navigateur (remplaçable dans les tests). */
    imprimer?: () => void;
  }

  let { epreuveId, journal, accueil, acces, naviguer, imprimer = () => window.print() }: Proprietes = $props();

  const t = textes.impressions;
  const options: OptionsImpression | null = optionsImpression(location.search);
  const document = (
    options && (DOCUMENTS_IMPRIMES as readonly string[]).includes(options.document) ? options.document : null
  ) as DocumentImprime | null;

  let epreuve = $state<Epreuve | null>(null);
  let competition = $state<string | null>(null);
  let charge = $state(false);
  let jetonArbitres = $state<string | null>(null);
  const imprimeLe = new Date();

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
  /** Les tireurs, et par équipes les équipes (avec leur nom) : les poules et le tableau tirent des équipes. */
  const parId = $derived(
    new Map([...(source?.tireurs ?? []), ...(epreuve ? participantsDe(epreuve) : [])].map((x) => [x.id, x])),
  );
  const parEquipes = $derived(epreuve !== null && epreuve.typeEpreuve !== 'individuelle');
  const equipesParId = $derived(new Map((epreuve ? equipesDe(epreuve) : []).map((e) => [e.id, e])));
  /** US-154 CA-1 : les équipes rangées et leurs membres, pour la feuille de présence. */
  const equipesPresence = $derived(
    epreuve && parEquipes
      ? rangEquipes(equipesDe(epreuve), source?.tireurs ?? [], epreuve.ordreEquipes ?? null).map((e) => ({
          nom: e.nom,
          membres: membresDe(e),
        }))
      : undefined,
  );
  /** US-154 CA-3 : les tireurs de chaque équipe, au classement final. */
  const membres = $derived(
    parEquipes
      ? new Map(
          [...equipesParId.values()].map((e) => [
            e.id,
            membresDe(e)
              .map((id) => {
                const x = parId.get(id);
                return x ? `${x.nom.toUpperCase()} ${x.prenom}` : '';
              })
              .join(' · '),
          ]),
        )
      : undefined,
  );
  /** US-122, US-123 : la poule choisie, ou toutes. */
  const poulesChoisies = $derived(
    (source?.poules.poules ?? []).filter((p) => options?.poule === undefined || p.numero === options.poule),
  );
  /** US-126, US-127 : le tableau, et le tour choisi (par défaut, le premier qui a un match à tirer). */
  const structure = $derived(source ? structureTableau(source.tableau, source.matchTroisieme) : null);
  const tour = $derived(options?.tour ?? (structure ? (toursAImprimer(structure)[0] ?? 0) : 0));
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
      jetonArbitres = (await acces.lire(epreuveId).catch(() => null))?.arbitre ?? null;
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
      <div class="feuilles" data-document={document}>
        {#if document === 'presence'}
          <ImpressionPresence tireurs={source.tireurs} equipes={equipesPresence} {contexte} {imprimeLe} />
        {:else if document === 'poulesVierges' && epreuve}
          <ImpressionPoulesVierges
            poules={poulesChoisies}
            total={source.poules.poules.length}
            tireurs={parId}
            touches={epreuve.formule.touchesPoules}
            lienArbitres={jetonArbitres ? lienQr(location.origin, epreuveId, jetonArbitres) : null}
            {contexte}
            {imprimeLe}
          />
        {:else if document === 'poulesResultats' && epreuve}
          <ImpressionPoulesResultats
            etat={source.poules}
            poules={poulesChoisies}
            tireurs={parId}
            touches={epreuve.formule.touchesPoules}
            {contexte}
            {imprimeLe}
          />
        {:else if document === 'poulesPistes'}
          <ImpressionPoulesPistes poules={source.poules.poules} tireurs={parId} {contexte} {imprimeLe} />
        {:else if document === 'classementPoules' && epreuve}
          <ImpressionClassementPoules
            etat={source.poules}
            fige={source.tableau.qualifies !== null}
            tireurs={parId}
            touches={epreuve.formule.touchesPoules}
            {contexte}
            {imprimeLe}
          />
        {:else if document === 'feuillesMatch' && structure}
          <ImpressionFeuillesMatch {structure} {tour} tireurs={parId} {contexte} {imprimeLe} />
        {:else if document === 'tableau' && structure}
          <ImpressionTableau {structure} format={options?.format ?? 'a4'} tireurs={parId} {contexte} {imprimeLe} />
        {:else if document === 'classementFinal' && structure && epreuve}
          <ImpressionClassementFinal
            poules={source.poules}
            tableau={source.tableau}
            {structure}
            touchesPoules={epreuve.formule.touchesPoules}
            matchTroisieme={source.matchTroisieme}
            tireurs={parId}
            direct={qualifiesDirects(epreuve)}
            {membres}
            {contexte}
            {imprimeLe}
          />
        {:else if document === 'rencontresPoules' && epreuve}
          <!-- US-153 : les feuilles de rencontre des poules choisies, aux touches des rencontres de poule. -->
          <ImpressionFeuillesRencontre
            rencontres={rencontresDesPoules(
              source.poules,
              options?.poule === undefined ? [] : [options.poule],
              epreuve.formule.touchesPoules,
            )}
            equipes={equipesParId}
            tireurs={parId}
            taille={tailleEquipe(epreuve.typeEpreuve) === 2 ? 2 : 3}
            touches={epreuve.formule.touchesPoules}
            {contexte}
            {imprimeLe}
          />
        {:else if document === 'rencontresTableau' && structure && epreuve}
          <!-- US-153 : les feuilles de rencontre d'un tour du tableau, au relais complet. -->
          <ImpressionFeuillesRencontre
            rencontres={rencontresDuTableau(structure, tour)}
            equipes={equipesParId}
            tireurs={parId}
            taille={tailleEquipe(epreuve.typeEpreuve) === 2 ? 2 : 3}
            touches={contexteTableau(epreuve).touchesTableau}
            {contexte}
            {imprimeLe}
          />
        {/if}
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
      background: var(--papier-fond) !important;
    }
  }
</style>
