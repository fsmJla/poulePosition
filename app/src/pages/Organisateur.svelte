<script lang="ts">
  // Accueil de l'organisateur (US-003 CA-1, US-026), page réservée : nom et rôle du compte connecté, les actions de
  // création, et la liste du club : les épreuves à rattacher (US-045 CA-7), puis les manifestations (repliables) avec leurs
  // compétitions et leurs épreuves, puis les compétitions seules. La liste vient du serveur, ou de la dernière copie gardée sur l'appareil et des épreuves
  // locales (hors ligne) ; la création d'une manifestation ou d'une compétition exige le réseau (US-023, US-024), celle
  // d'une épreuve non (US-025). La gestion des comptes (US-007) reste réservée aux administrateurs, grisée hors ligne.
  // Le profil (US-016) et la déconnexion (US-003 CA-5) sont dans le menu de compte de l'entête (US-017).
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import {
    analyserSelection,
    construireListe,
    elementsEnCours,
    manifestationOuverte,
    planSuppression,
    toutCocherListe,
    type EpreuveListee,
    type ListeClub,
  } from '@poule-position/domaine';
  import type { SessionAppareil } from '../lib/stockage';
  import Lien from '../composants/Lien.svelte';
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
    cheminNouvelleCompetition,
    CHEMIN_NOUVELLE_COMPETITION_SEULE,
    CHEMIN_NOUVELLE_MANIFESTATION,
    CHEMINS,
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

  async function charger() {
    donnees = await accueil.charger();
  }

  /** US-040 et US-043 : suppression de manifestations, de compétitions et d’épreuves, réservée aux administrateurs. */
  const ts = t.suppression;
  const administrateur = $derived(session.compte.role === 'administrateur');
  const cochees = new SvelteSet<string>();
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

  /** CA-3 : « Tout cocher » prend ce que la liste montre et qui est supprimable ; si une sélection existe, elle se vide. */
  function basculerTout() {
    const nouvelle = cochees.size > 0 || !donnees ? new Set<string>() : toutCocherListe(donnees, afficherArchives);
    cochees.clear();
    for (const id of nouvelle) cochees.add(id);
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
    // CA-6 : ce qui n'a pas été supprimé reste coché, pour relancer.
    cochees.clear();
    for (const { element } of compte.restants) cochees.add(element.id);
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
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    void charger();
    return () => {
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
    };
  });
</script>

