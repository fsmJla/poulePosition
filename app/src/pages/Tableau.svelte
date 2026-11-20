<script lang="ts">
  // Étape « Tableau » d'une épreuve (US-109, planche 11) : tant que les poules se tirent, un avis ; une fois terminées,
  // l'aperçu du premier tour et l'action principale « Créer le tableau » ; ensuite, le tableau. Écrit les événements
  // d'US-108 dans le journal local du PC pilote, hors ligne compris ; relu toutes les 2 s, et la copie du pilote est
  // retéléchargée toutes les 30 s sur un autre appareil (comme le classement, US-092).
  import { onMount } from 'svelte';
  import {
    avancementTour,
    avancementPoules,
    classementDesPoules,
    poulesDe,
    poulesTerminees,
    qualifiesDesPoules,
    structureTableau,
    tableauDe,
    tireursDe,
    tirerAuSort,
    tousLesMatchs,
    type DonneesScoreTableau,
    type Epreuve,
    type MatchTableau,
    type PlaceTableau,
  } from '@poule-position/domaine';
  import ArbreTableau from '../composants/ArbreTableau.svelte';
  import CarteSaisieTableau from '../composants/CarteSaisieTableau.svelte';
  import ConfirmationArchivage from '../composants/ConfirmationArchivage.svelte';
  import GabaritEpreuve from '../composants/GabaritEpreuve.svelte';
  import Icone from '../composants/Icone.svelte';
  import MenuActions from '../composants/MenuActions.svelte';
  import type { Accueil } from '../lib/accueil';
  import type { VerdictArchivage } from '../lib/archivage';
  import { prendreEcriture, type Journal } from '../lib/journal';
  import { cheminPoulesEpreuve } from '../lib/routes';
  import type { SessionAppareil } from '../lib/stockage';
  import type { Synchronisation } from '../lib/synchronisation';
  import { creerTableau, saisirScoreTableau } from '../lib/tableau';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: SessionAppareil;
    epreuveId: string;
    journal: Journal;
    synchronisation: Synchronisation;
    accueil: Accueil;
    naviguer: (chemin: string) => void;
    /** Intervalles de relecture (journal local, copie du pilote), en millisecondes. */
    relecture?: number;
    copie?: number;
  }

  let {
    session,
    epreuveId,
    journal,
    synchronisation,
    accueil,
    naviguer,
    relecture = 2000,
    copie = 30_000,
  }: Proprietes = $props();

  const t = textes.tableau;
  const te = textes.epreuves;
  const contexte = $derived({ clubId: session.compte.clubId, auteur: session.compte.email });

  let epreuve = $state<Epreuve | null>(null);
  let chargee = $state(false);
  let pilote = $state(false);
  let ecriture = $state(true);
  let confirmer = $state(false);
  let annonce = $state('');
  let erreur = $state<string | null>(null);
  /** US-110 CA-1 : le tour choisi par l'organisateur ; sinon, le premier tour pas terminé. */
  let tourManuel = $state<number | null>(null);
  /** US-110 CA-4 : le match choisi dans l'arbre. */
  let choisi = $state<string | null>(null);

  const modifiable = $derived(pilote && ecriture && epreuve !== null && epreuve.statut !== 'archivee');
  const poules = $derived(epreuve ? poulesDe(epreuve) : null);
  const touchesPoules = $derived(epreuve?.formule.touchesPoules ?? 5);
  const troisieme = $derived(epreuve?.formule.matchTroisieme ?? false);
  const tireurs = $derived(epreuve ? new Map(tireursDe(epreuve).map((tireur) => [tireur.id, tireur])) : new Map());
  const avancement = $derived(poules ? avancementPoules(poules, touchesPoules) : { regles: 0, total: 0 });
  const terminees = $derived(poules ? poulesTerminees(poules, touchesPoules) : false);
  const qualifies = $derived(poules && terminees ? qualifiesDesPoules(poules, touchesPoules) : []);
  const nonQualifies = $derived(
    poules && terminees ? classementDesPoules(poules, touchesPoules).filter(({ retrait }) => retrait !== null) : [],
  );
  const etatTableau = $derived(epreuve ? tableauDe(epreuve) : null);
  /** Le tableau créé, ou l'aperçu du tableau qui serait créé (ex aequo dans l'ordre du classement). */
  const structure = $derived.by(() => {
    if (!etatTableau) return null;
    if (etatTableau.qualifies) return structureTableau(etatTableau, troisieme);
    if (qualifies.length < 2) return null;
    return structureTableau({ qualifies: qualifies.map(({ tireurId }) => tireurId), resultats: [], appels: [] }, false);
  });
  const cree = $derived(etatTableau?.qualifies !== null && etatTableau?.qualifies !== undefined);
  /** CA-4 : les ex aequo, par rang. */
  const exaequo = $derived(
    [...new Set(qualifies.filter((q) => q.exaequo).map((q) => q.rang))].map(
      (rang) => [rang, qualifies.filter((q) => q.rang === rang).map((q) => q.tireurId)] as const,
    ),
  );

  async function recharger() {
    epreuve = (await journal.lire(epreuveId)).epreuve;
  }

  onMount(() => {
    let liberer: (() => void) | null = null;
    let demonte = false;
    const relire = setInterval(() => void recharger(), relecture);
    const retelecharger = setInterval(() => {
      if (!pilote && document.visibilityState === 'visible') {
        void synchronisation.telechargerCopie(epreuveId).then(() => recharger());
      }
    }, copie);
    const arreterPerte = synchronisation.surPerte(({ epreuveId: id }) => {
      if (id !== epreuveId) return;
      pilote = false;
      liberer?.();
      void recharger();
    });
    void (async () => {
      await synchronisation.telechargerCopie(epreuveId);
      pilote = (await journal.etat(epreuveId))?.pilote ?? false;
      if (pilote) {
        liberer = await prendreEcriture(epreuveId);
        if (demonte) liberer?.();
        ecriture = liberer !== null;
      }
      await recharger();
      chargee = true;
      // CA-1 : avant le lancement des poules, l'étape renvoie vers « Poules ».
      if (epreuve && !poulesDe(epreuve).lancees) naviguer(cheminPoulesEpreuve(epreuveId));
    })();
    return () => {
      demonte = true;
      liberer?.();
      clearInterval(relire);
      clearInterval(retelecharger);
      arreterPerte();
    };
  });

  /** CA-5 : tire au sort les ex aequo et écrit `TableauCree`. */
  async function creer(): Promise<VerdictArchivage> {
    const ordre = tirerAuSort(qualifies, Math.random);
    const resultat = await creerTableau(journal, epreuveId, ordre, contexte);
    await recharger();
    if (!resultat.ok) return { ok: false, message: t.erreurs[resultat.erreur] ?? t.erreurs.AUTRE! };
    annonce = t.creeAnnonce;
    void synchronisation.envoyer(epreuveId).then(() => recharger());
    return { ok: true };
  }

  const nom = (id: string | null) => {
    const tireur = id ? tireurs.get(id) : undefined;
    return tireur ? `${tireur.nom.toUpperCase()} ${tireur.prenom}` : '';
  };
  const premierTour = $derived<MatchTableau[]>(structure?.tours[0]?.matchs ?? []);
  const tourEnCours = $derived.by(() => {
    const tours = structure?.tours ?? [];
    const indice = tours.findIndex((tour) => {
      const { regles, total } = avancementTour(tour);
      return regles < total;
    });
    return indice === -1 ? Math.max(0, tours.length - 1) : indice;
  });
  const tourChoisi = $derived(tourManuel ?? tourEnCours);
  /**
   * US-111 CA-1 : le match de la carte de saisie : celui choisi dans l'arbre, sinon le premier match en piste du tour en
   * cours, sinon son premier match à tirer.
   */
  const matchCarte = $derived.by(() => {
    if (!structure || !cree) return null;
    const tous = tousLesMatchs(structure);
    const choix = choisi ? tous.find((m) => m.id === choisi) : undefined;
    if (choix && choix.etat !== 'exempt') return choix;
    const tour = structure.tours[tourEnCours]?.matchs ?? [];
    const aTirer = [...tour, ...(structure.troisieme ? [structure.troisieme] : [])].filter((m) => m.etat === 'aTirer');
    return aTirer.find((m) => m.enPiste) ?? aTirer[0] ?? null;
  });

  /** US-111 CA-2 et CA-6 : écrit le score ; la carte passe au match suivant à saisir. */
  async function saisirScore(donnees: DonneesScoreTableau): Promise<boolean> {
    const resultat = await saisirScoreTableau(journal, epreuveId, donnees, contexte);
    await recharger();
    if (!resultat.ok) {
      erreur = t.erreurs[resultat.erreur] ?? t.erreurs.AUTRE!;
      return false;
    }
    erreur = null;
    const court = (id: string) => tireurs.get(id)?.nom.toUpperCase() ?? '';
    annonce = t.scoreEnregistre(court(donnees.tireurA), donnees.touchesA, donnees.touchesB, court(donnees.tireurB));
    choisi = null;
    void synchronisation.envoyer(epreuveId).then(() => recharger());
    return true;
  }
  const etatDuTableau = $derived(
    !cree ? t.etats.aCreer : epreuve?.statut === 'terminee' ? t.etats.termine : t.etats.enCours,
  );
