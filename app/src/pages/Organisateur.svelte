<script lang="ts">
  // Accueil de l'organisateur (US-003 CA-1, US-026), page réservée : nom et rôle du compte connecté, les actions de
  // création, et la liste du club : manifestations (repliables) avec leurs épreuves et leurs compétitions, puis les
  // compétitions isolées. La liste vient du serveur, ou de la dernière copie gardée sur l'appareil et des compétitions
  // locales (hors ligne) ; la création d'une manifestation ou d'une épreuve exige le réseau (US-023, US-024), celle
  // d'une compétition non (US-025). La gestion des comptes (US-007) reste réservée aux administrateurs, grisée hors ligne.
  // Le profil (US-016) et la déconnexion (US-003 CA-5) sont dans le menu de compte de l'entête (US-017).
  import { onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import {
    competitionsVisibles,
    construireListe,
    manifestationOuverte,
    type CompetitionListee,
    type ListeClub,
  } from '@poule-position/domaine';
  import type { SessionAppareil } from '../lib/stockage';
  import Lien from '../composants/Lien.svelte';
  import type { Accueil, DonneesAccueil } from '../lib/accueil';
  import {
    confirmationSerie,
    CONFIRMATION_SERIE,
    supprimerEnSerie,
    toutCocher,
    type CompteRendu,
  } from '../lib/suppression';
  import { cheminCompetition, cheminNouvelleEpreuve, CHEMIN_NOUVELLE_MANIFESTATION, CHEMINS } from '../lib/routes';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: SessionAppareil;
    accueil: Accueil;
    naviguer: (chemin: string) => void;
  }

  let { session, accueil, naviguer }: Proprietes = $props();

  const t = textes.listeClub;
  const tc = textes.competitions;

  let horsLigne = $state(!navigator.onLine);
  let donnees: DonneesAccueil | null = $state(null);
  let afficherArchives = $state(false);
  /** Jour d'aujourd'hui (`AAAA-MM-JJ`), pour ouvrir la manifestation en cours. */
  const aujourdhui = new Date().toLocaleDateString('sv-SE');

  const liste: ListeClub | null = $derived(donnees ? construireListe(donnees, { afficherArchives }) : null);

  async function charger() {
    donnees = await accueil.charger();
  }

  /** US-040 : suppression de plusieurs compétitions, réservée aux administrateurs. */
  const ts = t.suppression;
  const administrateur = $derived(session.compte.role === 'administrateur');
  const cochees = new SvelteSet<string>();
  let etapeSerie: 'aucune' | 'confirmation' | 'encours' = $state('aucune');
  let saisieSerie = $state('');
  let progression: { faites: number; total: number } | null = $state(null);
  let compteRendu: CompteRendu | null = $state(null);
  let nomsSerie = $state(new Map<string, string>());

  const visibles = $derived(liste ? competitionsVisibles(liste) : []);
  /** CA-2 : seules les compétitions visibles comptent, jamais celles qu'un filtre masque. */
  const aSupprimer = $derived(visibles.filter(({ id }) => cochees.has(id)));

  function basculer(id: string, coche: boolean) {
    if (coche) cochees.add(id);
    else cochees.delete(id);
  }

  /** CA-2 : « Tout cocher » prend les compétitions visibles et supprimables ; si une sélection existe, elle se vide. */
  function basculerTout() {
    const nouvelle = aSupprimer.length > 0 ? new Set<string>() : toutCocher(visibles);
    cochees.clear();
    for (const id of nouvelle) cochees.add(id);
  }

  /** CA-3 : supprime les compétitions cochées une à une, puis relit la liste une seule fois. */
  async function lancerSerie() {
    if (etapeSerie !== 'confirmation' || !confirmationSerie(saisieSerie)) return;
    nomsSerie = new Map(aSupprimer.map(({ id, nom }) => [id, nom]));
    etapeSerie = 'encours';
    compteRendu = null;
    const compte = await supprimerEnSerie(
      aSupprimer.map(({ id }) => id),
      (id) => accueil.supprimer(id),
      (faites, total) => (progression = { faites, total }),
    );
    compteRendu = compte;
    // CA-4 : ce qui n'a pas été supprimé reste coché, pour relancer.
    cochees.clear();
    for (const { id } of compte.restantes) cochees.add(id);
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

{#snippet competition(entree: CompetitionListee)}
  <li class="competition">
    <span class="ligne">
      <!-- US-040 CA-1 : une compétition en cours ne se coche pas ; CA-5 : pas de case pour un organisateur. -->
      {#if administrateur}
        <input
          type="checkbox"
          checked={cochees.has(entree.id)}
          disabled={entree.statut === 'enCours' || horsLigne || etapeSerie === 'encours'}
          title={entree.statut === 'enCours' ? ts.enCours : undefined}
          aria-label={ts.cocher(entree.nom)}
          onchange={(evenement) => basculer(entree.id, evenement.currentTarget.checked)}
        />
      {/if}
      <Lien chemin={cheminCompetition(entree.id)} {naviguer}>{entree.nom}</Lien>
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
    <!-- US-025 : la création d'une compétition fonctionne aussi hors ligne. -->
    <Lien chemin={CHEMINS.nouvelleCompetition} {naviguer}>{tc.nouvelle}</Lien>
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

        <!-- US-040 : sélection et suppression de plusieurs compétitions, réservées aux administrateurs. -->
        {#if administrateur && visibles.length > 0}
          <div class="selection">
            <span role="status">{ts.selection(aSupprimer.length)}</span>
            <button
              type="button"
              class="secondaire"
              onclick={basculerTout}
              disabled={horsLigne || etapeSerie === 'encours'}
              >{aSupprimer.length > 0 ? ts.toutDecocher : ts.toutCocher}</button
            >
            <button
              type="button"
              class="danger"
              onclick={() => (etapeSerie = 'confirmation')}
              disabled={horsLigne || aSupprimer.length === 0 || etapeSerie !== 'aucune'}
              aria-describedby={horsLigne ? 'suppression-serie-aide' : undefined}>{ts.bouton}</button
            >
            {#if horsLigne}<small id="suppression-serie-aide">{ts.horsLigne}</small>{/if}
          </div>
        {/if}

        {#if etapeSerie !== 'aucune'}
          <div class="confirmation" role="group" aria-label={ts.titre(aSupprimer.length)}>
            <p>{ts.titre(aSupprimer.length)}</p>
            <p class="avertissement" role="status">{ts.avertissement}</p>
            <ul class="noms">
              {#each aSupprimer as { id, nom } (id)}<li>{nom}</li>{/each}
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

        <!-- CA-4 : compte rendu de la série ; les compétitions restantes restent cochées. -->
        {#if compteRendu}
          <div class="compte-rendu">
            <p role="status">{ts.compteRendu(compteRendu.supprimees.length)}</p>
            {#if compteRendu.restantes.length > 0}
              <p role="alert">{ts.restantes(compteRendu.restantes.length)}</p>
              <ul>
                {#each compteRendu.restantes as { id, erreur } (id)}
                  <li>{nomsSerie.get(id) ?? id} · {erreur ? tc.suppression.erreurs[erreur] : ts.nonTraitee}</li>
                {/each}
              </ul>
              {#if compteRendu.interrompue}<p role="alert">{ts.interrompue}</p>{/if}
            {/if}
            <button type="button" class="secondaire" onclick={() => (compteRendu = null)}>{ts.fermer}</button>
          </div>
        {/if}

        {#each liste.manifestations as noeud (noeud.manifestation.id)}
          <details class="manifestation" open={manifestationOuverte(noeud.manifestation, aujourdhui)}>
            <summary>
              <strong>{noeud.manifestation.nom}</strong>
              <span class="infos">
                {textes.manifestations.periode(noeud.manifestation.debut, noeud.manifestation.fin)}
                {#if noeud.manifestation.lieu}· {noeud.manifestation.lieu}{/if}
              </span>
            </summary>
            <div class="contenu">
              {@render creation(
                cheminNouvelleEpreuve(noeud.manifestation.id),
                t.nouvelleEpreuve,
                t.nouvelleEpreuveDans(noeud.manifestation.nom),
              )}
              {#each noeud.epreuves as { epreuve, competitions } (epreuve.id)}
                <div class="epreuve">
                  <h3>
                    {epreuve.nom}
                    {#if epreuve.arme}<small>{tc.armes[epreuve.arme]}</small>{/if}
                  </h3>
                  <ul>
                    {#each competitions as entree (entree.id)}{@render competition(entree)}{:else}
                      <li class="vide">{t.aucuneCompetition}</li>
                    {/each}
                  </ul>
                </div>
              {/each}
              {#if noeud.competitions.length > 0}
                <ul>
                  {#each noeud.competitions as entree (entree.id)}{@render competition(entree)}{/each}
                </ul>
              {/if}
            </div>
          </details>
        {/each}

        {#if liste.isolees.length > 0}
          <div class="epreuve">
            <h3>{t.isolees}</h3>
            <ul>
              {#each liste.isolees as entree (entree.id)}{@render competition(entree)}{/each}
            </ul>
          </div>
        {/if}
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

  .epreuve {
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

  .competition {
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

  label {
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
