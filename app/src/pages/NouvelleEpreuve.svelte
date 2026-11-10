<script lang="ts">
  // « Nouvelle épreuve » (US-025), page réservée : l’épreuve est écrite dans le journal local, donc créée
  // aussi hors ligne ; ce PC en devient le pilote et l'envoi au serveur part aussitôt, ou au retour du réseau (US-022).
  // Toute épreuve est dans une compétition (US-045), choisie parmi les dernières listes du club gardées sur l'appareil :
  // hors ligne, l’épreuve reste créable dans une compétition que la copie contient. « Nouvelle compétition seule » crée la
  // compétition (en ligne) et sa première épreuve en une étape.
  // La même page sert à modifier une épreuve (US-027, `epreuveId` donné) : le formulaire est prérempli depuis le
  // journal local et écrit `EpreuveModifiee` ; sur un PC qui n'est pas le pilote, il est en lecture seule.
  import { onMount, untrack } from 'svelte';
  import {
    ARMES,
    CATEGORIES,
    type Arme,
    champsModifiables,
    joursDeManifestation,
    nomDeCopie,
    nomDejaPris,
    SEXES,
    TYPES_EPREUVE,
    type ChampDonnees,
    type ErreursEpreuve,
    type Statut,
  } from '@poule-position/domaine';
  import type { Competition, Manifestation } from '@poule-position/protocole';
  import Lien from '../composants/Lien.svelte';
  import {
    cadreDe,
    CATEGORIE_LIBRE,
    creerCompetitionSeule,
    creerEpreuve,
    modifierEpreuve,
    rattacher,
    saisieDe,
    saisieDeCopie,
    saisieVide,
    type ErreurCompetitionSeule,
    type ErreurCreation,
    type ErreurModification,
  } from '../lib/epreuves';
  import type { Accueil, DonneesAccueil } from '../lib/accueil';
  import type { ClientCompetitions } from '../lib/competitions';
  import { prendreEcriture, type Journal } from '../lib/journal';
  import type { ClientManifestations } from '../lib/manifestations';
  import { cheminEpreuve, cheminPlanManifestation, CHEMINS, copieEpreuve, preselectionEpreuve } from '../lib/routes';
  import type { SessionAppareil } from '../lib/stockage';
  import type { Synchronisation } from '../lib/synchronisation';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: SessionAppareil;
    journal: Journal;
    synchronisation: Synchronisation;
    /** US-024 : listes pour le choix du rattachement. */
    clientManifestations: ClientManifestations;
    clientCompetitions: ClientCompetitions;
    /** US-051 : épreuves du club, pour nommer une copie et signaler un nom déjà pris. */
    accueil: Accueil;
    naviguer: (chemin: string) => void;
    /** US-027 : épreuve à modifier ; absent pour une création. */
    epreuveId?: string;
  }

  let {
    session,
    journal,
    synchronisation,
    clientManifestations,
    clientCompetitions,
    accueil,
    naviguer,
    epreuveId,
  }: Proprietes = $props();

  const t = textes.epreuves;

  const saisie = $state(saisieVide());
  let erreurs: ErreursEpreuve = $state({});
  let erreur: ErreurCreation | ErreurModification | ErreurCompetitionSeule | null = $state(null);
  let enCours = $state(false);

  /** US-027 : faux tant que l’épreuve à modifier n'est pas lue. */
  let chargee = $state(untrack(() => epreuveId === undefined));
  let introuvable = $state(false);
  let statut: Statut = $state('preparation');
  let pilote = $state(true);
  /** Faux si un autre onglet détient déjà l'écriture de cette épreuve. */
  let ecriture = $state(true);
  const modification = $derived(epreuveId !== undefined);
  const lectureSeule = $derived(modification && (!pilote || !ecriture));

  /** CA-2, CA-3 et cas limites : un champ figé par le statut, ou tout le formulaire en lecture seule, est désactivé. */
  const inactif = (champ: ChampDonnees) =>
    enCours || lectureSeule || (modification && !champsModifiables(statut).includes(champ));

  let manifestations: Manifestation[] = $state([]);
  let competitions: Competition[] = $state([]);
  const cadre = $derived(cadreDe(saisie, manifestations, competitions));
  /** Valeur du choix « Nouvelle compétition seule » (US-045 CA-4), proposé à la création seulement. */
  const SEULE = '+seule';
  let seule = $state(false);
  let enLigne = $state(navigator.onLine);
  /** Les compétitions du choix, avec la manifestation qui les contient s'il y en a une. */
  const choix = $derived(
    competitions
      .map((competition) => ({
        competition,
        manifestation: manifestations.find(({ id }) => id === competition.manifestationId)?.nom ?? null,
      }))
      .sort(
        (a, b) =>
          (a.manifestation ?? '￿').localeCompare(b.manifestation ?? '￿') ||
          a.competition.nom.localeCompare(b.competition.nom),
      ),
  );

  /** Listes du club : à jour en ligne, sinon la dernière copie de l'appareil. */
  onMount(() => {
    let liberer: (() => void) | null = null;
    let demonte = false;
    const surReseau = () => (enLigne = navigator.onLine);
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    // US-045 CA-4 : « Nouvelle compétition seule » de la liste du club ouvre ce formulaire sur ce choix.
    if (epreuveId === undefined && navigator.onLine && new URLSearchParams(location.search).has('seule')) seule = true;
    if (epreuveId !== undefined) {
      const identifiant = epreuveId;
      void (async () => {
        const { epreuve } = await journal.lire(identifiant);
        if (epreuve) {
          Object.assign(saisie, saisieDe(epreuve));
          statut = epreuve.statut;
          pilote = (await journal.etat(identifiant))?.pilote ?? false;
          if (pilote) {
            liberer = await prendreEcriture(identifiant);
            if (demonte) liberer?.();
            ecriture = liberer !== null;
          }
        } else introuvable = true;
        chargee = true;
      })();
    }
    void (async () => {
      const [lues, lus] = await Promise.all([clientManifestations.lister(), clientCompetitions.lister()]);
      manifestations = lues.ok ? lues.manifestations : (lues.copie?.manifestations ?? []);
      competitions = lus.ok ? lus.competitions : (lus.copie?.competitions ?? []);
      // US-049 CA-2 : « + Épreuve » du plan ouvre le formulaire avec la compétition et le jour déjà choisis.
      const demande = epreuveId === undefined ? preselectionEpreuve(location.search) : null;
      if (demande && competitions.some(({ id }) => id === demande.competitionId)) {
        depart = demande.competitionId;
        choisirCompetition(demande.competitionId);
        if (demande.jour) saisie.date = demande.jour;
        void preremplirCopie(demande.competitionId);
      }
    })();
    return () => {
      demonte = true;
      liberer?.();
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
    };
  });

  /**
   * US-051 CA-2 à CA-4 : prérempli par la copie d'une épreuve. Connue du journal local, l'originale donne catégorie, sexe,
   * type et lieu ; sinon seuls l'arme et le jour (déjà posé) sont repris. Horaires et commentaire restent vides.
   */
  async function preremplirCopie(competitionId: string) {
    const demande = copieEpreuve(location.search);
    if (!demande) return;
    copie = true;
    try {
      donneesClub = await accueil.charger();
    } catch {
      donneesClub = null;
    }
    const noms = (donneesClub?.epreuves ?? [])
      .filter(({ rattachement }) => rattachement.competitionId === competitionId)
      .map(({ nom }) => nom);
    const { epreuve } = await journal.lire(demande.epreuveId);
    if (epreuve) {
      const jour = saisie.date;
      Object.assign(saisie, saisieDeCopie(epreuve, nomDeCopie(epreuve.nom, noms)), { competitionId });
      saisie.date = jour || saisie.date;
      Object.assign(saisie, rattacher($state.snapshot(saisie), competitionId, manifestations, competitions));
    } else {
      if (!saisie.arme && (ARMES as readonly string[]).includes(demande.arme ?? '')) saisie.arme = demande.arme as Arme;
      if (demande.nom) saisie.nom = nomDeCopie(demande.nom, noms);
    }
  }

  /** US-051 : vrai quand le formulaire vient de « Dupliquer » ; la copie signale un nom déjà pris avant de se créer. */
  let copie = $state(false);
  let donneesClub = $state<DonneesAccueil | null>(null);
  /** Nom déjà signalé puis confirmé par « Créer quand même » (CA-6). */
  let nomConfirme = $state<string | null>(null);
  const nomsDeLaCompetition = $derived(
    (donneesClub?.epreuves ?? [])
      .filter(({ rattachement }) => rattachement.competitionId === saisie.competitionId)
      .map(({ nom }) => nom),
  );
  const nomPris = $derived(copie && nomDejaPris(saisie.nom, nomsDeLaCompetition));
  /** Vrai une fois la validation tentée sur un nom pris : le message et « Créer quand même » s'affichent. */
  let nomSignale = $state(false);

  /** US-049 : compétition préchoisie par le plan ; « Annuler » y revient. */
  let depart = $state<string | null>(null);
  const retour = $derived.by(() => {
    const manifestationId = competitions.find(({ id }) => id === depart)?.manifestationId;
    return manifestationId ? cheminPlanManifestation(manifestationId) : null;
  });

  function choisirCompetition(identifiant: string) {
    seule = identifiant === SEULE;
    Object.assign(saisie, rattacher($state.snapshot(saisie), seule ? '' : identifiant, manifestations, competitions));
  }

  async function enregistrer(evenement?: SubmitEvent) {
    evenement?.preventDefault();
    if (enCours || lectureSeule) return;
    // US-051 CA-6 : un nom déjà pris est signalé une fois ; « Créer quand même » valide malgré tout.
    if (nomPris && nomConfirme !== saisie.nom) {
      nomSignale = true;
      return;
    }
    enCours = true;
    erreur = null;
    try {
      const contexte = { clubId: session.compte.clubId, auteur: session.compte.email };
      const resultat =
        epreuveId === undefined && seule
          ? await creerCompetitionSeule(journal, clientCompetitions, $state.snapshot(saisie), contexte)
          : epreuveId === undefined
            ? await creerEpreuve(
                journal,
                $state.snapshot(saisie),
                contexte,
                $state.snapshot(manifestations),
                $state.snapshot(competitions),
              )
            : await modifierEpreuve(
                journal,
                epreuveId,
                $state.snapshot(saisie),
                contexte,
                $state.snapshot(manifestations),
                $state.snapshot(competitions),
              );
      if (resultat.ok) {
        const identifiant = 'epreuveId' in resultat ? resultat.epreuveId : epreuveId!;
        // US-022 : envoi après l'écriture ; hors ligne, l’épreuve attend le retour du réseau.
        void synchronisation.envoyer(identifiant);
        naviguer(cheminEpreuve(identifiant));
      } else if ('erreurs' in resultat) {
        erreurs = resultat.erreurs;
      } else {
        erreurs = {};
        erreur = resultat.erreur;
      }
    } finally {
      enCours = false;
    }
  }

  /** US-025 CA-4 et US-024 CA-4 : les messages qui citent les dates de la manifestation ou l'arme de la compétition. */
  function texteErreur(code: keyof typeof t.champs): string {
    if (code === 'DATE_HORS_MANIFESTATION' && cadre?.manifestation) {
      return t.dateHorsManifestation(cadre.manifestation.debut, cadre.manifestation.fin);
    }
    if (code === 'ARME_DIFFERENTE_COMPETITION' && cadre?.arme) return t.competitionAu(cadre.arme);
    return t.champs[code];
  }

  /** Attributs d'accessibilité d'un champ, et identifiant de son message d'erreur. */
  const invalide = (champ: keyof ErreursEpreuve) => ({
    'aria-invalid': erreurs[champ] ? ('true' as const) : undefined,
    'aria-describedby': erreurs[champ] ? `erreur-${champ}` : undefined,
  });
