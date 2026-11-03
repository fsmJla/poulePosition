<script lang="ts">
  // « Nouvelle compétition » (US-025), page réservée : la compétition est écrite dans le journal local, donc créée
  // aussi hors ligne ; ce PC en devient le pilote et l'envoi au serveur part aussitôt, ou au retour du réseau (US-022).
  // Le rattachement à une manifestation ou une épreuve (US-024) se choisit parmi les dernières listes du club gardées sur
  // l'appareil : hors ligne, la compétition reste créable, isolée ou rattachée à ce que la copie contient.
  // La même page sert à modifier une compétition (US-027, `competitionId` donné) : le formulaire est prérempli depuis le
  // journal local et écrit `CompetitionModifiee` ; sur un PC qui n'est pas le pilote, il est en lecture seule.
  import { onMount, untrack } from 'svelte';
  import {
    ARMES,
    CATEGORIES,
    champsModifiables,
    joursDeManifestation,
    SEXES,
    TYPES_COMPETITION,
    type ChampDonnees,
    type ErreursCompetition,
    type Statut,
  } from '@poule-position/domaine';
  import type { Epreuve, Manifestation } from '@poule-position/protocole';
  import Lien from '../composants/Lien.svelte';
  import {
    cadreDe,
    CATEGORIE_LIBRE,
    creerCompetition,
    modifierCompetition,
    rattacher,
    saisieDe,
    saisieVide,
    type ErreurCreation,
    type ErreurModification,
  } from '../lib/competitions';
  import type { ClientEpreuves } from '../lib/epreuves';
  import { prendreEcriture, type Journal } from '../lib/journal';
  import type { ClientManifestations } from '../lib/manifestations';
  import { cheminCompetition, CHEMINS } from '../lib/routes';
  import type { SessionAppareil } from '../lib/stockage';
  import type { Synchronisation } from '../lib/synchronisation';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: SessionAppareil;
    journal: Journal;
    synchronisation: Synchronisation;
    /** US-024 : listes pour le choix du rattachement. */
    clientManifestations: ClientManifestations;
    clientEpreuves: ClientEpreuves;
    naviguer: (chemin: string) => void;
    /** US-027 : compétition à modifier ; absent pour une création. */
    competitionId?: string;
  }

  let { session, journal, synchronisation, clientManifestations, clientEpreuves, naviguer, competitionId }: Proprietes =
    $props();

  const t = textes.competitions;

  const saisie = $state(saisieVide());
  let erreurs: ErreursCompetition = $state({});
  let erreur: ErreurCreation | ErreurModification | null = $state(null);
  let enCours = $state(false);

  /** US-027 : faux tant que la compétition à modifier n'est pas lue. */
  let chargee = $state(untrack(() => competitionId === undefined));
  let introuvable = $state(false);
  let statut: Statut = $state('preparation');
  let pilote = $state(true);
  /** Faux si un autre onglet détient déjà l'écriture de cette compétition. */
  let ecriture = $state(true);
  const modification = $derived(competitionId !== undefined);
  const lectureSeule = $derived(modification && (!pilote || !ecriture));

  /** CA-2, CA-3 et cas limites : un champ figé par le statut, ou tout le formulaire en lecture seule, est désactivé. */
  const inactif = (champ: ChampDonnees) =>
    enCours || lectureSeule || (modification && !champsModifiables(statut).includes(champ));

  let manifestations: Manifestation[] = $state([]);
  let epreuves: Epreuve[] = $state([]);
  const cadre = $derived(cadreDe(saisie, manifestations, epreuves));
  const epreuvesChoisies = $derived(
    epreuves.filter(({ manifestationId }) => manifestationId === saisie.manifestationId),
  );

  /** Listes du club : à jour en ligne, sinon la dernière copie de l'appareil. */
  onMount(() => {
    let liberer: (() => void) | null = null;
    let demonte = false;
    if (competitionId !== undefined) {
      const identifiant = competitionId;
      void (async () => {
        const { competition } = await journal.lire(identifiant);
        if (competition) {
          Object.assign(saisie, saisieDe(competition));
          statut = competition.statut;
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
      const [lues, lus] = await Promise.all([clientManifestations.lister(), clientEpreuves.lister()]);
      manifestations = lues.ok ? lues.manifestations : (lues.copie?.manifestations ?? []);
      epreuves = lus.ok ? lus.epreuves : (lus.copie?.epreuves ?? []);
    })();
    return () => {
      demonte = true;
      liberer?.();
    };
  });

  function choisirManifestation(identifiant: string) {
    Object.assign(saisie, rattacher($state.snapshot(saisie), identifiant, '', manifestations, epreuves));
  }

  function choisirEpreuve(identifiant: string) {
    Object.assign(
      saisie,
      rattacher($state.snapshot(saisie), saisie.manifestationId, identifiant, manifestations, epreuves),
    );
  }

  async function enregistrer(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (enCours || lectureSeule) return;
    enCours = true;
    erreur = null;
    try {
      const contexte = { clubId: session.compte.clubId, auteur: session.compte.email };
      const resultat =
        competitionId === undefined
          ? await creerCompetition(
              journal,
              $state.snapshot(saisie),
              contexte,
              $state.snapshot(manifestations),
              $state.snapshot(epreuves),
            )
          : await modifierCompetition(
              journal,
              competitionId,
              $state.snapshot(saisie),
              contexte,
              $state.snapshot(manifestations),
              $state.snapshot(epreuves),
            );
      if (resultat.ok) {
        const identifiant = 'competitionId' in resultat ? resultat.competitionId : competitionId!;
        // US-022 : envoi après l'écriture ; hors ligne, la compétition attend le retour du réseau.
        void synchronisation.envoyer(identifiant);
        naviguer(cheminCompetition(identifiant));
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

  /** US-025 CA-4 et US-024 CA-4 : les messages qui citent les dates de la manifestation ou l'arme de l'épreuve. */
  function texteErreur(code: keyof typeof t.champs): string {
    if (code === 'DATE_HORS_MANIFESTATION' && cadre) {
      return t.dateHorsManifestation(cadre.manifestation.debut, cadre.manifestation.fin);
    }
    if (code === 'ARME_DIFFERENTE_EPREUVE' && cadre?.epreuve) return t.epreuveAu(cadre.epreuve.arme);
    return t.champs[code];
  }

  /** Attributs d'accessibilité d'un champ, et identifiant de son message d'erreur. */
  const invalide = (champ: keyof ErreursCompetition) => ({
    'aria-invalid': erreurs[champ] ? ('true' as const) : undefined,
    'aria-describedby': erreurs[champ] ? `erreur-${champ}` : undefined,
  });
</script>

{#snippet message(champ: keyof ErreursCompetition)}
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
      <fieldset class="rattachement">
        <legend>{t.rattachement} <small>({t.facultatif})</small></legend>
        <div class="ligne">
          <div class="champ">
            <label for="manifestation">{t.manifestation}</label>
            <select
              id="manifestation"
              value={saisie.manifestationId}
              onchange={(evenement) => choisirManifestation(evenement.currentTarget.value)}
              disabled={inactif('rattachement')}
              {...invalide('rattachement')}
            >
              <option value="">{t.aucuneManifestation}</option>
              {#each manifestations as manifestation (manifestation.id)}
                <option value={manifestation.id}>{manifestation.nom}</option>
              {/each}
            </select>
            {@render message('rattachement')}
          </div>
          {#if saisie.manifestationId}
            <div class="champ">
              <label for="epreuve">{t.epreuve}</label>
              <select
                id="epreuve"
                value={saisie.epreuveId}
                onchange={(evenement) => choisirEpreuve(evenement.currentTarget.value)}
                disabled={inactif('rattachement')}
              >
                <option value="">{t.aucuneEpreuve}</option>
                {#each epreuvesChoisies as epreuve (epreuve.id)}
                  <option value={epreuve.id}>{epreuve.nom}</option>
                {/each}
              </select>
            </div>
          {/if}
        </div>
      </fieldset>

      <div class="champ">
        <label for="nom">{t.nom}</label>
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
            bind:value={saisie.typeCompetition}
            disabled={inactif('typeCompetition')}
            {...invalide('typeCompetition')}
          >
            {#each TYPES_COMPETITION as type (type)}<option value={type}>{t.types[type]}</option>{/each}
          </select>
          {@render message('typeCompetition')}
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
          {#if !cadre}<small>({t.facultatif})</small>{/if}</label
        >
        <input
          id="date"
          type="date"
          min={cadre?.manifestation.debut}
          max={cadre?.manifestation.fin}
          bind:value={saisie.date}
          disabled={inactif('date')}
          {...invalide('date')}
        />
        {#if cadre}
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
      {#if !lectureSeule}
        <button type="submit" disabled={enCours}
          >{modification ? (enCours ? t.enregistrement : t.enregistrer) : enCours ? t.enCours : t.creer}</button
        >
      {/if}
    </form>
  {/if}

  <Lien chemin={competitionId === undefined ? CHEMINS.organisateur : cheminCompetition(competitionId)} {naviguer}
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