{#snippet caseSelection(id: string, libelle: string, motifEnCours: string)}
  <!-- CA-1 : une case par élément, sauf pour un organisateur (CA-7) ; CA-2 : couverte par un parent coché, elle est cochée et verrouillée. -->
  {#if administrateur && analyse}
    {@const parent = analyse.verrouillees.get(id)}
    <input
      type="checkbox"
      checked={parent !== undefined || cochees.has(id)}
      disabled={enCours.has(id) || parent !== undefined || horsLigne || etapeSerie === 'encours'}
      title={parent !== undefined ? ts.avecParent(parent) : enCours.has(id) ? motifEnCours : undefined}
      aria-label={libelle}
      onchange={(evenement) => basculer(id, evenement.currentTarget.checked)}
    />
  {/if}
{/snippet}

{#snippet epreuve(entree: EpreuveListee)}
  <li class="epreuve">
    <span class="ligne">
      {@render caseSelection(entree.id, ts.cocher(entree.nom), ts.enCours)}
      <Lien chemin={cheminEpreuve(entree.id)} {naviguer}>{entree.nom}</Lien>
    </span>
    <span class="infos">
      {tc.armes[entree.arme]}
      {#if entree.categorie}· {entree.categorie}{/if}
      {#if entree.sexe}· {tc.sexes[entree.sexe]}{/if}
      {#if entree.date}· {t.jour(entree.date)}{/if}
    </span>
    <span class="etiquettes">
      <span>{tc.statuts[entree.statut]}</span>
      <span>{entree.publiee ? tc.publiee : tc.nonPubliee}</span>
      {#if entree.pilote}<span class="pilote">{tc.pilote}</span>{:else}<span>{t.lectureSeule}</span>{/if}
      {#if entree.nonEnvoyee}<span class="attente">{tc.pasEncoreEnvoyee}</span>{/if}
    </span>
  </li>
{/snippet}

{#snippet creation(chemin: string, libelle: string, nomAccessible?: string)}
  {#if horsLigne}
    <span class="inactive" aria-disabled="true">
      {libelle}
      <small>{t.horsLigne}</small>
    </span>
  {:else}
    <Lien {chemin} {naviguer} etiquette={nomAccessible}>{libelle}</Lien>
  {/if}
{/snippet}

<main>
  <h1>{textes.organisateur.bonjour(session.compte.nom)}</h1>
  <p class="role">{textes.roles[session.compte.role]}</p>
  <nav class="actions" aria-label={textes.organisateur.actions}>
    <!-- US-025 : la création d'une épreuve fonctionne aussi hors ligne. -->
    <Lien chemin={CHEMINS.nouvelleEpreuve} {naviguer}>{tc.nouvelle}</Lien>
    <!-- US-045 CA-4 : la compétition seule se crée en ligne, avec sa première épreuve. -->
    {@render creation(CHEMIN_NOUVELLE_COMPETITION_SEULE, t.nouvelleCompetitionSeule)}
    {@render creation(CHEMIN_NOUVELLE_MANIFESTATION, t.nouvelleManifestation)}
    <!-- US-023 : consultables hors ligne (dernière copie), modifiables en ligne seulement. -->
    <Lien chemin={CHEMINS.manifestations} {naviguer}>{textes.manifestations.entree}</Lien>
    {#if session.compte.role === 'administrateur'}
      {#if horsLigne}
        <span class="inactive" aria-disabled="true">
          {textes.comptes.entree}
          <small>{textes.comptes.horsLigne}</small>
        </span>
      {:else}
        <Lien chemin={CHEMINS.comptes} {naviguer}>{textes.comptes.entree}</Lien>
      {/if}
    {/if}
  </nav>

  <section class="liste" aria-labelledby="titre-liste">
    <h2 id="titre-liste">{t.titre}</h2>

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

        <!-- US-040 et US-043 : sélection et suppression par lot, réservées aux administrateurs. -->
        {#if administrateur && analyse}
          <div class="selection">
            <span role="status"
              >{seulementEpreuves ? ts.selection(analyse.decompte.epreuves) : ts.selectionMixte(analyse.decompte)}</span
            >
            <button
              type="button"
              class="secondaire"
              onclick={basculerTout}
              disabled={horsLigne || etapeSerie === 'encours'}
              >{cochees.size > 0 ? ts.toutDecocher : ts.toutCocher}</button
            >
            <button
              type="button"
              class="danger"
              onclick={() => (etapeSerie = 'confirmation')}
              disabled={horsLigne || plan.length === 0 || etapeSerie !== 'aucune'}
              aria-describedby={horsLigne ? 'suppression-serie-aide' : undefined}>{ts.bouton}</button
            >
            {#if horsLigne}<small id="suppression-serie-aide">{ts.horsLigne}</small>{/if}
          </div>
        {/if}

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
          <div class="competition a-rattacher">
            <h3>{t.aRattacher}</h3>
            <ul>
              {#each liste.aRattacher as entree (entree.id)}
                {@render epreuve(entree)}
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

        {#each liste.manifestations as noeud (noeud.manifestation.id)}
          <details class="manifestation" open={manifestationOuverte(noeud.manifestation, aujourdhui)}>
            <summary>
              <span class="ligne">
                {@render caseSelection(
                  noeud.manifestation.id,
                  ts.cocherManifestation(noeud.manifestation.nom),
                  ts.contientEnCours,
                )}
                <strong>{noeud.manifestation.nom}</strong>
              </span>
              <span class="infos">
                {textes.manifestations.periode(noeud.manifestation.debut, noeud.manifestation.fin)}
                {#if noeud.manifestation.lieu}· {noeud.manifestation.lieu}{/if}
              </span>
            </summary>
            <div class="contenu">
              {@render creation(
                cheminNouvelleCompetition(noeud.manifestation.id),
                t.nouvelleCompetition,
                t.nouvelleCompetitionDans(noeud.manifestation.nom),
              )}
              {#each noeud.competitions as { competition, epreuves } (competition.id)}
                <div class="competition">
                  <h3>
                    {@render caseSelection(competition.id, ts.cocherCompetition(competition.nom), ts.contientEnCours)}
                    {competition.nom}
                    {#if competition.arme}<small>{tc.armes[competition.arme]}</small>{/if}
                  </h3>
                  <ul>
                    {#each epreuves as entree (entree.id)}{@render epreuve(entree)}{:else}
                      <li class="vide">{t.aucuneEpreuve}</li>
                    {/each}
                  </ul>
                  <Lien
                    chemin={cheminGrilleEpreuves(competition.id)}
                    {naviguer}
                    etiquette={tc.grille.ajouterA(competition.nom)}>{tc.grille.ajouter}</Lien
                  >
                </div>
              {/each}
            </div>
          </details>
        {/each}

        <!-- US-045 CA-5 : les compétitions seules, après les manifestations ; une seule épreuve tient sur une ligne. -->
        {#each liste.competitionsSeules as { competition, epreuves } (competition.id)}
          {#if epreuves.length === 1 && epreuves[0]}
            <ul class="seule">{@render epreuve(epreuves[0])}</ul>
          {:else}
            <div class="competition">
              <h3>
                {@render caseSelection(competition.id, ts.cocherCompetition(competition.nom), ts.contientEnCours)}
                {competition.nom}
                {#if competition.arme}<small>{tc.armes[competition.arme]}</small>{/if}
              </h3>
              <ul>
                {#each epreuves as entree (entree.id)}{@render epreuve(entree)}{:else}
                  <li class="vide">{t.aucuneEpreuve}</li>
                {/each}
              </ul>
              <Lien
                chemin={cheminGrilleEpreuves(competition.id)}
                {naviguer}
                etiquette={tc.grille.ajouterA(competition.nom)}>{tc.grille.ajouter}</Lien
              >
            </div>
          {/if}
        {/each}
      {/if}
    {/if}
  </section>
</main>

<style>
  main {
    display: grid;
    justify-items: center;
    gap: 0.75rem;
    padding: 4rem 1rem;
    text-align: center;
  }

  h1 {
    margin: 0;
  }

  .role {
    margin: 0 0 1rem;
    padding: 0.2rem 0.8rem;
    border-radius: 999px;
    background: var(--surface);
    color: var(--texte-discret);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
    justify-content: center;
  }

  /* Entrée grisée hors ligne (US-007, US-026) : visible, mais sans lien. */
  .inactive {
    display: grid;
    color: var(--texte-discret);
    font-weight: 600;
  }

  .inactive small {
    font-weight: 400;
  }

  .liste {
    display: grid;
    gap: 0.9rem;
    width: min(100%, 44rem);
    margin-top: 1.5rem;
    text-align: left;
  }

  h2 {
    margin: 0;
    font-size: 1.2rem;
    text-align: center;
  }

  h3 {
    margin: 0;
    font-size: 1rem;
  }

  small,
  .infos {
    color: var(--texte-discret);
    font-weight: 400;
  }

  .filtre {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
  }

  .manifestation {
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--surface);
  }

  summary {
    display: grid;
    gap: 0.2rem;
    padding: 0.8rem 1rem;
    overflow-wrap: anywhere;
    cursor: pointer;
  }

  .contenu {
    display: grid;
    gap: 0.8rem;
    padding: 0 1rem 1rem;
  }

  .competition {
    display: grid;
    gap: 0.4rem;
  }

  ul {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .epreuve {
    display: grid;
    gap: 0.2rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--fond);
    overflow-wrap: anywhere;
  }

  .etiquettes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .etiquettes span {
    padding: 0.1rem 0.55rem;
    border-radius: 999px;
    background: var(--surface);
    color: var(--texte-discret);
    font-size: 0.8rem;
  }

  .etiquettes .pilote {
    color: var(--texte);
    font-weight: 600;
  }

  .etiquettes .attente {
    border-left: 3px solid var(--etat-attente);
  }

  .vide {
    margin: 0;
    color: var(--texte-discret);
  }

  .ligne {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .selection,
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

  .noms {
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
</style>