</script>

{#snippet message(champ: keyof ErreursEpreuve)}
  {@const code = erreurs[champ]}
  {#if code}<span class="erreur" id="erreur-{champ}">{texteErreur(code)}</span>{/if}
{/snippet}

<main>
  <h1>{modification ? t.titreModification : t.titreNouvelle}</h1>

  {#if !chargee}
    <p role="status">{t.chargement}</p>
  {:else if introuvable}
    <p class="message" role="alert">{t.introuvable}</p>
  {:else}
    {#if modification && !pilote}
      <p class="avertissement" role="status">{t.lectureSeule}</p>
    {:else if modification && !ecriture}
      <p class="avertissement" role="status">{t.autreOnglet}</p>
    {/if}

    <form onsubmit={enregistrer} novalidate>
      <div class="champ">
        <label for="competition">{t.competition}</label>
        <select
          id="competition"
          value={seule ? SEULE : saisie.competitionId}
          onchange={(evenement) => choisirCompetition(evenement.currentTarget.value)}
          disabled={inactif('rattachement')}
          {...invalide('rattachement')}
        >
          <option value="">{t.choisirCompetition}</option>
          {#if !modification}
            <!-- US-045 CA-4 : créer une compétition exige le réseau ; hors ligne, le choix est grisé. -->
            <option value={SEULE} disabled={!enLigne}
              >{enLigne ? t.nouvelleCompetitionSeule : t.nouvelleCompetitionSeuleHorsLigne}</option
            >
          {/if}
          {#each choix as { competition, manifestation } (competition.id)}
            <option value={competition.id}
              >{competition.nom}{manifestation ? ` — ${manifestation}` : ` (${t.seule})`}</option
            >
          {/each}
        </select>
        {@render message('rattachement')}
      </div>

      <div class="champ">
        <label for="nom">{seule ? t.nomCompetitionSeule : t.nom}</label>
        <input
          id="nom"
          type="text"
          placeholder={t.exempleNom}
          bind:value={saisie.nom}
          disabled={inactif('nom')}
          {...invalide('nom')}
        />
        {@render message('nom')}
      </div>

      <div class="ligne">
        <div class="champ">
          <label for="arme">{t.arme}</label>
          <select id="arme" bind:value={saisie.arme} disabled={inactif('arme')} {...invalide('arme')}>
            <option value="" disabled>{t.choisirArme}</option>
            {#each ARMES as arme (arme)}<option value={arme}>{t.armes[arme]}</option>{/each}
          </select>
          {@render message('arme')}
        </div>
        <div class="champ">
          <label for="type">{t.type}</label>
          <select
            id="type"
            bind:value={saisie.typeEpreuve}
            disabled={inactif('typeEpreuve')}
            {...invalide('typeEpreuve')}
          >
            {#each TYPES_EPREUVE as type (type)}<option value={type}>{t.types[type]}</option>{/each}
          </select>
          {@render message('typeEpreuve')}
        </div>
      </div>

      <div class="ligne">
        <div class="champ">
          <label for="categorie">{t.categorie} <small>({t.facultatif})</small></label>
          <select
            id="categorie"
            bind:value={saisie.categorie}
            disabled={inactif('categorie')}
            {...invalide('categorie')}
          >
            <option value="">{t.aucuneCategorie}</option>
            {#each CATEGORIES as categorie (categorie)}<option value={categorie}>{categorie}</option>{/each}
            <option value={CATEGORIE_LIBRE}>{t.categorieLibre}</option>
          </select>
          {#if saisie.categorie === CATEGORIE_LIBRE}
            <input
              type="text"
              aria-label={t.categorieLibreChamp}
              bind:value={saisie.categorieLibre}
              disabled={inactif('categorie')}
              {...invalide('categorie')}
            />
          {/if}
          {@render message('categorie')}
        </div>
        <div class="champ">
          <label for="sexe">{t.sexe} <small>({t.facultatif})</small></label>
          <select id="sexe" bind:value={saisie.sexe} disabled={inactif('sexe')} {...invalide('sexe')}>
            <option value="">{t.aucunSexe}</option>
            {#each SEXES as sexe (sexe)}<option value={sexe}>{t.sexes[sexe]}</option>{/each}
          </select>
          {@render message('sexe')}
        </div>
      </div>

      <div class="champ">
        <label for="date"
          >{t.date}
          {#if !cadre?.manifestation}<small>({t.facultatif})</small>{/if}</label
        >
        <input
          id="date"
          type="date"
          min={cadre?.manifestation?.debut}
          max={cadre?.manifestation?.fin}
          bind:value={saisie.date}
          disabled={inactif('date')}
          {...invalide('date')}
        />
        {#if cadre?.manifestation}
          <!-- US-025 CA-4 : dans une manifestation, la date est proposée parmi ses jours. -->
          <div class="jours" role="group" aria-label={t.choisirDate}>
            {#each joursDeManifestation(cadre.manifestation.debut, cadre.manifestation.fin) as jour (jour)}
              <button
                type="button"
                class="jour"
                aria-pressed={saisie.date === jour}
                onclick={() => (saisie.date = jour)}
                disabled={inactif('date')}>{t.dateLongue(jour)}</button
              >
            {/each}
          </div>
        {/if}
        {@render message('date')}
      </div>

      <fieldset>
        <legend>{t.horaires} <small>({t.facultatif})</small></legend>
        <div class="ligne horaires">
          {#each ['appel', 'scratch', 'debutPoules'] as const as champ (champ)}
            <div class="champ">
              <label for={champ}>{t[champ]}</label>
              <input
                id={champ}
                type="time"
                bind:value={saisie[champ]}
                disabled={inactif('horaires')}
                {...invalide(champ)}
              />
              {@render message(champ)}
            </div>
          {/each}
        </div>
      </fieldset>

      <div class="champ">
        <label for="lieu">{t.lieu} <small>({t.facultatif})</small></label>
        <input id="lieu" type="text" bind:value={saisie.lieu} disabled={inactif('lieu')} {...invalide('lieu')} />
        {@render message('lieu')}
      </div>

      <div class="champ">
        <label for="commentaire">{t.commentaire} <small>({t.facultatif})</small></label>
        <textarea
          id="commentaire"
          rows="3"
          bind:value={saisie.commentaire}
          disabled={inactif('commentaire')}
          {...invalide('commentaire')}></textarea>
        {@render message('commentaire')}
      </div>

      {#if erreur}<p class="message" role="alert">{t.erreurs[erreur]}</p>{/if}
      {#if nomSignale && nomPris && nomConfirme !== saisie.nom}
        <p class="message" role="alert">{t.nomDejaPris}</p>
        <button
          type="button"
          class="secondaire"
          disabled={enCours}
          onclick={() => {
            nomConfirme = saisie.nom;
            void enregistrer();
          }}>{t.creerQuandMeme}</button
        >
      {/if}
      {#if !lectureSeule}
        <button type="submit" disabled={enCours}
          >{modification ? (enCours ? t.enregistrement : t.enregistrer) : enCours ? t.enCours : t.creer}</button
        >
      {/if}
    </form>
  {/if}

  <Lien chemin={epreuveId === undefined ? (retour ?? CHEMINS.organisateur) : cheminEpreuve(epreuveId)} {naviguer}
    >{t.annuler}</Lien
  >
</main>

<style>
  main {
    display: grid;
    justify-items: center;
    gap: 1.25rem;
    padding: 3rem 1rem;
  }

  h1 {
    margin: 0;
    text-align: center;
  }

  form {
    display: grid;
    gap: 1.1rem;
    width: min(100%, 32rem);
  }

  .ligne {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 1rem;
  }

  .champ {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    gap: 0.3rem;
  }

  label,
  legend {
    font-weight: 600;
  }

  small {
    color: var(--texte-discret);
    font-weight: 400;
  }

  input,
  select,
  textarea {
    max-width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte);
    font: inherit;
  }

  textarea {
    resize: vertical;
  }

  [aria-invalid='true'] {
    border-color: var(--etat-erreur);
  }

  .erreur {
    color: var(--etat-erreur);
    font-size: 0.85rem;
  }

  fieldset {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    border: none;
  }

  .jours {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  button.jour {
    padding: 0.4rem 0.7rem;
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
    font-weight: 400;
  }

  button.jour[aria-pressed='true'] {
    border-color: var(--accent);
    font-weight: 600;
  }

  .horaires label {
    font-weight: 400;
  }

  button {
    padding: 0.7rem;
    border: none;
    border-radius: var(--rayon);
    background: var(--accent-fond);
    color: var(--sur-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .message,
  .avertissement {
    margin: 0;
    padding: 0.6rem 0.75rem;
    border-left: 4px solid var(--etat-erreur);
    background: var(--surface);
  }

  .avertissement {
    border-left-color: var(--etat-attente);
  }
</style>
