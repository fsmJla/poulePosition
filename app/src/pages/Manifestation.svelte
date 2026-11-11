<script lang="ts">
  // Page d'une manifestation (US-056) : fil d'Ariane, nom, dates, lieu, « Modifier », « ⋯ » et trois onglets
  // (Compétitions, Plan, Affiche et feuille de route), un par adresse. Elle remplace la liste « Manifestations » (US-023) :
  // les formulaires de la manifestation et de ses compétitions s'ouvrent ici (adresses « ?modifier » et « ?competition= »).
  // Les noms, dates et épreuves viennent de la liste du club (index, copies de l'appareil) : hors ligne, la page reste
  // affichée ; créer, modifier et supprimer (données du club stockées par le serveur) sont grisés.
  import { onMount } from 'svelte';
  import {
    construireListe,
    contenusASupprimer,
    couleurDeCompetition,
    disponibiliteSuppression,
    nomsCourts,
    type ContenuASupprimer,
    type EpreuveListee,
  } from '@poule-position/domaine';
  import type { Competition, Manifestation } from '@poule-position/protocole';
  import ConfirmationSuppression from '../composants/ConfirmationSuppression.svelte';
  import FichiersJoints from '../composants/FichiersJoints.svelte';
  import FilAriane from '../composants/FilAriane.svelte';
  import FormulaireCompetition from '../composants/FormulaireCompetition.svelte';
  import FormulaireManifestation from '../composants/FormulaireManifestation.svelte';
  import Icone from '../composants/Icone.svelte';
  import Lien from '../composants/Lien.svelte';
  import MenuActions, { type ActionMenu } from '../composants/MenuActions.svelte';
  import Onglets, { type Onglet } from '../composants/Onglets.svelte';
  import PlanManifestation from './PlanManifestation.svelte';
  import type { Accueil, DonneesAccueil } from '../lib/accueil';
  import type { ClientCompetitions } from '../lib/competitions';
  import { filSousAccueil } from '../lib/fil-ariane';
  import type { ClientFichiers } from '../lib/fichiers';
  import type { Journal } from '../lib/journal';
  import type { ClientManifestations } from '../lib/manifestations';
  import {
    CHEMINS,
    cheminEpreuve,
    cheminGrilleEpreuves,
    cheminManifestation,
    cheminModificationCompetition,
    cheminModificationManifestation,
    cheminNouvelleCompetition,
    cheminOnglet,
    ouvertureFormulaire,
    type OngletManifestation,
  } from '../lib/routes';
  import type { SessionAppareil } from '../lib/stockage';
  import { supprimerElement } from '../lib/suppression-unique';
  import type { Synchronisation } from '../lib/synchronisation';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: SessionAppareil;
    journal: Journal;
    synchronisation: Synchronisation;
    accueil: Accueil;
    clientManifestations: ClientManifestations;
    clientCompetitions: ClientCompetitions;
    /** US-030 : affiche et feuille de route d'une manifestation et de ses compétitions. */
    fichiers: ClientFichiers;
    manifestationId: string;
    onglet: OngletManifestation;
    /** Partie « ?… » de l'adresse : « ?modifier », « ?competition=nouvelle » ou « ?competition=<id> » ouvrent un formulaire. */
    recherche: string;
    /** US-041 : efface les copies locales des épreuves supprimées (lit l'index du club). */
    apresSuppressionContenu?: () => Promise<void>;
    naviguer: (chemin: string) => void;
  }

  let {
    session,
    journal,
    synchronisation,
    accueil,
    clientManifestations,
    clientCompetitions,
    fichiers,
    manifestationId,
    onglet,
    recherche,
    apresSuppressionContenu = async () => {},
    naviguer,
  }: Proprietes = $props();

  const t = textes.pageManifestation;
  const te = textes.epreuves;
  const tsu = textes.suppressionUnique;

  let horsLigne = $state(!navigator.onLine);
  let donnees: DonneesAccueil | null = $state(null);
  /** Enregistrements complets (version, commentaire) : seuls les formulaires en ont besoin. */
  let manifestationComplete: Manifestation | null = $state(null);
  let competitionsCompletes: Competition[] = $state([]);
  /** Change à chaque « Recharger » : les formulaires repartent des données à jour. */
  let versionFormulaire = $state(0);
  let confirmation: (ContenuASupprimer & { type: 'manifestation' | 'competition' }) | null = $state(null);

  const liste = $derived(donnees ? construireListe(donnees, { afficherArchives: false }) : null);
  const noeud = $derived(
    liste?.manifestations.find(({ manifestation }) => manifestation.id === manifestationId) ?? null,
  );
  const manifestation = $derived(noeud?.manifestation ?? null);
  const contenus = $derived(donnees ? contenusASupprimer(donnees) : new Map<string, ContenuASupprimer>());
  const formulaire = $derived(ouvertureFormulaire(recherche));
  const competitionModifiee = $derived(
    formulaire && 'competition' in formulaire && formulaire.competition !== 'nouvelle'
      ? (competitionsCompletes.find(({ id }) => id === formulaire.competition) ?? null)
      : null,
  );

  const couleur = (competitionId: string) => (donnees ? couleurDeCompetition(donnees.competitions, competitionId) : 0);

  async function charger() {
    const [lues, manifestations, competitions] = await Promise.all([
      accueil.charger(),
      clientManifestations.lister(),
      clientCompetitions.lister(),
    ]);
    donnees = lues;
    const toutes = manifestations.ok ? manifestations.manifestations : (manifestations.copie?.manifestations ?? []);
    manifestationComplete = toutes.find(({ id }) => id === manifestationId) ?? null;
    const siennes = competitions.ok ? competitions.competitions : (competitions.copie?.competitions ?? []);
    competitionsCompletes = siennes.filter((competition) => competition.manifestationId === manifestationId);
  }

  onMount(() => {
    const surReseau = () => {
      horsLigne = !navigator.onLine;
      void charger();
    };
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    void charger();
    return () => {
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
    };
  });

  const onglets: Onglet[] = $derived([
    {
      id: 'competitions',
      libelle: t.competitions,
      icone: 'liste',
      chemin: cheminOnglet(manifestationId, 'competitions'),
    },
    { id: 'plan', libelle: t.plan, icone: 'carres', chemin: cheminOnglet(manifestationId, 'plan') },
    { id: 'documents', libelle: t.documents, icone: 'document', chemin: cheminOnglet(manifestationId, 'documents') },
  ]);

  const motifHorsLigne = $derived(horsLigne ? t.necessiteInternet : undefined);

  /**
   * US-057 : l'unique « Supprimer… », dernier du menu, en rouge ; absent sans le droit, grisé hors ligne ou si une épreuve
   * est en cours.
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

  const actionsManifestation = (): ActionMenu[] => [
    {
      libelle: textes.listeClub.ajouterCompetition,
      icone: 'plus',
      chemin: cheminNouvelleCompetition(manifestationId),
      indisponible: motifHorsLigne,
    },
    ...actionSupprimer(manifestationId),
  ];

  const actionsCompetition = (id: string): ActionMenu[] => [
    {
      libelle: t.modifier,
      icone: 'crayon',
      chemin: cheminModificationCompetition(manifestationId, id),
      indisponible: motifHorsLigne,
    },
    { libelle: t.ajouterDesEpreuves, icone: 'plus', chemin: cheminGrilleEpreuves(id) },
    ...actionSupprimer(id),
  ];

  /** US-057 : la fenêtre se ferme ; une manifestation supprimée ramène à l'accueil, une compétition relit la page. */
  async function fermerConfirmation(supprime: boolean) {
    const supprimee = confirmation;
    confirmation = null;
    if (!supprime || !supprimee) return;
    if (supprimee.type === 'manifestation') {
      await apresSuppressionContenu();
      naviguer(CHEMINS.organisateur);
      return;
    }
    await charger();
  }

  /** CA-7 : l'enregistrement d'un formulaire ramène à l'onglet « Compétitions », données relues. */
  async function apresEnregistrement() {
    await charger();
    naviguer(cheminManifestation(manifestationId));
  }

  async function recharger() {
    await charger();
    versionFormulaire += 1;
  }

  const fermerFormulaire = () => naviguer(cheminManifestation(manifestationId));
