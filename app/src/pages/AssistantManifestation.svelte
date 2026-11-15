<script lang="ts">
  // Assistant de manifestation (US-047), page réservée : crée pas à pas une manifestation, ses compétitions puis leurs
  // épreuves, pendant qu'un aperçu se remplit à côté. Chaque étape validée est enregistrée (la manifestation et les
  // compétitions sur le serveur, donc en ligne ; les épreuves dans le journal local, donc aussi hors ligne) : quitter
  // l'assistant ne perd rien, et ce qui est créé se complète depuis le plan. L'assistant enchaîne les écrans existants
  // (clients d'US-023 et d'US-024, grille d'US-048, plan d'US-049) ; les étapes et l'aperçu sont calculés par le domaine.
  import { onMount } from 'svelte';
  import {
    apercuAssistant,
    ARMES,
    bilanAssistant,
    construireListePlan,
    ETAPES_ASSISTANT,
    etapePrecedente,
    etapeSuivante,
    peutPasserPlusTard,
    statutsEtapes,
    type Arme,
    type ErreursCompetition,
    type ErreursManifestation,
    type EtapeAssistant,
  } from '@poule-position/domaine';
  import type { Competition, Manifestation } from '@poule-position/protocole';
  import PlanLecture from '../composants/PlanLecture.svelte';
  import type { Accueil, DonneesAccueil } from '../lib/accueil';
  import {
    saisieDe as saisieDeCompetition,
    saisieVide as saisieVideCompetition,
    type ClientCompetitions,
    type ResultatEnregistrementCompetition,
    type SaisieCompetition,
  } from '../lib/competitions';
  import type { Journal } from '../lib/journal';
  import {
    saisieDe as saisieDeManifestation,
    saisieVide as saisieVideManifestation,
    type ClientManifestations,
    type ResultatEnregistrement,
    type SaisieManifestation,
  } from '../lib/manifestations';
  import { cheminPlanManifestation } from '../lib/routes';
  import type { SessionAppareil } from '../lib/stockage';
  import type { Synchronisation } from '../lib/synchronisation';
  import { textes } from '../lib/textes';
  import ChampLieu from '../composants/ChampLieu.svelte';
  import GrilleEpreuves from './GrilleEpreuves.svelte';

  interface Proprietes {
    session: SessionAppareil;
    journal: Journal;
    synchronisation: Synchronisation;
    accueil: Accueil;
    clientManifestations: ClientManifestations;
    clientCompetitions: ClientCompetitions;
    naviguer: (chemin: string) => void;
  }

  let { session, journal, synchronisation, accueil, clientManifestations, clientCompetitions, naviguer }: Proprietes =
    $props();

  const a = textes.assistant;
  const tm = textes.manifestations;
  const tc = textes.competitions;
  const te = textes.epreuves;

  let etape = $state<EtapeAssistant>('manifestation');
  let enLigne = $state(navigator.onLine);
  let enCours = $state(false);

  // Étape 1 : la manifestation, créée à « Suivant » puis modifiée si on revient dessus.
  let manifestation = $state<Manifestation | null>(null);
  let saisie = $state<SaisieManifestation>(saisieVideManifestation());
  let erreurs = $state<ErreursManifestation>({});
  let message = $state<string | null>(null);

  // Étape 2 : les compétitions créées, et le formulaire de la suivante (ou de la modification d'une d'elles).
  let competitions = $state<Competition[]>([]);
  let saisieCompetition = $state<SaisieCompetition>(saisieVideCompetition());
  let editionCompetition = $state<Competition | null>(null);
  let erreursCompetition = $state<ErreursCompetition>({});
  let messageCompetition = $state<string | null>(null);
  let confirmation = $state<string | null>(null);

  // Étape 3 : la compétition dont on coche les épreuves ; la version force la grille à repartir d'une grille vide.
  let competitionGrille = $state('');
  let versionGrille = $state(0);
  let donnees = $state<DonneesAccueil | null>(null);

  onMount(() => {
    const surReseau = () => (enLigne = navigator.onLine);
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    return () => {
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
    };
  });

  /** Épreuves non archivées de chaque compétition, d'après la liste du club (index, copies et journal local). */
  const epreuvesParCompetition = $derived.by(() => {
    const compte: Record<string, number> = {};
    for (const { statut, rattachement } of donnees?.epreuves ?? []) {
      if (statut === 'archivee') continue;
      compte[rattachement.competitionId] = (compte[rattachement.competitionId] ?? 0) + 1;
    }
    return compte;
  });
  const bilan = $derived(bilanAssistant(competitions, epreuvesParCompetition));
  const statuts = $derived(statutsEtapes(etape));

  /** CA-2 : à la première étape l'aperçu suit la saisie ; ensuite, c'est la manifestation créée. */
  const cadre = $derived.by(() => {
    if (etape === 'manifestation') {
      const nom = saisie.nom.trim();
      return nom ? { nom, debut: saisie.debut, fin: saisie.fin, lieu: saisie.lieu.trim() || null } : null;
    }
    return manifestation
      ? { nom: manifestation.nom, debut: manifestation.debut, fin: manifestation.fin, lieu: manifestation.lieu }
      : null;
  });
  const apercu = $derived(
    apercuAssistant({
      manifestation: cadre,
      competitions: competitions.map(({ id, nom }) => ({ id, nom })),
      epreuvesParCompetition,
      enSaisie:
        etape === 'competitions' && editionCompetition === null && saisieCompetition.nom.trim()
          ? { nom: saisieCompetition.nom.trim() }
          : null,
    }),
  );

  /** CA-5 : le plan de ce que l'assistant a créé, avec les épreuves de la liste du club. */
  const plan = $derived.by(() => {
    if (!manifestation) return null;
    const { id, nom, debut, fin, lieu } = manifestation;
    return construireListePlan(
      {
        manifestations: [{ id, nom, debut, fin, lieu }],
        competitions: competitions.map((c) => ({ id: c.id, manifestationId: id, nom: c.nom, arme: c.arme })),
        epreuves: (donnees?.epreuves ?? []).filter(({ rattachement }) =>
          competitions.some(({ id: competitionId }) => competitionId === rattachement.competitionId),
        ),
      },
      id,
    );
  });

  async function charger() {
    donnees = await accueil.charger();
  }

  /**
   * Hors ligne, les étapes Épreuves et Vérifier lisent les copies de l'appareil : on les remet à jour à chaque création, tant
   * que le réseau est là, pour qu'elles contiennent la manifestation et les compétitions qu'on vient de créer.
   */
  function garderCopies() {
    void clientManifestations.lister();
    void clientCompetitions.lister();
  }

  function aller(cible: EtapeAssistant) {
    etape = cible;
    message = null;
    confirmation = null;
    if (cible === 'epreuves') {
      if (!competitions.some(({ id }) => id === competitionGrille)) competitionGrille = competitions[0]?.id ?? '';
    }
    if (cible === 'epreuves' || cible === 'verifier') void charger();
  }

  /** CA-3 : la manifestation est créée en passant à l'étape suivante ; CA-6 : modifiée si on est revenu dessus. */
  async function validerManifestation(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (enCours) return;
    enCours = true;
    message = null;
    erreurs = {};
    try {
      const donneesSaisie = $state.snapshot(saisie);
      let resultat: ResultatEnregistrement;
      if (manifestation === null) resultat = await clientManifestations.creer(donneesSaisie);
      else if (JSON.stringify(saisieDeManifestation(manifestation)) === JSON.stringify(donneesSaisie)) {
        resultat = { ok: true, manifestation };
      } else resultat = await clientManifestations.modifier($state.snapshot(manifestation), donneesSaisie);
      if (resultat.ok) {
        manifestation = resultat.manifestation;
        saisie = saisieDeManifestation(resultat.manifestation);
        garderCopies();
        aller('competitions');
      } else if ('erreurs' in resultat) erreurs = resultat.erreurs;
      else if (resultat.erreur === 'EPREUVES_HORS_DATES')
        message = tm.horsDates(resultat.epreuves.map(({ nom }) => nom));
      else if (resultat.erreur === 'MODIFIEE_ENTRE_TEMPS')
        message = tm.modifieeEntreTemps(resultat.manifestation.modifieePar);
      else message = tm.erreurs[resultat.erreur];
    } finally {
      enCours = false;
    }
  }

  /** CA-3 : chaque compétition ajoutée à l'étape 2 est créée aussitôt ; CA-6 : « Modifier » en change le nom ou l'arme. */
  async function enregistrerCompetition(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (enCours || !manifestation) return;
    enCours = true;
    messageCompetition = null;
    confirmation = null;
    erreursCompetition = {};
    try {
      const donneesSaisie = $state.snapshot(saisieCompetition);
      const modifiee = editionCompetition ? $state.snapshot(editionCompetition) : null;
      const resultat: ResultatEnregistrementCompetition = modifiee
        ? await clientCompetitions.modifier(modifiee, donneesSaisie)
        : await clientCompetitions.creer(manifestation.id, donneesSaisie);
      if (resultat.ok) {
        const { competition } = resultat;
        competitions = modifiee
          ? competitions.map((courante) => (courante.id === competition.id ? competition : courante))
          : [...competitions, competition];
        confirmation = a.competitionAjoutee(competition.nom);
        garderCopies();
        editionCompetition = null;
        saisieCompetition = saisieVideCompetition();
      } else if ('erreurs' in resultat) erreursCompetition = resultat.erreurs;
      else if (resultat.erreur === 'MODIFIEE_ENTRE_TEMPS') {
        messageCompetition = tc.modifieeEntreTemps(resultat.competition.modifieePar);
      } else messageCompetition = tc.erreurs[resultat.erreur];
    } finally {
      enCours = false;
    }
  }

  function modifierCompetition(competition: Competition) {
    editionCompetition = competition;
    saisieCompetition = saisieDeCompetition(competition);
    erreursCompetition = {};
    messageCompetition = null;
    confirmation = null;
  }

  function annulerModification() {
    editionCompetition = null;
    saisieCompetition = saisieVideCompetition();
    erreursCompetition = {};
    messageCompetition = null;
  }

  function choisirArme(arme: Arme | '') {
    saisieCompetition.arme = arme;
  }

  /** CA-3 : le lot d'épreuves est créé par la grille ; l'aperçu se recompte et la grille repart vide. */
  async function surLotCree() {
    versionGrille += 1;
    await charger();
  }

  const invalide = (erreur: string | undefined) => ({ 'aria-invalid': erreur ? ('true' as const) : undefined });
  const libelleEtape = (cible: EtapeAssistant) => a.etape[cible].nom;
  const rienAFaireIci = $derived(
    etape === 'competitions' ? competitions.length === 0 : etape === 'epreuves' ? bilan.epreuves === 0 : false,
  );
