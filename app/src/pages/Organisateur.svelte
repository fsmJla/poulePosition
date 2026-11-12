<script lang="ts">
  // Accueil de l'organisateur (US-003 CA-1, US-026, US-055), page réservée : la liste du club : les épreuves à rattacher (US-045 CA-7), puis les manifestations (repliables) avec leurs
  // compétitions et leurs épreuves, puis les compétitions seules. La liste vient du serveur, ou de la dernière copie gardée sur l'appareil et des épreuves
  // locales (hors ligne) ; la création d'une manifestation ou d'une compétition exige le réseau (US-023, US-024), celle
  // d'une épreuve non (US-025). La gestion des comptes (US-007) reste réservée aux administrateurs, grisée hors ligne.
  // Le profil (US-016) et la déconnexion (US-003 CA-5) sont dans le menu de compte de l'entête (US-017).
  import { onMount } from 'svelte';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';
  import {
    analyserSelection,
    construireListe,
    contenusASupprimer,
    disponibiliteSuppression,
    couleurDeCompetition,
    elementsEnCours,
    manifestationAujourdhui,
    manifestationOuverte,
    nomsCourts,
    planSuppression,
    toutCocherListe,
    type CompetitionListee,
    type ContenuASupprimer,
    type EpreuveListee,
    type ListeClub,
  } from '@poule-position/domaine';
  import type { SessionAppareil } from '../lib/stockage';
  import ConfirmationSuppression from '../composants/ConfirmationSuppression.svelte';
  import BoutonIcone from '../composants/BoutonIcone.svelte';
  import Icone from '../composants/Icone.svelte';
  import IconesEtat from '../composants/IconesEtat.svelte';
  import LegendeIcones from '../composants/LegendeIcones.svelte';
  import Lien from '../composants/Lien.svelte';
  import MenuActions, { type ActionMenu } from '../composants/MenuActions.svelte';
  import { estDeplie, memoriserRepli } from '../lib/repli';
  import { supprimerElement } from '../lib/suppression-unique';
  import type { Accueil, DonneesAccueil } from '../lib/accueil';
  import {
    compterParType,
    confirmationSerie,
    CONFIRMATION_SERIE,
    supprimerSerieMixte,
    type CompteRenduLot,
  } from '../lib/suppression';
  import {
    cheminEpreuve,
    cheminModificationEpreuve,
    cheminGrilleEpreuves,
    cheminModificationManifestation,
    cheminManifestation,
    cheminPlanManifestation,
    cheminNouvelleCompetition,
  } from '../lib/routes';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: SessionAppareil;
    accueil: Accueil;
    naviguer: (chemin: string) => void;
  }

  let { session, accueil, naviguer }: Proprietes = $props();

  const t = textes.listeClub;
  const tc = textes.epreuves;

  let horsLigne = $state(!navigator.onLine);
  let donnees: DonneesAccueil | null = $state(null);
  let afficherArchives = $state(false);
  /** Jour d'aujourd'hui (`AAAA-MM-JJ`), pour ouvrir la manifestation en cours. */
  const aujourdhui = new Date().toLocaleDateString('sv-SE');

  const liste: ListeClub | null = $derived(donnees ? construireListe(donnees, { afficherArchives }) : null);

  /** US-046 CA-4 : rang dans la palette de la compétition, le même que dans le plan de sa manifestation. */
  const couleur = (competitionId: string) => (donnees ? couleurDeCompetition(donnees.competitions, competitionId) : 0);

  /** US-055 CA-2 : pliage des cartes et des lignes, gardé pendant la visite (lib/repli.ts). */
  const choixRepli = new SvelteMap<string, boolean>();
  const deplie = (id: string, parDefaut: boolean) => choixRepli.get(id) ?? estDeplie(id, parDefaut);
  function basculerRepli(id: string, parDefaut: boolean) {
    const valeur = !deplie(id, parDefaut);
    choixRepli.set(id, valeur);
    memoriserRepli(id, valeur);
  }

  /** US-057 : le contenu de chaque élément, calculé une fois par chargement (la liste peut compter des centaines de cartes). */
  const contenus = $derived(donnees ? contenusASupprimer(donnees) : new Map<string, ContenuASupprimer>());
  const tsu = textes.suppressionUnique;
  let confirmation: (ContenuASupprimer & { type: 'manifestation' | 'competition' }) | null = $state(null);

  /**
   * US-057 CA-1 et CA-5 : l'unique action « Supprimer… », dernière du menu, en rouge ; absente sans le droit, grisée avec
   * son motif hors ligne ou si une épreuve est en cours.
   */
  function actionSupprimer(id: string): ActionMenu[] {
    const contenu = contenus.get(id);
    if (!contenu || contenu.type === 'epreuve') return [];
    const disponibilite = disponibiliteSuppression({ role: session.compte.role, enLigne: !horsLigne, contenu });
    if (disponibilite.etat === 'absent') return [];
    return [
      {
        libelle: tsu.action,
        icone: 'corbeille',
        detail: tsu.sousTitre(contenu),
        destructive: true,
        surChoix: () => (confirmation = contenu as NonNullable<typeof confirmation>),
        indisponible:
          disponibilite.etat === 'indisponible'
            ? disponibilite.motif === 'HORS_LIGNE'
              ? tsu.horsLigne
              : tsu.enCours
            : undefined,
      },
    ];
  }

  /** US-055 CA-6 : actions secondaires d'une manifestation ; celles qui exigent le réseau restent visibles, grisées. */
  function actionsManifestation(id: string): ActionMenu[] {
    const motif = horsLigne ? t.horsLigne : undefined;
    return [
      {
        libelle: t.modifierManifestation,
        icone: 'crayon',
        chemin: cheminModificationManifestation(id),
        indisponible: motif,
      },
      { libelle: t.ajouterCompetition, icone: 'plus', chemin: cheminNouvelleCompetition(id), indisponible: motif },
      ...actionSupprimer(id),
    ];
  }

  /** US-055 CA-6 : actions secondaires d'une compétition. */
  const actionsCompetition = (id: string): ActionMenu[] => [
    { libelle: tc.grille.ajouter, icone: 'plus', chemin: cheminGrilleEpreuves(id) },
    ...actionSupprimer(id),
  ];

  /** US-057 : la fenêtre se ferme ; si l'élément est supprimé, la liste se relit (et les copies locales avec elle). */
  async function fermerConfirmation(supprime: boolean) {
    const supprimee = confirmation;
    confirmation = null;
    if (supprime && supprimee) {
      cochees.delete(supprimee.id);
      await charger();
    }
  }

  async function charger() {
    donnees = await accueil.charger();
  }

  /** US-040 et US-043 : suppression de manifestations, de compétitions et d’épreuves, réservée aux administrateurs. */
  const ts = t.suppression;
  const administrateur = $derived(session.compte.role === 'administrateur');
  const cochees = new SvelteSet<string>();
  /** US-059 : les cases n'existent que dans le mode sélection, qui ne survit pas à un changement de page. */
  let modeSelection = $state(false);
  let etapeSerie: 'aucune' | 'confirmation' | 'encours' = $state('aucune');
  let saisieSerie = $state('');
  let progression: { faites: number; total: number } | null = $state(null);
  let compteRendu: CompteRenduLot | null = $state(null);

  /** CA-1 : les éléments qui ne se cochent pas (épreuve en cours, ou parent qui en contient une). */
  const enCours = $derived(donnees ? elementsEnCours(donnees) : new Set<string>());
  /** CA-2 à CA-4 : ce que couvre la sélection, contenu des parents compris, filtre d'archives pris en compte. */
  const analyse = $derived(donnees ? analyserSelection(donnees, cochees, afficherArchives) : null);
  /** CA-5 : les éléments à supprimer, dans l'ordre et sans doublon. */
  const plan = $derived(analyse ? planSuppression(analyse) : []);
  /** Une sélection d’épreuves seules garde les textes d'US-040. */
  const seulementEpreuves = $derived(
    !analyse || (analyse.decompte.manifestations === 0 && analyse.decompte.competitions === 0),
  );

  function basculer(id: string, coche: boolean) {
    if (coche) cochees.add(id);
    else cochees.delete(id);
  }

  /** US-059 : tout ce que la liste montre et qui est supprimable (les archives masquées n'en font pas partie). */
  const toutSelectionnable = $derived(donnees ? toutCocherListe(donnees, afficherArchives) : new Set<string>());
  const toutEstSelectionne = $derived(
    toutSelectionnable.size > 0 && [...toutSelectionnable].every((id) => cochees.has(id)),
  );

  /** « Tout sélectionner » prend ce que la liste montre et qui est supprimable ; quand tout l'est déjà, il vide la sélection. */
  function basculerTout() {
    const nouvelle = toutEstSelectionne ? new Set<string>() : toutSelectionnable;
    cochees.clear();
    for (const id of nouvelle) cochees.add(id);
  }

  /** US-059 CA-1 : « Sélectionner » ouvre le mode ; CA-5 : la croix et Échap le ferment et abandonnent la sélection. */
  function entrerDansLeMode() {
    modeSelection = true;
  }
  function quitterLeMode() {
    modeSelection = false;
    cochees.clear();
    etapeSerie = 'aucune';
    saisieSerie = '';
  }

  /** Hypothèse : en mode sélection, un clic sur une ligne coche sa case (si elle peut l'être) au lieu d'ouvrir l'élément. */
  function basculerLigne(id: string) {
    if (!analyse || enCours.has(id) || analyse.verrouillees.has(id) || horsLigne || etapeSerie === 'encours') return;
    basculer(id, !cochees.has(id));
  }

  /** CA-4 à CA-6 : supprime le plan élément par élément, puis relit la liste une seule fois. */
  async function lancerSerie() {
    if (etapeSerie !== 'confirmation' || !confirmationSerie(saisieSerie)) return;
    const aSupprimer = plan;
    etapeSerie = 'encours';
    compteRendu = null;
    progression = { faites: 0, total: aSupprimer.length };
    const compte = await supprimerSerieMixte(
      aSupprimer,
      accueil.actionsLot,
      (faites, total) => (progression = { faites, total }),
    );
    compteRendu = compte;
    // CA-6 : ce qui n'a pas été supprimé reste coché, pour relancer. US-059 CA-4 : si tout l'est, le mode se ferme.
    cochees.clear();
    for (const { element } of compte.restants) cochees.add(element.id);
    if (compte.restants.length === 0) modeSelection = false;
    progression = null;
    saisieSerie = '';
    etapeSerie = 'aucune';
    await charger();
  }

  onMount(() => {
    const surReseau = () => {
      horsLigne = !navigator.onLine;
      void charger();
    };
    // US-059 CA-5 : Échap quitte le mode (sauf si un menu ou une fenêtre l'a déjà pris, ou pendant une série).
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key !== 'Escape' || evenement.defaultPrevented) return;
      if (modeSelection && etapeSerie !== 'encours' && !confirmation) quitterLeMode();
    };
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    window.addEventListener('keydown', surTouche);
    void charger();
    return () => {
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
      window.removeEventListener('keydown', surTouche);
    };
  });