</script>

{#snippet carte(competition: { id: string; nom: string; arme: string | null }, epreuves: EpreuveListee[])}
  {@const courts = nomsCourts(epreuves, te.sexes)}
  <article class="carte" aria-label={competition.nom} style="--couleur: var(--plan-{couleur(competition.id)})">
    <div class="ligne-carte">
      <span class="carre" aria-hidden="true"></span>
      <h2 class="nom">{competition.nom}</h2>
      {#if competition.arme}<span class="arme">· {te.armes[competition.arme as keyof typeof te.armes]}</span>{/if}
      <span class="actions-carte">
        <span class="plus-epreuves">
          <Lien chemin={cheminGrilleEpreuves(competition.id)} {naviguer} etiquette={te.grille.ajouterA(competition.nom)}
            ><Icone nom="plus" taille={18} />{t.plusEpreuves.replace('+ ', '')}</Lien
          >
        </span>
        <button
          type="button"
          class="crayon"
          aria-label={t.modifierCompetition(competition.nom)}
          title={t.modifierCompetition(competition.nom)}
          disabled={horsLigne}
          onclick={() => naviguer(cheminModificationCompetition(manifestationId, competition.id))}
        >
          <Icone nom="crayon" taille={20} />
        </button>
        <MenuActions
          id="menu-competition-{competition.id}"
          nom={competition.nom}
          actions={actionsCompetition(competition.id)}
          contour={false}
          {naviguer}
        />
      </span>
    </div>
    {#if epreuves.length > 0}
      <ul class="etiquettes" aria-label={t.epreuvesDe(competition.nom)}>
        {#each epreuves as epreuve (epreuve.id)}
          <li>
            <Lien chemin={cheminEpreuve(epreuve.id)} {naviguer} etiquette={t.ouvrirEpreuve(epreuve.nom)}
              >{courts.get(epreuve.id) ?? epreuve.nom}</Lien
            >
          </li>
        {/each}
      </ul>
    {/if}
  </article>
{/snippet}

{#if confirmation}
  <ConfirmationSuppression
    contenu={confirmation}
    supprimer={(surProgression) =>
      supprimerElement(confirmation as NonNullable<typeof confirmation>, accueil.actionsSuppression, surProgression)}
    fermer={fermerConfirmation}
  />
{/if}

<main>
  {#if donnees === null}
    <p role="status">{t.chargement}</p>
  {:else if manifestation === null || noeud === null}
    <p class="message" role="alert">{t.introuvable}</p>
    <Lien chemin={CHEMINS.organisateur} {naviguer}>{t.retourAccueil}</Lien>
  {:else}
    <FilAriane niveaux={filSousAccueil(manifestation.nom, [], textes.entete.accueil)} {naviguer} />
    {#if donnees.horsLigne}
      <p class="avertissement" role="status">
        {donnees.copieLe !== null
          ? textes.manifestations.listeDu(donnees.copieLe)
          : textes.listeClub.horsLigneSansCopie}
      </p>
    {/if}

    <header class="bandeau">
      <div class="identite">
        <h1>{manifestation.nom}</h1>
        <p class="infos">
          <span class="info"
            ><Icone nom="calendrier" taille={18} />{t.dates(manifestation.debut, manifestation.fin)}</span
          >
          {#if manifestation.lieu}<span class="info"><Icone nom="lieu" taille={18} />{manifestation.lieu}</span>{/if}
        </p>
      </div>
      <div class="actions">
        <button
          type="button"
          class="contour"
          disabled={horsLigne}
          onclick={() => naviguer(cheminModificationManifestation(manifestationId))}
        >
          <Icone nom="crayon" taille={18} />{t.modifier}
        </button>
        <MenuActions id="menu-manifestation" nom={manifestation.nom} actions={actionsManifestation()} {naviguer} />
      </div>
    </header>
    {#if horsLigne}<small class="hors-ligne">{t.necessiteInternet}</small>{/if}

    {#key versionFormulaire}
      {#if formulaire && 'manifestation' in formulaire && manifestationComplete}
        <FormulaireManifestation
          manifestation={manifestationComplete}
          client={clientManifestations}
          {horsLigne}
          enregistre={apresEnregistrement}
          annule={fermerFormulaire}
          {recharger}
        />
      {:else if formulaire && 'competition' in formulaire && manifestationComplete && (formulaire.competition === 'nouvelle' || competitionModifiee)}
        <FormulaireCompetition
          manifestation={manifestationComplete}
          competition={competitionModifiee}
          client={clientCompetitions}
          {fichiers}
          {horsLigne}
          enregistre={apresEnregistrement}
          annule={fermerFormulaire}
          {recharger}
        />
      {/if}
    {/key}

    <Onglets {onglets} actif={onglet} etiquette={t.onglets} {naviguer} />

    <div role="tabpanel" id="panneau-{onglet}" aria-labelledby="onglet-{onglet}" class="panneau">
      {#if onglet === 'competitions'}
        {#each noeud.competitions as { competition, epreuves } (competition.id)}
          {@render carte(competition, epreuves)}
        {/each}
        <button
          type="button"
          class="nouvelle"
          disabled={horsLigne}
          onclick={() => naviguer(cheminNouvelleCompetition(manifestationId))}
        >
          <Icone nom="plus" taille={20} />{t.nouvelleCompetition}
        </button>
      {:else if onglet === 'plan'}
        <PlanManifestation {session} {journal} {synchronisation} {accueil} {manifestationId} {naviguer} />
      {:else}
        <FichiersJoints client={fichiers} chaine={[{ proprietaire: 'manifestation', id: manifestationId }]} />
      {/if}
    </div>
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

  .bandeau {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: flex-start;
    justify-content: space-between;
  }

  .identite {
    display: grid;
    gap: 0.4rem;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .infos {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1.5rem;
    margin: 0;
    color: var(--texte-discret);
  }

  .info {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  button {
    font: inherit;
  }

  button.contour {
    display: inline-flex;
    gap: 0.5rem;
    align-items: center;
    min-height: 2.75rem;
    padding: 0 1rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .hors-ligne {
    color: var(--texte-discret);
  }

  .panneau {
    display: grid;
    gap: 0.8rem;
  }

  /* Carte de compétition (planche 2) : surface, bordure, carré de couleur, nom, arme, actions ; étiquettes dessous. */
  .carte {
    display: grid;
    gap: 0.9rem;
    padding: 1rem 1.2rem;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--surface);
  }

  .ligne-carte {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: center;
  }

  .carre {
    width: 1rem;
    height: 1rem;
    border-radius: 0.25rem;
    background: var(--couleur);
  }

  .nom {
    margin: 0;
    font-family: var(--police-titre, inherit);
    font-size: 1.15rem;
    font-weight: 700;
  }

  .arme {
    color: var(--texte-discret);
    font-size: 0.9rem;
  }

  .actions-carte {
    display: inline-flex;
    gap: 0.5rem;
    align-items: center;
    margin-left: auto;
  }

  .plus-epreuves :global(a) {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    padding: 0.5rem 0.9rem;
    color: var(--accent);
    font-weight: 600;
    text-decoration: none;
  }

  .crayon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    border: none;
    border-radius: var(--rayon);
    background: transparent;
    color: var(--texte);
    cursor: pointer;
  }

  .etiquettes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .etiquettes :global(a) {
    display: inline-block;
    padding: 0.4rem 0.9rem;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--texte);
    text-decoration: none;
  }

  .nouvelle {
    display: inline-flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
    min-height: 3rem;
    border: 1px dashed var(--bordure-champ);
    border-radius: var(--rayon);
    background: transparent;
    color: var(--accent);
    font-weight: 600;
    cursor: pointer;
  }

  .avertissement,
  .message {
    margin: 0;
    padding: 0.5rem 0.7rem;
    background: var(--surface);
  }

  .avertissement {
    border-left: 4px solid var(--etat-attente);
  }

  .message {
    border-left: 4px solid var(--etat-erreur);
  }
</style>