</script>

{#snippet place(p: PlaceTableau)}
  <span class="place"
    ><span class="rang">({p.rang})</span> <strong>{tireurs.get(p.tireurId!)?.nom.toUpperCase()}</strong>
    {tireurs.get(p.tireurId!)?.prenom}</span
  >
{/snippet}

{#snippet etape()}
  {#if !chargee}
    <p role="status">{te.chargement}</p>
  {:else if !epreuve || !poules}
    <p class="message" role="alert">{te.introuvable}</p>
  {:else}
    <div class="titre-etape">
      <div class="identite">
        <div class="ligne">
          <h2>{t.titre}</h2>
          {#if terminees}<span class="pastille" class:enCours={cree}>{etatDuTableau}</span>{/if}
        </div>
        {#if structure}
          <p class="discret">
            {t.sousTitre(structure.taille, (etatTableau?.qualifies ?? qualifies).length, troisieme)}
          </p>
        {/if}
      </div>
      <MenuActions
        id="menu-tableau"
        nom={t.menu}
        actions={[{ libelle: t.imprimer, icone: 'imprimante', indisponible: t.imprimerAVenir }]}
      />
    </div>
    <p class="annonce" role="status" aria-live="polite">{annonce}</p>
    {#if erreur}<p class="message" role="alert">{erreur}</p>{/if}
    {#if !modifiable && pilote === false}<p class="avertissement" role="status">{t.lectureSeule}</p>{/if}

    {#if !terminees}
      <!-- CA-2 : les poules se tirent encore. -->
      <section class="carte avis" aria-label={t.titre}>
        <p>{t.poulesEnCours(avancement.regles, avancement.total)}</p>
        <button type="button" class="neutre" onclick={() => naviguer(cheminPoulesEpreuve(epreuveId))}>
          <Icone nom="grille" />{t.voirPoules}
        </button>
      </section>
    {:else if !structure}
      <section class="carte avis" aria-label={t.titre}><p>{t.unSeulQualifie}</p></section>
    {:else if cree}
      <!-- US-110 : les tours en pilules, puis l'arbre à partir du tour choisi. -->
      <div class="pilules" role="group" aria-label={t.tours}>
        {#each structure.tours as tour, i (tour.taille)}
          {@const { regles, total } = avancementTour(tour)}
          {@const pret = tour.matchs.some((m) => m.etat === 'aTirer' || m.etat === 'regle')}
          <button type="button" class="pilule" aria-pressed={i === tourChoisi} onclick={() => (tourManuel = i)}>
            {t.pilule(tour.taille)}{#if pret}<span class="avancement">{t.avancementTour(regles, total)}</span>{/if}
          </button>
        {/each}
      </div>
      {#if matchCarte}
        <CarteSaisieTableau
          match={matchCarte}
          {structure}
          {tireurs}
          touches={epreuve.formule.touchesTableau}
          {modifiable}
          saisir={saisirScore}
          choisir={(id) => (choisi = id)}
        />
      {/if}
      <ArbreTableau
        {structure}
        {tireurs}
        tour={tourChoisi}
        choisi={matchCarte?.id ?? null}
        choisir={(id) => (choisi = id)}
        {modifiable}
      />
    {:else}
      {#each exaequo as [rang, ids] (rang)}
        <p class="alerte" role="note">
          <Icone nom="alerte" />{t.exaequo(rang, ids.map((id) => nom(id)).join(', '))}
        </p>
      {/each}
      <section class="carte" aria-labelledby="titre-premier-tour">
        <header>
          <h3 id="titre-premier-tour">
            <Icone nom="arbre" />{t.premierTour} · {t.nomDuTour(structure.taille)}
          </h3>
          {#if modifiable}
            <button type="button" class="principal" onclick={() => (confirmer = true)}>
              <Icone nom="arbre" />{t.creer}
            </button>
          {/if}
        </header>
        <ol class="matchs">
          {#each premierTour as match (match.id)}
            <li>
              {#if match.etat === 'exempt'}
                {@const qualifie = match.haut.tireurId ? match.haut : match.bas}
                {@render place(qualifie)}
                <span class="exempt">{t.exempt}</span>
              {:else}
                {@render place(match.haut)}
                <span class="discret">{t.contre}</span>
                {@render place(match.bas)}
              {/if}
            </li>
          {/each}
        </ol>
        {#if nonQualifies.length > 0}
          <div class="non-qualifies">
            <h4>{t.nonQualifies} <span class="discret">· {t.nonQualifiesDetail}</span></h4>
            <ul>
              {#each nonQualifies as ligne (ligne.tireurId)}
                <li>{nom(ligne.tireurId)} <span class="motif">{textes.poules.motifs[ligne.retrait!]}</span></li>
              {/each}
            </ul>
          </div>
        {/if}
        <p class="pied">{t.legende}</p>
      </section>
    {/if}
  {/if}
{/snippet}

{#if epreuve}
  <GabaritEpreuve {accueil} {epreuve} courante="tableau" suite={t.titre} {naviguer}>
    {@render etape()}
  </GabaritEpreuve>
{:else}
  <main>{@render etape()}</main>
{/if}

{#if confirmer}
  <ConfirmationArchivage
    titre={t.confirmerCreation}
    detail={t.detailCreation}
    action={t.creer}
    valider={creer}
    fermer={() => (confirmer = false)}
  />
{/if}

<style>
  .titre-etape {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem 1rem;
  }

  .identite {
    display: grid;
    gap: 0.25rem;
  }

  .ligne {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }

  h2 {
    margin: 0;
    font-family: var(--police-titre, inherit);
    font-size: 1.6rem;
  }

  h3 {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
    font-size: 1rem;
  }

  h4 {
    margin: 0 0 0.5rem;
    font-size: 0.95rem;
  }

  .pastille {
    padding: 0.15rem 0.75rem;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--texte);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .pastille.enCours {
    background: var(--etat-ok-fond);
    color: var(--sur-etat-ok-fond);
  }

  .discret {
    margin: 0;
    color: var(--texte-discret);
  }

  .annonce:empty {
    display: none;
  }

  .annonce,
  .avertissement {
    margin: 0;
  }

  .avertissement {
    color: var(--texte-discret);
  }

  .alerte {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    padding: 0.6rem 1rem;
    border: 1px solid var(--etat-attente-bordure);
    border-radius: 10px;
    background: var(--etat-attente-fond);
    color: var(--sur-etat-attente-fond);
  }

  .carte {
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
    overflow: hidden;
  }

  .avis {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    padding: 1rem 1.25rem;
  }

  .avis p {
    margin: 0;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--bordure);
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 1rem;
    border-radius: var(--rayon, 10px);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .principal {
    border: none;
    background: var(--palette-tiffany);
    color: var(--sur-tiffany);
  }

  .neutre {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
  }

  .matchs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 24rem), 1fr));
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .matchs li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.6rem;
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var(--bordure);
  }

  .rang {
    color: var(--texte-discret);
    font-variant-numeric: tabular-nums;
  }

  .exempt {
    padding: 0.05rem 0.6rem;
    border-radius: 999px;
    background: var(--surface-2);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .pilules {
    display: flex;
    gap: 8px;
    overflow-x: auto;
  }

  .pilule {
    flex: none;
    gap: 8px;
    min-height: 40px;
    padding: 0 16px;
    border: 1px solid var(--bordure-champ);
    border-radius: 999px;
    background: var(--surface);
    color: var(--texte);
    font-size: 0.95rem;
  }

  .pilule[aria-pressed='true'] {
    border-color: var(--marque);
    background: var(--marque);
    color: var(--sur-marque);
  }

  .avancement {
    font-size: 0.8rem;
    font-weight: 400;
    opacity: 0.85;
  }

  .non-qualifies {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--bordure);
  }

  .non-qualifies ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .motif {
    padding: 0.1rem 0.6rem;
    border-radius: 999px;
    background: var(--etat-attente-fond);
    color: var(--sur-etat-attente-fond);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .pied {
    margin: 0;
    padding: 0.75rem 1rem;
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .message {
    margin: 0;
    color: var(--etat-erreur);
  }
</style>
