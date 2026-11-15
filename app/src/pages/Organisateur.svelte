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
    compterParFiltre,
    construireListe,
    competitionsProposables,
    contenusASupprimer,
    disponibiliteSuppression,
    couleurDeCompetition,
    elementsEnCours,
    filtrerDonnees,
    FILTRES_LISTE,
    manifestationAujourdhui,
    manifestationOuverte,
    nomsCourts,
    planSuppression,
    toutCocherListe,
    type Arme,
    type CompetitionListee,
    type ContenuASupprimer,
    type EpreuveListee,
    type FiltreListe,
    type ListeClub,
  } from '@poule-position/domaine';
  import type { SessionAppareil } from '../lib/stockage';
  import ConfirmationSuppression from '../composants/ConfirmationSuppression.svelte';
  import BoutonIcone from '../composants/BoutonIcone.svelte';
  import Icone from '../composants/Icone.svelte';
  import IconesEtat from '../composants/IconesEtat.svelte';
  import LegendeIcones from '../composants/LegendeIcones.svelte';
  import Lien from '../composants/Lien.svelte';
  import RepereDocuments from '../composants/RepereDocuments.svelte';
  import ConfirmationArchivage from '../composants/ConfirmationArchivage.svelte';
  import MenuActions, { type ActionMenu } from '../composants/MenuActions.svelte';
  import { verdictManifestation } from '../lib/archivage';
  import { estDeplie, filtreMemorise, memoriserFiltre, memoriserRepli } from '../lib/repli';
  import type { RaisonNonRattachee } from '../lib/rattachement-lot';
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
    CHEMIN_NOUVELLE_COMPETITION_SEULE,
    cheminGrilleEpreuves,
    cheminModificationManifestation,
    cheminManifestation,
    cheminPlanManifestation,
    cheminNouvelleCompetition,
    CHEMINS,
  } from '../lib/routes';
  import { fichiersPropres, type ClientFichiers } from '../lib/fichiers';
  import { textes } from '../lib/textes';
  import type { FichierJoint } from '@poule-position/protocole';

  interface Proprietes {
    session: SessionAppareil;
    accueil: Accueil;
    fichiers: ClientFichiers;
    naviguer: (chemin: string) => void;
  }

  let { session, accueil, fichiers, naviguer }: Proprietes = $props();

  const t = textes.listeClub;
  const tc = textes.epreuves;

  let horsLigne = $state(!navigator.onLine);
  let donnees: DonneesAccueil | null = $state(null);
  /** US-063 CA-1 et CA-7 : filtre de la liste, « À venir et en cours » à chaque nouvelle visite. */
  let filtre: FiltreListe = $state((filtreMemorise() as FiltreListe | null) ?? 'avenir');
  const archivesAffichees = $derived(filtre === 'archivees' || filtre === 'toutes');
  function choisirFiltre(valeur: FiltreListe) {
    filtre = valeur;
    memoriserFiltre(valeur);
    // La sélection ne garde que ce que le filtre montre encore.
    if (modeSelection) cochees.clear();
  }
  /** Jour d'aujourd'hui (`AAAA-MM-JJ`), pour ouvrir la manifestation en cours. */
  const aujourdhui = new Date().toLocaleDateString('sv-SE');

  const liste: ListeClub | null = $derived(
    donnees ? construireListe(filtrerDonnees(donnees, filtre), { afficherArchives: true }) : null,
  );
  const donneesCourantes = () => donnees;
  /** CA-6 : le club n'a rien du tout (le filtre n'y change rien). */
  const clubVide = $derived.by(() => {
    const d = donneesCourantes();
    return d !== null && d.manifestations.length === 0 && d.competitions.length === 0 && d.epreuves.length === 0;
  });
  const comptes = $derived(compterParFiltre(donneesCourantes()?.epreuves ?? []));
  const filtreSansElement = $derived(
    liste !== null &&
      liste.manifestations.length === 0 &&
      liste.competitionsSeules.length === 0 &&
      liste.aRattacher.length === 0,
  );
  const archivesMasquees = $derived(
    !archivesAffichees && (donneesCourantes()?.epreuves.some(({ statut }) => statut === 'archivee') ?? false),
  );

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

  /** US-062 : la recherche demande de déplier une compétition seule, même quand la page est déjà affichée. */
  onMount(() => {
    const surDeplier = (evenement: Event) => {
      const { id } = (evenement as CustomEvent<{ id: string }>).detail;
      choixRepli.set(id, true);
    };
    window.addEventListener('poule:deplier', surDeplier);
    return () => window.removeEventListener('poule:deplier', surDeplier);
  });

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
  /** US-033 : archiver ou désarchiver une manifestation (et ses compétitions, et ses épreuves) ; la confirmation est une fenêtre. */
  const ta = textes.archivage;
  let archivageDemande: { id: string; nom: string; archiver: boolean } | null = $state(null);
  /** Remarque après un désarchivage : des épreuves restent archivées, leur PC pilote doit les rendre. */
  let remarqueArchivage: string | null = $state(null);

  async function validerArchivage() {
    const demande = archivageDemande;
    if (!demande || !donnees) return { ok: false as const, message: ta.erreurs.ERREUR_INATTENDUE };
    const verdict = verdictManifestation(
      await accueil.archiverManifestation(demande.id, demande.archiver, donnees, {
        clubId: session.compte.clubId,
        auteur: session.compte.email,
      }),
    );
    if (verdict.ok) await charger();
    return verdict;
  }

  function fermerArchivage(_fait: boolean, remarque?: string) {
    archivageDemande = null;
    remarqueArchivage = remarque ?? null;
  }

  /** US-033 : l'action « Archiver » ou « Désarchiver » d'une manifestation ; grisée hors ligne (le serveur la stocke). */
  function actionArchiver(id: string, nom: string, archivee: boolean, motifHorsLigne: string | undefined): ActionMenu {
    return {
      libelle: archivee ? ta.desarchiver : ta.archiver,
      icone: 'archive',
      detail: archivee ? ta.detailDesarchiverManifestation : ta.detailArchiverManifestation,
      surChoix: () => (archivageDemande = { id, nom, archiver: !archivee }),
      indisponible: motifHorsLigne === undefined ? undefined : ta.horsLigne,
    };
  }

  function actionsManifestation(id: string, nom: string, archivee: boolean): ActionMenu[] {
    const motif = horsLigne ? t.horsLigne : undefined;
    return [
      {
        libelle: t.modifierManifestation,
        icone: 'crayon',
        chemin: cheminModificationManifestation(id),
        indisponible: motif,
      },
      { libelle: t.ajouterCompetition, icone: 'plus', chemin: cheminNouvelleCompetition(id), indisponible: motif },
      actionArchiver(id, nom, archivee, motif),
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

  /**
   * US-073 : les documents de chaque élément. La copie gardée sur l'appareil s'affiche tout de suite (et hors ligne) ; une
   * seule lecture du club la met à jour : aucune requête par ligne.
   */
  let documents: FichierJoint[] = $state([]);
  const aDesDocuments = $derived(documents.length > 0);
  async function chargerDocuments() {
    const copie = await fichiers.copie();
    if (copie) documents = copie.fichiers;
    const reponse = await fichiers.lister();
    documents = reponse.ok ? reponse.fichiers : (reponse.copie?.fichiers ?? documents);
  }

  /** US-040 et US-043 : suppression de manifestations, de compétitions et d’épreuves, réservée aux administrateurs. */
  const ts = t.suppression;
  const administrateur = $derived(session.compte.role === 'administrateur');
  /** US-063 : identifiants que le filtre montre, pour « Tout sélectionner ». */
  const elementsVisibles = (d: {
    manifestations: readonly { id: string }[];
    competitions: readonly { id: string }[];
    epreuves: readonly { id: string }[];
  }) => new Set([...d.manifestations, ...d.competitions, ...d.epreuves].map(({ id }) => id));
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
  const analyse = $derived(donnees ? analyserSelection(donnees, cochees, archivesAffichees) : null);
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
  const toutSelectionnable = $derived(
    donnees
      ? toutCocherListe(donnees, archivesAffichees, elementsVisibles(filtrerDonnees(donnees, filtre)))
      : new Set<string>(),
  );
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

  /** US-060 : épreuves à rattacher (leur compétition a disparu), liste dépliable et rattachement, une par une ou par lot. */
  const tr = t.rattachement;
  let aRattacherOuvert = $state(false);
  let rattachementEnCours = $state(false);
  let compteRattachement: {
    rattachees: number;
    restantes: { id: string; nom: string; raison: RaisonNonRattachee }[];
  } | null = $state(null);
  const idsARattacher = $derived(new Set((liste?.aRattacher ?? []).map(({ id }) => id)));
  /** CA-4 : le rattachement par lot n'est proposé que si la sélection ne contient que des épreuves à rattacher. */
  const selectionARattacher = $derived(cochees.size > 0 && [...cochees].every((id) => idsARattacher.has(id)));
  /** La liste des épreuves à rattacher s'ouvre par « Les rattacher », et d'office en mode sélection (pour les cocher). */
  const listeARattacherVisible = $derived((liste?.aRattacher.length ?? 0) > 0 && (aRattacherOuvert || modeSelection));

  /** Compétitions proposées pour ces épreuves (arme cohérente quand elles ont toutes la même). */
  const proposables = (armes: readonly Arme[]) =>
    donnees
      ? competitionsProposables(
          armes.map((arme) => ({ arme })),
          donnees.competitions,
          donnees.manifestations,
        )
      : [];

  /** CA-3 et CA-4 : rattache les épreuves à la compétition choisie, puis relit la liste ; le compte rendu dit le reste. */
  async function rattacherA(ids: string[], competitionId: string) {
    if (!donnees || rattachementEnCours || competitionId === '') return;
    rattachementEnCours = true;
    try {
      const compte = await accueil.rattacher(ids, competitionId, donnees, {
        clubId: session.compte.clubId,
        auteur: session.compte.email,
      });
      const noms = new Map(donnees.epreuves.map(({ id, nom }) => [id, nom]));
      compteRattachement = {
        rattachees: compte.rattachees.length,
        restantes: compte.restantes.map(({ id, raison }) => ({ id, nom: noms.get(id) ?? id, raison })),
      };
      // Ce qui n'a pas pu l'être reste coché, pour relancer ; si tout l'est, le mode sélection se ferme (comme US-059 CA-4).
      for (const id of compte.rattachees) cochees.delete(id);
      if (modeSelection && compte.restantes.length === 0) quitterLeMode();
      await charger();
    } finally {
      rattachementEnCours = false;
    }
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
    void chargerDocuments();
    return () => {
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
      window.removeEventListener('keydown', surTouche);
    };
  });
</script>

{#snippet repere(proprietaire: 'manifestation' | 'competition' | 'epreuve', id: string)}
  {@const propres = fichiersPropres(documents, proprietaire, id)}
  <RepereDocuments
    client={fichiers}
    affiche={propres.affiche}
    feuilleDeRoute={propres.feuilleDeRoute}
    inerte={modeSelection}
  />
{/snippet}

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

<!-- US-060 CA-2 (planche 4) : une épreuve à rattacher : son nom, son arme, sa catégorie, son sexe et sa date, puis le choix de sa
     compétition. Une épreuve pilotée par un autre PC ne se rattache pas d'ici. -->
{#snippet ligneARattacher(entree: EpreuveListee)}
  {@const choix = proposables([entree.arme])}
  {@const cochee = cochees.has(entree.id)}
  <li class="ligne-a-rattacher" class:cochee>
    {@render caseSelection(entree.id, ts.cocher(entree.nom), ts.enCours)}
    <div class="identite-a-rattacher">
      <p class="nom-a-rattacher">
        <a
          href={cheminEpreuve(entree.id)}
          aria-label={t.ouvrir(entree.nom)}
          onclick={(evenement) => {
            if (evenement.button !== 0 || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey) return;
            evenement.preventDefault();
            if (modeSelection) basculerLigne(entree.id);
            else naviguer(cheminEpreuve(entree.id));
          }}>{entree.nom}</a
        >
      </p>
      <p class="meta">
        {[
          tc.armes[entree.arme],
          entree.categorie,
          entree.sexe ? tc.sexes[entree.sexe] : null,
          entree.date ? tr.jour(entree.date) : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
    {#if choix.length === 0}
      <Lien chemin={CHEMIN_NOUVELLE_COMPETITION_SEULE} {naviguer}>{tr.creerCompetition}</Lien>
    {:else}
      <div class="choix-competition">
        <select
          class="selecteur"
          aria-label={tr.choisirPour(entree.nom)}
          aria-describedby={entree.pilote ? undefined : `depuis-pilote-${entree.id}`}
          disabled={!entree.pilote || rattachementEnCours || etapeSerie === 'encours'}
          onchange={(evenement) => {
            const valeur = evenement.currentTarget.value;
            evenement.currentTarget.value = '';
            void rattacherA([entree.id], valeur);
          }}
        >
          <option value="">{tr.choisir}</option>
          {#each choix as { id, libelle } (id)}<option value={id}>{libelle}</option>{/each}
        </select>
        {#if !entree.pilote}<small id="depuis-pilote-{entree.id}">{tr.depuisLePilote}</small>{/if}
      </div>
    {/if}
  </li>
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
    <!-- US-073 : le repère est une commande à part (jamais dans le lien) ; son emplacement est réservé à toutes les lignes pour garder les colonnes alignées. -->
    {#if aDesDocuments}<span class="emplacement-repere">{@render repere('epreuve', entree.id)}</span>{/if}
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
      <span class="devant">{@render repere('competition', competition.id)}</span>
      <span class="devant">
        <Lien chemin={cheminGrilleEpreuves(competition.id)} {naviguer} etiquette={tc.grille.ajouterA(competition.nom)}
          ><span class="texte-large">{t.plusEpreuves}</span><span class="icone-etroit" aria-hidden="true"
            ><Icone nom="plus" taille={20} /></span
          ></Lien
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

{#if archivageDemande}
  <ConfirmationArchivage
    titre={archivageDemande.archiver
      ? ta.titreArchiverManifestation(archivageDemande.nom)
      : ta.titreDesarchiverManifestation(archivageDemande.nom)}
    detail={archivageDemande.archiver ? ta.detailArchiverManifestation : ta.detailDesarchiverManifestation}
    action={archivageDemande.archiver ? ta.archiver : ta.desarchiver}
    valider={validerArchivage}
    fermer={fermerArchivage}
  />
{/if}

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
      {#if archivesMasquees}<small>{ts.archivesNonSelectionnees}</small>{/if}
      <button type="button" class="lien" onclick={basculerTout} disabled={horsLigne || etapeSerie === 'encours'}
        >{toutEstSelectionne ? ts.toutDeselectionner : ts.toutSelectionner}</button
      >
      <!-- US-060 CA-4 : rattacher les épreuves à rattacher cochées, par un choix de compétition. -->
      {#if selectionARattacher}
        <label class="rattacher-lot">
          <Icone nom="lien" taille={18} />
          <select
            class="selecteur"
            aria-label={tr.lot}
            disabled={rattachementEnCours || etapeSerie !== 'aucune'}
            onchange={(evenement) => {
              const valeur = evenement.currentTarget.value;
              evenement.currentTarget.value = '';
              void rattacherA([...cochees], valeur);
            }}
          >
            <option value="">{tr.lot}</option>
            {#each proposables([...cochees]
                .map((id) => donnees?.epreuves.find((e) => e.id === id)?.arme)
                .filter((a): a is Arme => a !== undefined)) as { id, libelle } (id)}<option value={id}>{libelle}</option
              >{/each}
          </select>
        </label>
      {/if}
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
    {#if administrateur && !modeSelection && liste && !clubVide}
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

      {#if clubVide}
        <p class="vide">{t.vide}</p>
      {:else}
        {#if remarqueArchivage}<p class="remarque" role="status">{remarqueArchivage}</p>{/if}
        <!-- US-063 CA-1 : quatre filtres exclusifs, en pilules ; le nombre d'épreuves suit le libellé (CA-6). -->
        <div class="filtres" role="group" aria-label={t.filtres}>
          {#each FILTRES_LISTE as valeur (valeur)}
            <button type="button" class="pilule" aria-pressed={filtre === valeur} onclick={() => choisirFiltre(valeur)}
              >{t.filtre[valeur]}<span class="nombre">{comptes[valeur]}</span></button
            >
          {/each}
        </div>
        {#if filtreSansElement}<p class="vide" role="status">{t.filtreVide[filtre]}</p>{/if}

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

        <!-- US-060 CA-6 (planche 4) : compte rendu d'un rattachement ; ce qui n'a pas pu l'être est listé avec son motif. -->
        {#if compteRattachement}
          <div class="compte-rendu">
            {#if compteRattachement.rattachees > 0}<p role="status">
                {tr.rattachees(compteRattachement.rattachees)}
              </p>{/if}
            {#if compteRattachement.restantes.length > 0}
              <p role="alert">{tr.nonRattachees(compteRattachement.restantes.length)}</p>
              <ul>
                {#each compteRattachement.restantes as { id, nom, raison } (id)}
                  <li>
                    {nom} · {tr.raisons[raison]}
                    {#if raison === 'DATE_HORS_MANIFESTATION' || raison === 'DATE_OBLIGATOIRE'}
                      <Lien chemin={cheminModificationEpreuve(id)} {naviguer}>{tr.modifier}</Lien>
                    {/if}
                  </li>
                {/each}
              </ul>
            {/if}
            <button type="button" class="secondaire" onclick={() => (compteRattachement = null)}>{tr.fermer}</button>
          </div>
        {/if}

        <!-- US-060 CA-1 (planche 1) : une alerte d'une ligne annonce les épreuves à rattacher ; leur liste s'ouvre à la demande. -->
        {#if liste.aRattacher.length > 0}
          <section class="alerte" aria-label={tr.alerteTitre}>
            <Icone nom="alerte" taille={22} />
            <p>
              <strong>{tr.alerte(liste.aRattacher.length)}</strong>
              {tr.alerteSuite}
            </p>
            <button
              type="button"
              class="lien-alerte"
              aria-expanded={listeARattacherVisible}
              aria-controls="epreuves-a-rattacher"
              onclick={() => (aRattacherOuvert = !aRattacherOuvert)}>{tr.lesRattacher}</button
            >
          </section>
        {/if}

        <!-- US-060 CA-2 (planche 4) : la liste, avec l'explication une seule fois en tête puis une ligne par épreuve. -->
        {#if listeARattacherVisible}
          <section id="epreuves-a-rattacher" class="a-rattacher" aria-label={tr.titre(liste.aRattacher.length)}>
            <header>
              <Icone nom="alerte" taille={22} />
              <div>
                <h2>{tr.titre(liste.aRattacher.length)}</h2>
                <p>{tr.explication}</p>
              </div>
            </header>
            <ul>
              {#each liste.aRattacher as entree (entree.id)}{@render ligneARattacher(entree)}{/each}
            </ul>
          </section>
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
                  {#if manifestation.archivee}<span class="etiquette-archivee">{tc.statuts.archivee}</span>{/if}
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
                  etiquette={textes.plan.lienPour(manifestation.nom)}
                  ><Icone nom="grille" taille={18} /><span class="texte-large">{t.plan}</span></Lien
                >
              </span>
              {@render repere('manifestation', manifestation.id)}
              <MenuActions
                id="menu-manifestation-{manifestation.id}"
                nom={manifestation.nom}
                actions={actionsManifestation(manifestation.id, manifestation.nom, manifestation.archivee === true)}
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
          <LegendeIcones avecDocuments={aDesDocuments} />
        {/if}
      {/if}
    {/if}
  </section>

  <!-- US-061 CA-2, US-066 : sur smartphone, « Créer » flotte en bas à droite (l'entête n'a plus que la marque et le compte), quel que soit le contenu de la liste, y compris un club vide. -->
  {#if !modeSelection}
    <a
      class="creer-flottant"
      href={CHEMINS.creer}
      onclick={(e) => {
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault();
        naviguer(CHEMINS.creer);
      }}><Icone nom="plus" taille={20} />{textes.entete.creer}</a
    >
  {/if}
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

  /* US-063 (planches 1 et 5) : filtres en pilules (999 px), le filtre choisi en --marque ; défilement horizontal sur smartphone. */
  .filtres {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
  }

  .pilule {
    display: inline-flex;
    flex: none;
    gap: 0.4rem;
    align-items: center;
    min-height: 44px;
    padding: 0 1rem;
    border: 1px solid var(--bordure);
    border-radius: 999px;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .pilule[aria-pressed='true'] {
    border-color: var(--marque);
    background: var(--marque);
    color: var(--sur-marque);
  }

  .pilule .nombre {
    font-weight: 400;
    opacity: 0.8;
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

  .emplacement-repere {
    display: inline-flex;
    flex: none;
    width: 44px;
    min-height: 44px;
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

  .remarque {
    margin: 0;
    padding: 0.6rem 0.75rem;
    border-left: 4px solid var(--etat-attente);
    background: var(--surface);
  }

  .etiquette-archivee {
    padding: 0.1rem 0.6rem;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--texte-discret);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .vide {
    margin: 0;
    color: var(--texte-discret);
  }

  .seule {
    display: grid;
    gap: 0.4rem;
  }

  /* US-060 (planche 1) : alerte d'une ligne, fond et bordure d'attente. */
  .alerte {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 0.7rem 1rem;
    border: 1px solid var(--etat-attente-bordure);
    border-radius: var(--rayon);
    background: var(--etat-attente-fond);
    color: var(--texte);
  }

  .alerte :global(svg) {
    flex: none;
    color: var(--etat-attente);
  }

  .alerte p {
    flex: 1;
    margin: 0;
  }

  .lien-alerte {
    padding: 0.25rem 0;
    background: none;
    color: var(--accent);
    font-weight: 600;
    text-decoration: underline;
  }

  /* US-060 (planche 4) : la liste des épreuves à rattacher, en carte avec un bandeau d'attente en tête. */
  .a-rattacher {
    overflow: hidden;
    border: 1px solid var(--etat-attente-bordure);
    border-radius: var(--rayon);
    background: var(--surface);
  }

  .a-rattacher header {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0.9rem 1rem;
    background: var(--etat-attente-fond);
  }

  .a-rattacher header :global(svg) {
    flex: none;
    margin-top: 0.15rem;
    color: var(--etat-attente);
  }

  .a-rattacher header h2 {
    margin: 0;
    font-size: 1.05rem;
  }

  .a-rattacher header p {
    margin: 0.15rem 0 0;
  }

  .ligne-a-rattacher {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--bordure);
  }

  .ligne-a-rattacher.cochee {
    background: var(--accent-teinte);
  }

  .identite-a-rattacher {
    flex: 1;
    min-width: 0;
  }

  .identite-a-rattacher p {
    margin: 0;
  }

  .nom-a-rattacher {
    font-weight: 600;
  }

  .nom-a-rattacher a {
    color: inherit;
    text-decoration: none;
  }

  .choix-competition {
    display: grid;
    gap: 0.2rem;
  }

  .selecteur {
    min-width: 14rem;
    max-width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    font: inherit;
  }

  .selecteur:disabled {
    opacity: 0.6;
  }

  .rattacher-lot {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    color: var(--texte);
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

  .icone-etroit,
  .creer-flottant {
    display: none;
  }

  /* Smartphone (US-061, planche 5, sous 40 rem comme l'entête) : une colonne, lignes compactes, cibles de 44 px, et « Créer »
     flottant en bas à droite, au-dessus des zones sûres de l'appareil. */
  @media (max-width: 39.99rem) {
    main {
      padding: 1rem max(1rem, env(safe-area-inset-left)) calc(6.5rem + env(safe-area-inset-bottom));
    }

    h1 {
      font-size: 1.5rem;
    }

    .entete-carte {
      flex-wrap: wrap;
      gap: 0.25rem 0.5rem;
      padding: 0.75rem;
    }

    .bascule-carte {
      min-width: 44px;
      min-height: 44px;
      align-items: center;
      justify-content: center;
    }

    .identite {
      flex-basis: 6rem;
    }

    .titre-carte {
      font-size: 1.15rem;
    }

    .bouton-plan {
      padding: 0;
    }

    .texte-large {
      display: none;
    }

    .icone-etroit {
      display: inline-flex;
    }

    .competitions {
      padding: 0 0 0.5rem;
    }

    .ligne-competition {
      gap: 0.25rem;
      padding: 0.25rem 0.75rem;
      border-radius: 0;
    }

    .bascule {
      min-height: 44px;
    }

    .nom-competition {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .competitions {
      grid-template-columns: minmax(0, 1fr);
    }

    .competition {
      grid-template-columns: minmax(0, 1fr);
      min-width: 0;
    }

    .bascule .meta {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .titre-ligne :global(button),
    .titre-carte :global(a),
    .bouton-plan :global(a) {
      display: inline-flex;
      min-width: 44px;
      min-height: 44px;
      box-sizing: border-box;
      align-items: center;
      justify-content: center;
    }

    .devant :global(a) {
      display: inline-flex;
      min-width: 44px;
      min-height: 44px;
      align-items: center;
      justify-content: center;
    }

    .epreuves {
      gap: 0;
      padding: 0;
    }

    .epreuve {
      gap: 0;
      border-top: 1px solid var(--bordure);
    }

    .epreuve :global(.case) {
      min-width: 44px;
      min-height: 44px;
    }

    /* La ligne d'épreuve : nom court et statut en texte à gauche, icônes d'état et chevron à droite. */
    .ligne-epreuve {
      grid-template-columns: minmax(0, 1fr) auto auto;
      grid-template-areas:
        'nom etat chevron'
        'statut etat chevron';
      gap: 0 0.5rem;
      min-height: 3.5rem;
      padding: 0.5rem 1rem;
      border: 0;
      border-radius: 0;
      background: var(--surface);
    }

    .nom-epreuve {
      grid-area: nom;
      color: var(--texte);
    }

    .jour {
      display: none;
    }

    .pastille {
      grid-area: statut;
      padding: 0;
      background: none;
      color: var(--texte-discret);
      font-size: 0.9rem;
    }

    .pastille.preparation,
    .pastille.enCours,
    .pastille.terminee {
      background: none;
      color: var(--texte-discret);
    }

    .ligne-epreuve :global(.icones) {
      grid-area: etat;
    }

    .ligne-epreuve .chevron {
      grid-area: chevron;
    }

    .attente {
      grid-column: 1 / -1;
    }

    .creer-flottant {
      position: fixed;
      right: max(1rem, env(safe-area-inset-right));
      bottom: calc(1rem + env(safe-area-inset-bottom));
      z-index: 20;
      display: inline-flex;
      gap: 0.5rem;
      align-items: center;
      min-height: 3.5rem;
      padding: 0 1.4rem;
      border-radius: 999px;
      background: var(--palette-tiffany);
      box-shadow: 0 4px 14px color-mix(in srgb, var(--texte) 25%, transparent);
      color: var(--sur-tiffany);
      font-size: 1.1rem;
      font-weight: 600;
      text-decoration: none;
    }
  }
</style>