</script>

<main>
  <ol class="etapes" aria-label={a.etapes}>
    {#each ETAPES_ASSISTANT as cible, indice (cible)}
      <li class={statuts[cible]} aria-current={statuts[cible] === 'courante' ? 'step' : undefined}>
        <span class="pastille" aria-hidden="true">{statuts[cible] === 'faite' ? '✓' : indice + 1}</span>
        <span class="texte">
          <strong>{a.etape[cible].nom}</strong>
          <small>{a.etape[cible].aide}</small>
        </span>
      </li>
    {/each}
  </ol>

  <div class="corps">
    <section class="etape" aria-labelledby="titre-etape">
      <h1 id="titre-etape">{a.titreEtape[etape]}</h1>
      <p class="aide">{a.aideEtape[etape]}</p>
      {#if !enLigne && (etape === 'manifestation' || etape === 'competitions')}
        <p class="avertissement" role="status">
          {manifestation ? a.reseauPerdu : a.horsLigne}
        </p>
      {:else if !enLigne && manifestation}
        <p class="avertissement" role="status">{a.reseauPerdu}</p>
      {/if}

      {#if etape === 'manifestation'}
        <form onsubmit={validerManifestation} novalidate>
          <div class="champ">
            <label for="nom">{tm.nom}</label>
            <input
              id="nom"
              type="text"
              placeholder={tm.exempleNom}
              bind:value={saisie.nom}
              disabled={enCours}
              {...invalide(erreurs.nom)}
            />
            {#if erreurs.nom}<span class="erreur">{tm.champs[erreurs.nom]}</span>{/if}
          </div>
          <div class="ligne">
            <div class="champ">
              <label for="debut">{tm.debut}</label>
              <input id="debut" type="date" bind:value={saisie.debut} disabled={enCours} {...invalide(erreurs.debut)} />
              {#if erreurs.debut}<span class="erreur">{tm.champs[erreurs.debut]}</span>{/if}
            </div>
            <div class="champ">
              <label for="fin">{tm.fin}</label>
              <input id="fin" type="date" bind:value={saisie.fin} disabled={enCours} {...invalide(erreurs.fin)} />
              {#if erreurs.fin}<span class="erreur">{tm.champs[erreurs.fin]}</span>{/if}
            </div>
          </div>
          <div class="champ">
            <label for="lieu">{tm.lieu} <small>({tm.facultatif})</small></label>
            <ChampLieu
              bind:lieu={saisie.lieu}
              bind:coordonnees={saisie.coordonnees}
              disabled={enCours}
              invalide={Boolean(erreurs.lieu)}
              decritPar={erreurs.lieu ? 'erreur-lieu' : undefined}
            />
            {#if erreurs.lieu}<span class="erreur" id="erreur-lieu">{tm.champs[erreurs.lieu]}</span>{/if}
          </div>
          {#if message}<p class="message" role="alert">{message}</p>{/if}
          <div class="navigation">
            <button type="submit" disabled={enCours || !enLigne}>{a.suivant(libelleEtape('competitions'))}</button>
          </div>
        </form>
      {:else if etape === 'competitions'}
        {#if competitions.length > 0}
          <ul class="creees" aria-label={a.competitionsCreees}>
            {#each competitions as competition (competition.id)}
              <li>
                <strong>{competition.nom}</strong>
                <small>{competition.arme ? te.armes[competition.arme] : a.plusieursArmes}</small>
                <button
                  type="button"
                  class="secondaire"
                  aria-label={tc.modifier(competition.nom)}
                  onclick={() => modifierCompetition(competition)}
                  disabled={enCours || !enLigne}>{tc.boutonModifier}</button
                >
              </li>
            {/each}
          </ul>
        {/if}
        {#if confirmation}<p class="confirmation" role="status">{confirmation}</p>{/if}
        <form onsubmit={enregistrerCompetition} novalidate>
          <fieldset>
            <legend>{editionCompetition ? tc.titreModification(editionCompetition.nom) : tc.nouvelle}</legend>
            <div class="champ">
              <label for="nom-competition">{a.nomCompetition}</label>
              <input
                id="nom-competition"
                type="text"
                placeholder={tc.exempleNom}
                bind:value={saisieCompetition.nom}
                disabled={enCours}
                {...invalide(erreursCompetition.nom)}
              />
              {#if erreursCompetition.nom}<span class="erreur">{tc.champs[erreursCompetition.nom]}</span>{/if}
            </div>
            <div class="champ">
              <span class="etiquette" id="etiquette-arme">{a.arme}</span>
              <div class="pastilles" role="group" aria-labelledby="etiquette-arme">
                {#each ARMES as arme (arme)}
                  <button
                    type="button"
                    class="pastille-choix"
                    aria-pressed={saisieCompetition.arme === arme}
                    onclick={() => choisirArme(arme)}
                    disabled={enCours}>{te.armes[arme]}</button
                  >
                {/each}
                <button
                  type="button"
                  class="pastille-choix"
                  aria-pressed={saisieCompetition.arme === ''}
                  onclick={() => choisirArme('')}
                  disabled={enCours}>{a.plusieursArmes}</button
                >
              </div>
              {#if erreursCompetition.arme}<span class="erreur">{tc.champs[erreursCompetition.arme]}</span>{/if}
            </div>
            {#if messageCompetition}<p class="message" role="alert">{messageCompetition}</p>{/if}
            <div class="boutons">
              <button type="submit" disabled={enCours || !enLigne}>
                {editionCompetition ? tc.enregistrer : a.ajouterCompetition}
              </button>
              {#if editionCompetition}
                <button type="button" class="secondaire" onclick={annulerModification} disabled={enCours}
                  >{tc.annuler}</button
                >
              {/if}
            </div>
          </fieldset>
        </form>
      {:else if etape === 'epreuves'}
        {#if competitions.length === 0}
          <p class="vide">{a.aucuneCompetition}</p>
        {:else}
          <div class="pastilles" role="group" aria-label={a.choisirCompetition}>
            {#each competitions as competition (competition.id)}
              <button
                type="button"
                class="pastille-choix"
                aria-pressed={competitionGrille === competition.id}
                onclick={() => (competitionGrille = competition.id)}
                >{a.epreuvesDe(competition.nom, epreuvesParCompetition[competition.id] ?? 0)}</button
              >
            {/each}
          </div>
          {#if competitionGrille}
            {#key `${competitionGrille}:${versionGrille}`}
              <GrilleEpreuves
                {session}
                {journal}
                {synchronisation}
                {accueil}
                competitionId={competitionGrille}
                {naviguer}
                integree
                surCreation={surLotCree}
              />
            {/key}
          {/if}
        {/if}
      {:else}
        <p class="bilan" role="status">{a.bilan(bilan.competitions, bilan.epreuves)}</p>
        {#if plan}<PlanLecture {plan} />{:else}<p role="status">{a.chargement}</p>{/if}
      {/if}

      {#if etape !== 'manifestation'}
        <div class="navigation">
          <button type="button" class="secondaire" onclick={() => aller(etapePrecedente(etape))} disabled={enCours}
            >{a.precedent}</button
          >
          {#if etape === 'verifier'}
            <button type="button" onclick={() => manifestation && naviguer(cheminPlanManifestation(manifestation.id))}
              >{a.terminer}</button
            >
          {:else if peutPasserPlusTard(etape) && rienAFaireIci}
            <button type="button" onclick={() => aller(etapeSuivante(etape))} disabled={enCours}>{a.plusTard}</button>
          {:else}
            <button type="button" onclick={() => aller(etapeSuivante(etape))} disabled={enCours}
              >{a.suivant(libelleEtape(etapeSuivante(etape)))}</button
            >
          {/if}
        </div>
      {/if}
    </section>

    <aside class="apercu" aria-labelledby="titre-apercu">
      <h2 id="titre-apercu">{a.apercu}</h2>
      <div class="cadre">
        {#if apercu.cadre}
          <div class="entete">
            <strong>{apercu.cadre.nom}</strong>
            <small>
              {#if apercu.cadre.debut && apercu.cadre.fin}{tm.periode(apercu.cadre.debut, apercu.cadre.fin)}{/if}
              {#if apercu.cadre.lieu}· {apercu.cadre.lieu}{/if}
            </small>
          </div>
          <ul>
            {#each apercu.competitions as ligne (ligne.id ?? 'saisie')}
              <li class:saisie={ligne.enSaisie} style="--couleur: var(--plan-{ligne.couleur})">
                <strong>{ligne.nom}</strong>
                <small>{ligne.enSaisie ? a.enSaisie : a.epreuves(ligne.nombreEpreuves)}</small>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="vide">{a.apercuVide}</p>
        {/if}
      </div>
      <p class="aide">{a.apercuAide}</p>
    </aside>
  </div>
</main>

<style>
  main {
    display: grid;
    gap: 1.25rem;
    padding: 1.5rem 1rem 3rem;
    max-width: 78rem;
    margin: 0 auto;
  }

  .etapes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .etapes li {
    display: flex;
    flex: 1 1 11rem;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--surface);
  }

  .etapes li.courante {
    border-color: var(--accent-fond);
    background: var(--accent-fond);
    color: var(--sur-accent);
  }

  .etapes small {
    display: block;
  }

  .etapes li:not(.courante) small {
    color: var(--texte-discret);
  }

  .pastille {
    display: grid;
    place-items: center;
    flex: none;
    width: 1.75rem;
    height: 1.75rem;
    border: 1.5px solid var(--bordure-champ);
    border-radius: 999px;
    font-weight: 600;
  }

  .etapes li.faite .pastille {
    border-color: var(--etat-ok);
    background: var(--etat-ok);
    color: var(--fond);
  }

  .etapes li.courante .pastille {
    border-color: var(--sur-accent);
  }

  .corps {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    align-items: flex-start;
  }

  .etape {
    display: grid;
    flex: 999 1 32rem;
    min-width: 0;
    gap: 1rem;
    padding: 1.25rem;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--surface);
  }

  h1,
  h2 {
    margin: 0;
  }

  h2 {
    font-size: 0.95rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--texte-discret);
  }

  .aide,
  small,
  .vide {
    margin: 0;
    color: var(--texte-discret);
  }

  form {
    display: grid;
    gap: 1rem;
  }

  fieldset {
    display: grid;
    gap: 1rem;
    margin: 0;
    padding: 1rem;
    border: 2px solid var(--accent);
    border-radius: var(--rayon);
  }

  legend {
    padding: 0 0.5rem;
    font-weight: 600;
  }

  .ligne {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 1rem;
  }

  .champ {
    display: grid;
    gap: 0.3rem;
    min-width: 0;
  }

  label,
  .etiquette {
    font-weight: 600;
  }

  input {
    max-width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte);
    font: inherit;
  }

  [aria-invalid='true'] {
    border-color: var(--etat-erreur);
  }

  .erreur {
    color: var(--etat-erreur);
    font-size: 0.85rem;
  }

  .pastilles {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .pastille-choix {
    padding: 0.5rem 1rem;
    border: 1px solid var(--bordure-champ);
    border-radius: 999px;
    background: var(--fond);
    color: var(--texte);
    font: inherit;
    cursor: pointer;
  }

  .pastille-choix[aria-pressed='true'] {
    border-color: var(--accent-fond);
    background: var(--accent-fond);
    color: var(--sur-accent);
    font-weight: 600;
  }

  button {
    padding: 0.6rem 1rem;
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
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .navigation,
  .boutons {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .boutons {
    justify-content: flex-start;
  }

  .creees {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .creees li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
  }

  .creees li strong {
    flex: 1 1 12rem;
  }

  .message,
  .avertissement,
  .confirmation {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-left: 4px solid var(--etat-erreur);
    background: var(--fond);
  }

  .avertissement {
    border-left-color: var(--etat-attente);
  }

  .confirmation {
    border-left-color: var(--etat-ok);
  }

  .bilan {
    margin: 0;
    font-weight: 600;
  }

  .apercu {
    display: grid;
    flex: 1 1 20rem;
    min-width: 0;
    gap: 0.75rem;
  }

  .cadre {
    overflow: hidden;
    border: 2px solid var(--marque);
    border-radius: var(--rayon);
    background: var(--surface);
  }

  .entete {
    display: grid;
    gap: 0.15rem;
    padding: 0.75rem;
    background: var(--marque);
    color: var(--sur-marque);
  }

  .entete small {
    color: var(--sur-marque);
  }

  .cadre ul {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0.75rem;
    list-style: none;
  }

  .cadre li {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--bordure);
    border-left: 0.35rem solid var(--couleur);
    border-radius: var(--rayon);
  }

  .cadre li.saisie {
    border-style: dashed;
    border-left-style: dashed;
  }

  .cadre .vide {
    padding: 0.75rem;
  }
</style>
