<script lang="ts">
  // Manifestations du club (US-023), page réservée à tout compte : liste, création, modification et suppression d'une
  // manifestation vide. Ce sont des données du club stockées par le serveur : hors ligne, la dernière liste reste
  // consultable avec sa date, et les actions sont grisées. La liste sera intégrée à l'accueil par US-026.
  import { onMount } from 'svelte';
  import type { EpreuveRattachee, ErreursManifestation } from '@poule-position/domaine';
  import type { Competition, Manifestation } from '@poule-position/protocole';
  import Competitions from '../composants/Competitions.svelte';
  import FichiersJoints from '../composants/FichiersJoints.svelte';
  import Lien from '../composants/Lien.svelte';
  import { nomConfirme } from '../lib/suppression';
  import type { ClientCompetitions } from '../lib/competitions';
  import type { ClientFichiers } from '../lib/fichiers';
  import {
    saisieDe,
    saisieVide,
    type ClientManifestations,
    type ErreurManifestations,
    type SaisieManifestation,
  } from '../lib/manifestations';
  import { CHEMINS, cheminPlanManifestation, ouvertureManifestations } from '../lib/routes';
  import { textes } from '../lib/textes';

  interface Proprietes {
    client: ClientManifestations;
    /** US-024 : compétitions, affichées sous leur manifestation. */
    clientCompetitions: ClientCompetitions;
    /** US-030 : affiche et feuille de route d'une manifestation et de ses compétitions. */
    fichiers: ClientFichiers;
    /** US-041 : vrai pour un administrateur (suppression d'une compétition avec son contenu). */
    administrateur?: boolean;
    /** US-041 : épreuves connues de cet appareil, pour annoncer combien partent avec une compétition. */
    epreuvesConnues?: () => Promise<EpreuveRattachee[]>;
    /** US-041 : efface les copies locales des épreuves supprimées (lit l'index du club). */
    apresSuppressionContenu?: () => Promise<void>;
    naviguer: (chemin: string) => void;
  }

  let {
    client,
    clientCompetitions,
    fichiers,
    naviguer,
    administrateur = false,
    epreuvesConnues = async () => [],
    apresSuppressionContenu = async () => {},
  }: Proprietes = $props();

  const t = textes.manifestations;

  let manifestations: Manifestation[] | null = $state(null);
  /** Date de la copie affichée hors ligne ; null pour une liste à jour. */
  let copieLe: number | null = $state(null);
  let competitions: Competition[] = $state([]);
  let erreurListe: ErreurManifestations | null = $state(null);
  let horsLigne = $state(!navigator.onLine);

  /** Formulaire ouvert : création (`nouvelle`), modification d'une manifestation, ou aucun. */
  let edition: Manifestation | 'nouvelle' | null = $state(null);
  let saisie: SaisieManifestation = $state(saisieVide());
  let erreurs: ErreursManifestation = $state({});
  /** Message global du formulaire (épreuves hors dates, modification concurrente, réseau…). */
  let message: string | null = $state(null);
  /** Vrai si le message annonce une modification concurrente : « Recharger » l'accompagne. */
  let concurrente = $state(false);
  let enCours = $state(false);

  /** Manifestation dont la suppression attend confirmation. */
  let aSupprimer: Manifestation | null = $state(null);
  let erreurSuppression: ErreurManifestations | null = $state(null);

  /** US-024 : compétitions du club, ou leur dernière copie gardée sur l'appareil. */
  async function chargerCompetitions() {
    const resultat = await clientCompetitions.lister();
    competitions = resultat.ok ? resultat.competitions : (resultat.copie?.competitions ?? competitions);
  }

  /** US-049 : « Modifier la manifestation » du plan ouvre le formulaire de la manifestation, une fois la liste lue. */
  let modificationDemandee = true;
  function ouvrirModificationDemandee() {
    if (!modificationDemandee || !ouverture || !('modifier' in ouverture)) return;
    modificationDemandee = false;
    const cible = manifestations?.find(({ id }) => id === ouverture.modifier);
    if (cible) ouvrir(cible);
  }

  async function charger() {
    void chargerCompetitions();
    const resultat = await client.lister();
    if (resultat.ok) {
      manifestations = resultat.manifestations;
      copieLe = null;
      erreurListe = null;
      ouvrirModificationDemandee();
      return;
    }
    manifestations = resultat.copie?.manifestations ?? manifestations ?? [];
    copieLe = resultat.copie?.copieLe ?? null;
    erreurListe = resultat.erreur === 'HORS_LIGNE' ? null : resultat.erreur;
    ouvrirModificationDemandee();
  }

  /** US-026 CA-5 : formulaire demandé par l'adresse (« ?nouvelle » ou « ?competition=<id> » depuis l'accueil). */
  const ouverture = ouvertureManifestations(location.search);

  onMount(() => {
    if (ouverture && 'nouvelle' in ouverture) ouvrir('nouvelle');
    const surReseau = () => {
      horsLigne = !navigator.onLine;
      if (!horsLigne) void charger();
    };
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    void charger();
    return () => {
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
    };
  });

  function ouvrir(cible: Manifestation | 'nouvelle') {
    edition = cible;
    saisie = cible === 'nouvelle' ? saisieVide() : saisieDe(cible);
    erreurs = {};
    message = null;
    concurrente = false;
    aSupprimer = null;
  }

  function fermer() {
    edition = null;
    erreurs = {};
    message = null;
    concurrente = false;
  }

  async function enregistrer(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (enCours || edition === null) return;
    enCours = true;
    message = null;
    concurrente = false;
    try {
      const donnees = $state.snapshot(saisie);
      const resultat = edition === 'nouvelle' ? await client.creer(donnees) : await client.modifier(edition, donnees);
      if (resultat.ok) {
        fermer();
        await charger();
      } else if ('erreurs' in resultat) {
        erreurs = resultat.erreurs;
      } else {
        erreurs = {};
        if (resultat.erreur === 'EPREUVES_HORS_DATES') {
          message = t.horsDates(resultat.epreuves.map(({ nom }) => nom));
        } else if (resultat.erreur === 'MODIFIEE_ENTRE_TEMPS') {
          message = t.modifieeEntreTemps(resultat.manifestation.modifieePar);
          concurrente = true;
        } else {
          message = t.erreurs[resultat.erreur];
        }
      }
    } finally {
      enCours = false;
    }
  }

  async function recharger() {
    const ouverte = edition;
    await charger();
    const aJour = ouverte !== 'nouvelle' && manifestations?.find(({ id }) => id === ouverte?.id);
    if (aJour) ouvrir(aJour);
  }

  async function supprimer() {
    if (!aSupprimer || enCours) return;
    enCours = true;
    erreurSuppression = null;
    try {
      const resultat = await client.supprimer(aSupprimer.id);
      if (resultat.ok) {
        aSupprimer = null;
        await charger();
      } else {
        erreurSuppression = resultat.erreur;
      }
    } finally {
      enCours = false;
    }
  }

  /** US-042 et US-057 : suppression d'une manifestation non vide, avec son contenu, réservée aux administrateurs. */
  const tc = t.contenu;
  let contenuASupprimer: Manifestation | null = $state(null);
  let nombreEpreuves: number | null = $state(null);
  let saisieNom = $state('');
  let progression: { faites: number; total: number } | null = $state(null);
  let messageContenu: string | null = $state(null);

  /** US-057 : épreuves de chaque compétition, lues une seule fois par chargement ; inutile pour un administrateur. */
  let nombresEpreuves: Record<string, number> | null = $state(null);

  $effect(() => {
    if (administrateur || competitions.length === 0) return;
    void epreuvesConnues().then((liste) => {
      const nombres: Record<string, number> = {};
      for (const { rattachement } of liste) {
        if (rattachement) nombres[rattachement.competitionId] = (nombres[rattachement.competitionId] ?? 0) + 1;
      }
      nombresEpreuves = nombres;
    });
  });

  const contientDesCompetitions = (manifestationId: string) =>
    competitions.some((competition) => competition.manifestationId === manifestationId);

  /** US-057 : une manifestation vide se confirme simplement ; sinon, la confirmation annonce son contenu et exige son nom. */
  function demanderSuppression(manifestation: Manifestation) {
    if (contientDesCompetitions(manifestation.id)) {
      void demanderContenu(manifestation);
    } else {
      aSupprimer = manifestation;
      erreurSuppression = null;
    }
  }

  async function demanderContenu(manifestation: Manifestation) {
    contenuASupprimer = manifestation;
    saisieNom = '';
    messageContenu = null;
    nombreEpreuves = null;
    // US-045 : les épreuves de la manifestation sont celles de ses compétitions.
    const siennes = new Set(
      competitions.filter(({ manifestationId }) => manifestationId === manifestation.id).map(({ id }) => id),
    );
    nombreEpreuves = (await epreuvesConnues()).filter(
      ({ rattachement }) => rattachement && siennes.has(rattachement.competitionId),
    ).length;
  }

  /** CA-1, CA-5 et CA-6 : supprime la manifestation, ses compétitions et ses épreuves, morceau par morceau. */
  async function supprimerContenu() {
    if (!contenuASupprimer || enCours || !nomConfirme(saisieNom, contenuASupprimer.nom)) return;
    enCours = true;
    messageContenu = null;
    try {
      const resultat = await client.supprimerAvecContenu(contenuASupprimer.id, (faites, total) => {
        progression = { faites, total };
      });
      if (resultat.ok) {
        contenuASupprimer = null;
      } else if (resultat.erreur === 'EPREUVE_EN_COURS' && resultat.enCours) {
        messageContenu = tc.enCours(resultat.enCours);
      } else if (resultat.supprimees > 0 && resultat.restantes > 0) {
        messageContenu = tc.interrompue(resultat.restantes);
      } else {
        messageContenu = t.erreurs[resultat.erreur];
      }
      await charger();
      await apresSuppressionContenu();
    } finally {
      progression = null;
      enCours = false;
    }
  }

  /** Attributs d'accessibilité d'un champ, et identifiant de son message d'erreur. */
  const invalide = (champ: keyof ErreursManifestation) => ({
    'aria-invalid': erreurs[champ] ? ('true' as const) : undefined,
    'aria-describedby': erreurs[champ] ? `erreur-${champ}` : undefined,
  });