</script>

{#snippet caseSelection(id: string, libelle: string, motifEnCours: string)}
  <!-- US-059 CA-2 : une case par élément, seulement en mode sélection et pour un administrateur ; US-043 CA-2 : couverte par un parent coché, elle est cochée et verrouillée. -->
  {#if administrateur && modeSelection && analyse}
    {@const parent = analyse.verrouillees.get(id)}
    <input
      type="checkbox"
      class="case"
      checked={parent !== undefined || cochees.has(id)}
      disabled={enCours.has(id) || parent !== undefined || horsLigne || etapeSerie === 'encours'}
      title={parent !== undefined ? ts.avecParent(parent) : enCours.has(id) ? motifEnCours : undefined}
      aria-label={libelle}
      onchange={(evenement) => basculer(id, evenement.currentTarget.checked)}
    />
  {/if}
{/snippet}

<!-- US-055 CA-3 et CA-4 : la ligne entière est le lien vers l'épreuve ; son nom court, son jour, sa pastille de statut et
     ses deux icônes d'état. Le nom complet reste le nom accessible du lien. -->
{#snippet epreuve(entree: EpreuveListee, nomAffiche: string)}
  <li class="epreuve" class:cochee={cochees.has(entree.id) || analyse?.verrouillees.has(entree.id)}>
    {@render caseSelection(entree.id, ts.cocher(entree.nom), ts.enCours)}
    <a
      class="ligne-epreuve"
      href={cheminEpreuve(entree.id)}
      aria-label={t.ouvrir(entree.nom)}
      onclick={(evenement) => {
        if (evenement.button !== 0 || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey) return;
        evenement.preventDefault();
        if (modeSelection) basculerLigne(entree.id);
        else naviguer(cheminEpreuve(entree.id));
      }}
    >
      <span class="nom-epreuve">{nomAffiche}</span>
      <span class="jour">{entree.date ? t.jourCourt(entree.date) : ''}</span>
      <span class="pastille {entree.statut}">{tc.statuts[entree.statut]}</span>
      <IconesEtat publiee={entree.publiee} pilote={entree.pilote} />
      {#if entree.nonEnvoyee}<span class="attente">{tc.pasEncoreEnvoyee}</span>{/if}
      <span class="chevron"><Icone nom="chevron" taille={18} /></span>
    </a>
  </li>
{/snippet}

<!-- US-055 CA-2 : la ligne de compétition se déplie d'un clic (bouton étiré sur toute la ligne) ; « + Épreuves » et « ⋯ »
     restent des commandes à part. -->
{#snippet ligneCompetition(competition: CompetitionListee, epreuves: EpreuveListee[], parDefaut: boolean)}
  {@const ouverte = deplie(competition.id, parDefaut)}
  {@const courts = nomsCourts(epreuves, tc.sexes)}
  <div class="competition" style="--couleur: var(--plan-{couleur(competition.id)})">
    <div class="ligne-competition">
      {@render caseSelection(competition.id, ts.cocherCompetition(competition.nom), ts.contientEnCours)}
      <button
        type="button"
        class="bascule"
        aria-expanded={ouverte}
        aria-controls="epreuves-{competition.id}"
        onclick={() => (modeSelection ? basculerLigne(competition.id) : basculerRepli(competition.id, parDefaut))}
      >
        <span class="carre" aria-hidden="true"></span>
        <span class="nom-competition">{competition.nom}</span>
        <span class="meta">
          {competition.arme ? `${tc.armes[competition.arme]} · ` : ''}{t.nombreEpreuves(epreuves.length)}
        </span>
      </button>
      <span class="devant">
        <Lien chemin={cheminGrilleEpreuves(competition.id)} {naviguer} etiquette={tc.grille.ajouterA(competition.nom)}
          >{t.plusEpreuves}</Lien
        >
      </span>
      <span class="devant">
        <MenuActions
          id="menu-competition-{competition.id}"
          nom={competition.nom}
          actions={actionsCompetition(competition.id)}
          {naviguer}
        />
      </span>
      <span class="chevron" class:ouvert={ouverte}><Icone nom="chevron" taille={18} /></span>
    </div>
    {#if ouverte}
      <ul id="epreuves-{competition.id}" class="epreuves" aria-label={t.epreuvesDe(competition.nom)}>
        {#each epreuves as entree (entree.id)}{@render epreuve(entree, courts.get(entree.id) ?? entree.nom)}{:else}
          <li class="vide">{t.aucuneEpreuve}</li>
        {/each}
      </ul>
    {/if}
  </div>
{/snippet}

{#if confirmation}
  <ConfirmationSuppression
    contenu={confirmation}
    supprimer={(surProgression) =>
      supprimerElement(confirmation as NonNullable<typeof confirmation>, accueil.actionsSuppression, surProgression)}
    fermer={fermerConfirmation}
  />
{/if}

<!-- US-059 CA-2 : barre d'actions du mode sélection, sous l'entête (planche 4). -->
{#if administrateur && modeSelection && analyse}
  <div class="barre" role="toolbar" aria-label={ts.barre}>
    <div class="barre-interieur">
      <BoutonIcone icone="croix" nom={ts.quitter} onclick={quitterLeMode} />
      <span class="compteur" role="status"
        >{seulementEpreuves ? ts.selection(analyse.decompte.epreuves) : ts.selectionMixte(analyse.decompte)}</span
      >
      {#if liste && liste.archivesMasquees > 0}<small>{ts.archivesNonSelectionnees}</small>{/if}
      <button type="button" class="lien" onclick={basculerTout} disabled={horsLigne || etapeSerie === 'encours'}
        >{toutEstSelectionne ? ts.toutDeselectionner : ts.toutSelectionner}</button
      >
      <button
        type="button"
        class="danger"
        onclick={() => (etapeSerie = 'confirmation')}
        disabled={horsLigne || plan.length === 0 || etapeSerie !== 'aucune'}
        aria-describedby={horsLigne ? 'suppression-serie-aide' : undefined}
        ><Icone nom="corbeille" taille={18} />{ts.bouton}</button
      >
      {#if horsLigne}<small id="suppression-serie-aide">{ts.horsLigne}</small>{/if}
    </div>
  </div>
{/if}

<main>
  <div class="titre-ligne">
    <h1>{t.titre}</h1>
    <!-- US-059 CA-1 et CA-6 : réservé aux administrateurs ; hors ligne, grisé avec son motif. -->
    {#if administrateur && !modeSelection && liste && !liste.vide}
      <button
        type="button"
        class="secondaire"
        onclick={entrerDansLeMode}
        disabled={horsLigne}
        aria-describedby={horsLigne ? 'selection-aide' : undefined}>{ts.selectionner}</button
      >
      {#if horsLigne}<small id="selection-aide">{ts.horsLigne}</small>{/if}
    {/if}
  </div>

  <section class="liste" aria-label={t.titre}>
    {#if donnees === null || liste === null}
      <p role="status">{t.chargement}</p>
    {:else}
      {#if donnees.horsLigne}
        <p class="avertissement" role="status">
          {donnees.copieLe !== null ? textes.manifestations.listeDu(donnees.copieLe) : t.horsLigneSansCopie}
        </p>
      {/if}

      {#if liste.vide}
        <p class="vide">{t.vide}</p>
      {:else}
        <div class="filtre">
          <label>
            <input type="checkbox" bind:checked={afficherArchives} />
            {t.afficherArchives}
          </label>
          {#if liste.archivesMasquees > 0}<small>{t.archivesMasquees(liste.archivesMasquees)}</small>{/if}
        </div>

        <!-- CA-4 : un seul message pour toute la sélection, avec le décompte par type et les éléments cochés directement. -->
        {#if etapeSerie !== 'aucune' && analyse}
          {@const titre = seulementEpreuves ? ts.titre(analyse.decompte.epreuves) : ts.titreMixte(analyse.decompte)}
          <div class="confirmation" role="group" aria-label={titre}>
            <p>{titre}</p>
            {#if analyse.archiveesMasquees > 0}<p>{ts.archiveesMasquees(analyse.archiveesMasquees)}</p>{/if}
            <p class="avertissement" role="status">{ts.avertissement}</p>
            <ul class="noms">
              {#each plan as { type, id, nom } (id)}<li>{nom} ({ts.types[type]})</li>{/each}
            </ul>
            {#if etapeSerie === 'encours' && progression}
              <p role="status">{ts.progression(progression.faites, progression.total)}</p>
            {:else}
              <label>
                {ts.saisie(CONFIRMATION_SERIE)}
                <input type="text" bind:value={saisieSerie} autocomplete="off" />
              </label>
              <div class="boutons">
                <button
                  type="button"
                  class="danger"
                  onclick={lancerSerie}
                  disabled={horsLigne || !confirmationSerie(saisieSerie)}>{ts.valider}</button
                >
                <button type="button" class="secondaire" onclick={() => ((etapeSerie = 'aucune'), (saisieSerie = ''))}
                  >{ts.annuler}</button
                >
              </div>
            {/if}
          </div>
        {/if}

        <!-- CA-6 : compte rendu de la série ; ce qui reste demeure coché pour relancer. -->
        {#if compteRendu}
          {@const supprimes = compterParType(compteRendu.supprimes)}
          {@const restantes = compteRendu.restants.map(({ element }) => element)}
          <div class="compte-rendu">
            <p role="status">
              {supprimes.manifestations === 0 && supprimes.competitions === 0
                ? ts.compteRendu(supprimes.epreuves)
                : ts.compteRenduMixte(supprimes)}
            </p>
            {#if restantes.length > 0}
              <p role="alert">
                {restantes.every(({ type }) => type === 'epreuve')
                  ? ts.restantes(restantes.length)
                  : ts.restantesMixte(restantes.length)}
              </p>
              <ul>
                {#each compteRendu.restants as { element, erreur } (element.id)}
                  <li>{element.nom} · {erreur ? ts.erreurs[erreur] : ts.nonTraitee}</li>
                {/each}
              </ul>
              {#if compteRendu.interrompue}<p role="alert">{ts.interrompue}</p>{/if}
            {/if}
            <button type="button" class="secondaire" onclick={() => (compteRendu = null)}>{ts.fermer}</button>
          </div>
        {/if}

        <!-- US-045 CA-7 : une épreuve dont la compétition a disparu est signalée en tête, avec le moyen d'en choisir une autre. -->
        {#if liste.aRattacher.length > 0}
          <div class="a-rattacher">
            <h2>{t.aRattacher}</h2>
            <ul class="epreuves">
              {#each liste.aRattacher as entree (entree.id)}
                {@render epreuve(entree, entree.nom)}
                <li class="vide" role="status">
                  {t.competitionSupprimee}
                  <Lien
                    chemin={cheminModificationEpreuve(entree.id)}
                    {naviguer}
                    etiquette={t.choisirCompetition(entree.nom)}>{t.choisirCompetitionBouton}</Lien
                  >
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        <!-- US-055 CA-1 : une carte par manifestation ; dépliée si elle est en cours ou à venir (compétitions repliées,
             sauf s'il n'y en a qu'une). -->
        {#each liste.manifestations as noeud (noeud.manifestation.id)}
          {@const manifestation = noeud.manifestation}
          {@const ouverte = deplie(manifestation.id, manifestationOuverte(manifestation, aujourdhui))}
          {@const epreuvesTotal = noeud.competitions.reduce((somme, { epreuves }) => somme + epreuves.length, 0)}
          <article class="carte" aria-label={manifestation.nom}>
            <header class="entete-carte">
              {@render caseSelection(manifestation.id, ts.cocherManifestation(manifestation.nom), ts.contientEnCours)}
              <button
                type="button"
                class="bascule-carte"
                aria-expanded={ouverte}
                aria-label={t.competitionsDe(manifestation.nom)}
                onclick={() => basculerRepli(manifestation.id, manifestationOuverte(manifestation, aujourdhui))}
              >
                <span class="chevron" class:ouvert={ouverte}><Icone nom="chevron" taille={20} /></span>
              </button>
              <div class="identite">
                <p class="titre-carte">
                  {#if modeSelection && administrateur}
                    <button type="button" class="nom-selectionnable" onclick={() => basculerLigne(manifestation.id)}
                      >{manifestation.nom}</button
                    >
                  {:else}
                    <Lien chemin={cheminManifestation(manifestation.id)} {naviguer}>{manifestation.nom}</Lien>
                  {/if}
                  {#if manifestationAujourdhui(manifestation, aujourdhui)}<span class="etiquette-jour"
                      >{t.aujourdhui}</span
                    >{/if}
                </p>
                <p class="meta">
                  {textes.manifestations.periode(manifestation.debut, manifestation.fin)}
                  {#if manifestation.lieu}· {manifestation.lieu}{/if}
                  · {t.decompte(noeud.competitions.length, epreuvesTotal)}
                </p>
              </div>
              <span class="bouton-plan">
                <Lien
                  chemin={cheminPlanManifestation(manifestation.id)}
                  {naviguer}
                  etiquette={textes.plan.lienPour(manifestation.nom)}><Icone nom="grille" taille={18} />{t.plan}</Lien
                >
              </span>
              <MenuActions
                id="menu-manifestation-{manifestation.id}"
                nom={manifestation.nom}
                actions={actionsManifestation(manifestation.id)}
                {naviguer}
              />
            </header>
            {#if ouverte}
              <div class="competitions">
                {#each noeud.competitions as { competition, epreuves } (competition.id)}
                  {@render ligneCompetition(competition, epreuves, noeud.competitions.length === 1)}
                {:else}
                  <p class="vide">{t.aucuneCompetition}</p>
                {/each}
              </div>
            {/if}
          </article>
        {/each}

        <!-- US-045 CA-5 : les compétitions seules, après les manifestations (dépliées : leurs épreuves se voient d'emblée). -->
        {#each liste.competitionsSeules as { competition, epreuves } (competition.id)}
          <div class="seule">
            {@render ligneCompetition(competition, epreuves, true)}
          </div>
        {/each}

        <!-- US-059 CA-3 : rappel de la règle des parents, tant que le mode est ouvert. -->
        {#if administrateur && modeSelection}<p class="aide-selection">{ts.aide}</p>{/if}

        <!-- US-055 CA-5 : légende des quatre icônes, dès qu'il y a une épreuve. -->
        {#if liste.manifestations.some( ({ competitions }) => competitions.some(({ epreuves }) => epreuves.length > 0) ) || liste.competitionsSeules.some(({ epreuves }) => epreuves.length > 0) || liste.aRattacher.length > 0}
          <LegendeIcones />
        {/if}
      {/if}
    {/if}
  </section>
</main>

<style>
  main {
    display: grid;
    gap: 1rem;
    width: min(100%, 65rem);
    margin: 0 auto;
    padding: 2rem 1rem 4rem;
    box-sizing: border-box;
  }

  h1 {
    margin: 0;
    font-family: var(--police-titre, inherit);
    font-size: 1.9rem;
    line-height: 1.2;
  }

  .titre-ligne {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
    justify-content: space-between;
  }

  /* US-059 (planche 4) : barre pleine largeur sous l'entête, fond teinté ; la croix et le compteur à gauche, les actions à droite. */
  .barre {
    position: sticky;
    top: 0;
    z-index: 5;
    border-bottom: 1px solid var(--accent-teinte-bordure);
    background: var(--accent-teinte);
  }

  .barre-interieur {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
    padding: 0.6rem 1.5rem;
  }

  .compteur {
    font-weight: 600;
  }

  .barre-interieur .lien {
    margin-left: auto;
    padding: 0.5rem 0.25rem;
    background: none;
    color: var(--accent);
  }

  button.danger {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
  }

  .nom-selectionnable {
    padding: 0;
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 700;
    text-align: left;
  }

  .aide-selection {
    margin: 0;
    color: var(--texte-discret);
    font-size: 0.95rem;
  }

  h2 {
    margin: 0 0 0.4rem;
    font-size: 1rem;
  }

  .liste {
    display: grid;
    gap: 0.9rem;
    text-align: left;
  }

  small,
  .meta {
    margin: 0;
    color: var(--texte-discret);
    font-weight: 400;
  }

  .meta {
    font-size: 0.9rem;
  }

  .filtre {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
  }

  /* Carte de manifestation (planche 1) : fond de surface, bordure, entête puis lignes de compétition. */
  .carte {
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--surface);
  }

  .entete-carte {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    padding: 0.8rem 1rem;
  }

  .bascule-carte {
    display: inline-flex;
    padding: 0.4rem;
    background: none;
    color: var(--texte);
  }

  .identite {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .titre-carte {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin: 0;
    font-family: var(--police-titre, inherit);
    font-size: 1.3rem;
    font-weight: 700;
  }

  .etiquette-jour {
    padding: 0.1rem 0.55rem;
    border: 1px solid var(--accent-teinte-bordure);
    border-radius: 999px;
    background: var(--accent-teinte);
    color: var(--texte);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
  }

  .titre-carte :global(a),
  .bouton-plan :global(a),
  .devant :global(a) {
    text-decoration: none;
  }

  .titre-carte :global(a) {
    color: var(--texte);
  }

  .bouton-plan :global(a) {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    color: var(--texte);
    font-weight: 400;
  }

  .bouton-plan {
    padding: 0.4rem 0.9rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--fond);
  }

  .competitions {
    display: grid;
    gap: 0.6rem;
    padding: 0 1rem 1rem;
  }

  /* Ligne de compétition : fond secondaire, carré de la couleur du plan, nom, arme, « + Épreuves », chevron. */
  .competition {
    display: grid;
    gap: 0.5rem;
  }

  .ligne-competition {
    position: relative;
    display: flex;
    gap: 0.6rem;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-radius: var(--rayon);
    background: var(--surface-2);
  }

  .bascule {
    display: flex;
    flex: 1;
    gap: 0.6rem;
    align-items: center;
    min-width: 0;
    padding: 0.25rem 0;
    background: none;
    color: var(--texte);
    text-align: left;
  }

  /* Le bouton couvre toute la ligne ; ce qui doit rester cliquable à part passe devant. */
  .bascule::after {
    position: absolute;
    inset: 0;
    border-radius: var(--rayon);
    content: '';
  }

  .devant,
  .ligne-competition .case {
    position: relative;
    z-index: 1;
  }

  /* Le menu « ⋯ » ouvert passe au-dessus des commandes des lignes suivantes (même niveau d'empilement sinon). */
  .devant:focus-within {
    z-index: 10;
  }

  .carre {
    flex: none;
    width: 1rem;
    height: 1rem;
    border-radius: 4px;
    background: var(--couleur);
  }

  .nom-competition {
    overflow-wrap: anywhere;
    font-weight: 700;
  }

  .chevron {
    display: inline-flex;
    flex: none;
    color: var(--texte-discret);
    pointer-events: none;
    transition: transform 0.15s;
  }

  .chevron.ouvert {
    transform: rotate(90deg);
  }

  .epreuves {
    display: grid;
    gap: 0.35rem;
    margin: 0;
    padding: 0 0 0 1.25rem;
    list-style: none;
  }

  .epreuve {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .case {
    accent-color: var(--accent);
  }

  /* US-059 (planche 4) : une épreuve sélectionnée a le fond teinté. */
  .epreuve.cochee .ligne-epreuve {
    background: var(--accent-teinte);
    border-color: var(--accent-teinte-bordure);
  }

  .ligne-epreuve {
    display: grid;
    flex: 1;
    grid-template-columns: minmax(0, 1fr) 7rem 7.5rem 3.5rem 1.25rem;
    gap: 0.75rem;
    align-items: center;
    min-height: 2.75rem;
    padding: 0.3rem 0.75rem;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--fond);
    color: inherit;
    text-decoration: none;
  }

  .ligne-epreuve:hover {
    border-color: var(--accent);
  }

  .nom-epreuve {
    overflow-wrap: anywhere;
    color: var(--accent);
    font-weight: 600;
  }

  .jour {
    color: var(--texte-discret);
    font-size: 0.9rem;
  }

  .pastille {
    justify-self: start;
    padding: 0.1rem 0.6rem;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--texte-discret);
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .pastille.preparation {
    background: var(--etat-attente-fond);
    color: var(--sur-etat-attente-fond);
  }

  .pastille.enCours {
    background: var(--accent-teinte);
    color: var(--texte);
  }

  .pastille.terminee {
    background: var(--etat-ok-fond);
    color: var(--sur-etat-ok-fond);
  }

  .attente {
    padding: 0.1rem 0.55rem;
    border-left: 3px solid var(--etat-attente);
    background: var(--surface);
    color: var(--texte-discret);
    font-size: 0.8rem;
  }

  .vide {
    margin: 0;
    color: var(--texte-discret);
  }

  .a-rattacher,
  .seule {
    display: grid;
    gap: 0.4rem;
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
    align-items: center;
  }

  .confirmation,
  .compte-rendu {
    display: grid;
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--surface);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .noms {
    display: grid;
    gap: 0.5rem;
    max-height: 10rem;
    overflow-y: auto;
  }

  .confirmation label {
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

  .avertissement {
    margin: 0;
    padding: 0.6rem 0.75rem;
    border-left: 4px solid var(--etat-attente);
    background: var(--surface);
  }

  /* Smartphone : l'entête de carte et les lignes d'épreuve passent sur deux lignes. */
  @media (max-width: 40rem) {
    .entete-carte {
      flex-wrap: wrap;
    }

    .identite {
      flex-basis: calc(100% - 7rem);
    }

    .ligne-epreuve {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .epreuves {
      padding-left: 0;
    }
  }
</style>