</script>

{#snippet erreurChamp(champ: keyof ErreursManifestation)}
  {@const code = erreurs[champ]}
  {#if code}<span class="erreur" id="erreur-{champ}">{t.champs[code]}</span>{/if}
{/snippet}

<main>
  <h1>{t.titre}</h1>

  {#if horsLigne}
    <p class="avertissement" role="status">
      {copieLe !== null ? t.listeDu(copieLe) : t.horsLigne}
    </p>
  {/if}
  {#if erreurListe}<p class="message" role="alert">{t.erreurs[erreurListe]}</p>{/if}

  {#if edition === null}
    <button type="button" onclick={() => ouvrir('nouvelle')} disabled={horsLigne}>
      {t.nouvelle}
      {#if horsLigne}<small>{t.horsLigne}</small>{/if}
    </button>
  {:else}
    <form onsubmit={enregistrer} novalidate>
      <h2>{edition === 'nouvelle' ? t.nouvelle : t.titreModification(edition.nom)}</h2>
      <div class="champ">
        <label for="nom">{t.nom}</label>
        <input
          id="nom"
          type="text"
          placeholder={t.exempleNom}
          bind:value={saisie.nom}
          disabled={enCours}
          {...invalide('nom')}
        />
        {@render erreurChamp('nom')}
      </div>
      <div class="ligne">
        <div class="champ">
          <label for="debut">{t.debut}</label>
          <input id="debut" type="date" bind:value={saisie.debut} disabled={enCours} {...invalide('debut')} />
          {@render erreurChamp('debut')}
        </div>
        <div class="champ">
          <label for="fin">{t.fin}</label>
          <input id="fin" type="date" bind:value={saisie.fin} disabled={enCours} {...invalide('fin')} />
          {@render erreurChamp('fin')}
        </div>
      </div>
      <div class="champ">
        <label for="lieu">{t.lieu} <small>({t.facultatif})</small></label>
        <input id="lieu" type="text" bind:value={saisie.lieu} disabled={enCours} {...invalide('lieu')} />
        {@render erreurChamp('lieu')}
      </div>
      <div class="champ">
        <label for="commentaire">{t.commentaire} <small>({t.facultatif})</small></label>
        <textarea
          id="commentaire"
          rows="3"
          bind:value={saisie.commentaire}
          disabled={enCours}
          {...invalide('commentaire')}></textarea>
        {@render erreurChamp('commentaire')}
      </div>

      {#if edition !== 'nouvelle'}
        <FichiersJoints client={fichiers} chaine={[{ proprietaire: 'manifestation', id: edition.id }]} />
      {/if}

      {#if message}
        <p class="message" role="alert">
          {message}
          {#if concurrente}
            <button type="button" class="lien" onclick={recharger}>{t.recharger}</button>
          {/if}
        </p>
      {/if}
      {#if horsLigne}<p class="avertissement" role="status">{t.horsLigne}</p>{/if}
      <div class="boutons">
        <button type="submit" disabled={enCours || horsLigne}>
          {enCours ? t.enCours : edition === 'nouvelle' ? t.creer : t.enregistrer}
        </button>
        <button type="button" class="secondaire" onclick={fermer} disabled={enCours}>{t.annuler}</button>
      </div>
    </form>
  {/if}

  {#if manifestations === null}
    <p role="status">{t.chargement}</p>
  {:else if manifestations.length === 0}
    <p class="vide">{t.vide}</p>
  {:else}
    <ul class="liste">
      {#each manifestations as manifestation (manifestation.id)}
        <li>
          <div class="infos">
            <strong>{manifestation.nom}</strong>
            <Lien
              chemin={cheminPlanManifestation(manifestation.id)}
              {naviguer}
              etiquette={textes.plan.lienPour(manifestation.nom)}>{textes.plan.lien}</Lien
            >
            <span>{t.periode(manifestation.debut, manifestation.fin)}</span>
            {#if manifestation.lieu}<span>{manifestation.lieu}</span>{/if}
            {#if manifestation.commentaire}<span class="commentaire">{manifestation.commentaire}</span>{/if}
          </div>
          <Competitions
            {manifestation}
            client={clientCompetitions}
            {fichiers}
            competitions={competitions.filter(({ manifestationId }) => manifestationId === manifestation.id)}
            {horsLigne}
            modifie={chargerCompetitions}
            {administrateur}
            nombres={nombresEpreuves}
            nombreEpreuves={async (competitionId) =>
              (await epreuvesConnues()).filter(({ rattachement }) => rattachement?.competitionId === competitionId)
                .length}
            {apresSuppressionContenu}
            {naviguer}
            ouvrirAuDepart={ouverture !== null &&
              'competitionDe' in ouverture &&
              ouverture.competitionDe === manifestation.id}
          />
          {#if aSupprimer?.id === manifestation.id}
            <div class="confirmation" role="group" aria-label={t.supprimer(manifestation.nom)}>
              <span>{t.confirmerSuppression(manifestation.nom)}</span>
              {#if erreurSuppression}<span class="erreur" role="alert">{t.erreurs[erreurSuppression]}</span>{/if}
              <div class="boutons">
                <button type="button" class="danger" onclick={supprimer} disabled={enCours || horsLigne}>
                  {t.confirmer}
                </button>
                <button type="button" class="secondaire" onclick={() => (aSupprimer = null)} disabled={enCours}>
                  {t.annuler}
                </button>
              </div>
            </div>
          {:else if contenuASupprimer?.id === manifestation.id}
            <!-- US-042 : suppression avec son contenu, confirmée par le nom de la manifestation. -->
            <div class="confirmation" role="group" aria-label={tc.titre(manifestation.nom)}>
              <span>{tc.titre(manifestation.nom)}</span>
              <span>
                {tc.combien(
                  competitions.filter(({ manifestationId }) => manifestationId === manifestation.id).length,
                  nombreEpreuves,
                )}
              </span>
              <span class="avertissement" role="status">{tc.avertissement}</span>
              {#if messageContenu}<span class="erreur" role="alert">{messageContenu}</span>{/if}
              {#if progression}
                <span role="status">{tc.progression(progression.faites, progression.total)}</span>
              {:else}
                <label>
                  {tc.saisie(manifestation.nom)}
                  <input type="text" bind:value={saisieNom} autocomplete="off" />
                </label>
                <div class="boutons">
                  <button
                    type="button"
                    class="danger"
                    onclick={supprimerContenu}
                    disabled={enCours || horsLigne || !nomConfirme(saisieNom, manifestation.nom)}>{tc.valider}</button
                  >
                  <button type="button" class="secondaire" onclick={() => (contenuASupprimer = null)} disabled={enCours}
                    >{tc.annuler}</button
                  >
                </div>
              {/if}
            </div>
          {:else}
            <div class="boutons">
              <button
                type="button"
                class="secondaire"
                aria-label={t.modifier(manifestation.nom)}
                onclick={() => ouvrir(manifestation)}
                disabled={horsLigne}>{t.boutonModifier}</button
              >
              <!-- US-057 : un seul « Supprimer… » ; un organisateur ne le voit que pour une manifestation sans compétition. -->
              {#if administrateur || !contientDesCompetitions(manifestation.id)}
                <button
                  type="button"
                  class="secondaire"
                  aria-label={t.supprimer(manifestation.nom)}
                  onclick={() => demanderSuppression(manifestation)}
                  disabled={horsLigne}>{t.boutonSupprimer}</button
                >
                {#if horsLigne}<small>{tc.horsLigne}</small>{/if}
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <Lien chemin={CHEMINS.organisateur} {naviguer}>{textes.epreuves.retour}</Lien>
</main>

<style>
  main {
    display: grid;
    justify-items: center;
    gap: 1.25rem;
    padding: 3rem 1rem;
  }

  h1,
  h2 {
    margin: 0;
    text-align: center;
  }

  h2 {
    font-size: 1.2rem;
  }

  form,
  .liste {
    display: grid;
    gap: 1.1rem;
    width: min(100%, 36rem);
  }

  .ligne {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 1rem;
  }

  .champ {
    display: grid;
    align-content: start;
    gap: 0.3rem;
  }

  label {
    font-weight: 600;
  }

  small {
    color: var(--texte-discret);
    font-weight: 400;
  }

  input,
  textarea {
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

  button {
    display: grid;
    padding: 0.7rem 1rem;
    border: none;
    border-radius: var(--rayon);
    background: var(--accent-fond);
    color: var(--sur-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button small {
    color: inherit;
  }

  button.secondaire {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
  }

  button.danger {
    background: var(--etat-erreur);
  }

  button.lien {
    display: inline;
    padding: 0;
    background: none;
    color: var(--accent);
    text-decoration: underline;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  .liste {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .liste li {
    display: grid;
    gap: 0.6rem;
    padding: 0.9rem 1rem;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--surface);
  }

  .infos {
    display: grid;
    gap: 0.2rem;
    overflow-wrap: anywhere;
  }

  .infos span {
    color: var(--texte-discret);
  }

  .commentaire {
    white-space: pre-line;
  }

  .confirmation {
    display: grid;
    gap: 0.5rem;
  }

  .vide {
    color: var(--texte-discret);
  }

  .avertissement,
  .message {
    margin: 0;
    padding: 0.6rem 0.75rem;
    background: var(--surface);
  }

  .avertissement {
    border-left: 4px solid var(--etat-attente);
  }

  .message {
    border-left: 4px solid var(--etat-erreur);
  }
</style>
