<script lang="ts">
  // « Ajouter des épreuves » (US-048), page réservée : la grille des épreuves d'une compétition. On coche les catégories
  // et les sexes, et toutes les épreuves se créent d'un coup, chacune dans son journal local (donc aussi hors ligne, dans
  // une compétition connue de l'appareil, US-045). Les règles (cases déjà prises, noms, jours, appel) sont dans le domaine.
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import {
    ajouterCategorieLibre,
    ARMES,
    casesOccupees,
    cleCase,
    COLONNES_GRILLE,
    donneesDuLot,
    formuleParDefaut,
    joursDeManifestation,
    lignesDeGrille,
    proposerLot,
    repartitionParJour,
    TOUCHES_POULES_MAX,
    TOUCHES_POULES_MIN,
    TOUCHES_TABLEAU,
    TYPES_EPREUVE,
    validerLot,
    type Arme,
    type CaseGrille,
    type ContexteLot,
    type ModificationsLigne,
    type Sexe,
    type TypeEpreuve,
  } from '@poule-position/domaine';
  import FilAriane from '../composants/FilAriane.svelte';
  import type { Accueil, DonneesAccueil } from '../lib/accueil';
  import type { Journal } from '../lib/journal';
  import { creerLot, type CompteRenduLot } from '../lib/lot';
  import { filSousAccueil } from '../lib/fil-ariane';
  import { CHEMINS, cheminManifestation } from '../lib/routes';
  import type { SessionAppareil } from '../lib/stockage';
  import type { Synchronisation } from '../lib/synchronisation';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: SessionAppareil;
    journal: Journal;
    synchronisation: Synchronisation;
    accueil: Accueil;
    competitionId: string;
    naviguer: (chemin: string) => void;
    /** US-047 : la grille est un morceau de l'assistant (sans titre ni « Annuler ») ; `surCreation` reprend la main à la fin du lot. */
    integree?: boolean;
    surCreation?: () => void;
  }

  let {
    session,
    journal,
    synchronisation,
    accueil,
    competitionId,
    naviguer,
    integree = false,
    surCreation,
  }: Proprietes = $props();

  const t = textes.epreuves;
  const tg = t.grille;

  let donnees = $state<DonneesAccueil | null>(null);
  const competition = $derived(donnees?.competitions.find(({ id }) => id === competitionId) ?? null);
  const manifestation = $derived(donnees?.manifestations.find(({ id }) => id === competition?.manifestationId) ?? null);
  /** CA-2 : les épreuves déjà créées dans cette compétition, connues de l'index ou de l'appareil. */
  const existantes = $derived(
    (donnees?.epreuves ?? [])
      .filter(({ rattachement }) => rattachement.competitionId === competitionId)
      .map(({ arme, categorie, sexe }) => ({ arme, categorie, sexe })),
  );
  const jours = $derived(manifestation ? joursDeManifestation(manifestation.debut, manifestation.fin) : []);

  // Ce que l'organisateur règle.
  let arme: Arme | '' = $state('');
  let armeInitialisee = false;
  let libres: string[] = $state([]);
  let categorieLibre = $state('');
  let erreurCategorie: string | null = $state(null);
  const cochees = new SvelteMap<string, CaseGrille>();
  const modifications: ModificationsLigne = new SvelteMap();
  let typeEpreuve: TypeEpreuve = $state('individuelle');
  let touchesPoules = $state(formuleParDefaut('individuelle').touchesPoules);
  let touchesTableau = $state(formuleParDefaut('individuelle').touchesTableau);
  let matchTroisieme = $state(false);
  const appelParJour: Record<string, string> = $state({});

  let enCours = $state(false);
  let tente = $state(false);
  let compteRendu: CompteRenduLot | null = $state(null);

  const lignes = $derived(lignesDeGrille(libres));
  const armeDuLot = $derived<Arme | null>(arme || null);
  const occupees = $derived(casesOccupees(existantes, armeDuLot ?? competition?.arme ?? null));
  /** Les cases cochées, dans l'ordre de la grille. */
  const casesCochees = $derived(
    lignes.flatMap((categorie) =>
      COLONNES_GRILLE.filter((sexe) => cochees.has(cleCase(categorie, sexe))).map((sexe) => ({ categorie, sexe })),
    ),
  );
  const contexte: ContexteLot | null = $derived(
    competition
      ? {
          competition: { id: competition.id, nom: competition.nom, arme: competition.arme },
          manifestation: manifestation
            ? { debut: manifestation.debut, fin: manifestation.fin, lieu: manifestation.lieu }
            : null,
        }
      : null,
  );
  const proposition = $derived(
    competition ? proposerLot(competition.nom, casesCochees, occupees, jours, modifications) : null,
  );
  const lot = $derived(
    contexte && proposition
      ? donneesDuLot(contexte, { arme: armeDuLot, typeEpreuve, appelParJour }, proposition.epreuves)
      : [],
  );
  const erreurs = $derived(contexte ? validerLot(lot, contexte) : new Map());
  const repartition = $derived(proposition ? repartitionParJour(proposition.epreuves) : []);

  async function charger() {
    donnees = await accueil.charger();
    // CA-7 : sans arme de compétition, l'arme se choisit ; sinon, c'est celle de la compétition.
    if (!armeInitialisee && competition) {
      arme = competition.arme ?? '';
      armeInitialisee = true;
    }
  }

  onMount(() => void charger());

  function basculer(categorie: string, sexe: Sexe) {
    const cle = cleCase(categorie, sexe);
    if (occupees.has(cle)) return;
    if (cochees.has(cle)) cochees.delete(cle);
    else cochees.set(cle, { categorie, sexe });
    compteRendu = null;
  }

  function ajouterCategorie(evenement: SubmitEvent) {
    evenement.preventDefault();
    const resultat = ajouterCategorieLibre(libres, categorieLibre);
    if (resultat.ok) {
      libres = resultat.libres;
      categorieLibre = '';
      erreurCategorie = null;
    } else erreurCategorie = tg.categoriesLibres[resultat.erreur] ?? null;
  }

  function modifier(cle: string, champs: { nom?: string; date?: string | null }) {
    modifications.set(cle, { ...modifications.get(cle), ...champs });
  }

  /** CA-5 : crée les épreuves, puis revient à la liste du club ; un lot interrompu garde ses cases cochées. */
  async function creer(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (enCours || lot.length === 0) return;
    tente = true;
    if (erreurs.size > 0) return;
    enCours = true;
    try {
      const formule = { ...formuleParDefaut(typeEpreuve), touchesPoules, touchesTableau, matchTroisieme };
      const rendu = await creerLot(journal, lot, formule, {
        clubId: session.compte.clubId,
        auteur: session.compte.email,
      });
      // US-022 : envoi après l'écriture ; hors ligne, les épreuves attendent le retour du réseau.
      for (const { epreuveId } of rendu.creees) void synchronisation.envoyer(epreuveId);
      if (rendu.manquantes.length === 0 && rendu.sansFormule.length === 0) {
        if (surCreation) surCreation();
        else naviguer(CHEMINS.organisateur);
        return;
      }
      for (const { cle } of rendu.creees) cochees.delete(cle);
      compteRendu = rendu;
      await charger();
    } finally {
      enCours = false;
    }
  }

  const sexeLibelle = (sexe: Sexe) => t.sexes[sexe];
  const jourCourt = (jour: string) => t.dateLongue(jour);
</script>

<main class:integree>
  {#if !integree && donnees && competition}
    <FilAriane
      niveaux={filSousAccueil(
        competition.nom,
        manifestation ? [{ libelle: manifestation.nom, chemin: cheminManifestation(manifestation.id) }] : [],
        textes.entete.accueil,
      )}
      {naviguer}
    />
  {/if}
  {#if !integree}<h1>{tg.titre}</h1>{/if}

  {#if !donnees}
    <p role="status">{tg.chargement}</p>
  {:else if !competition || !contexte || !proposition}
    <p class="message" role="alert">{tg.introuvable}</p>
    <button type="button" class="secondaire" onclick={() => naviguer(CHEMINS.organisateur)}>{tg.annuler}</button>
  {:else}
    <!-- CA-1 : le fil d'Ariane rappelle la manifestation (si elle existe) et la compétition, avec son arme. -->
    <nav class="ariane" aria-label={tg.ariane}>
      {#if manifestation}<span>{manifestation.nom}</span><span aria-hidden="true">›</span>{/if}
      <strong>{competition.nom}</strong>
      <small>{competition.arme ? t.armes[competition.arme] : tg.sansArme}</small>
    </nav>

    <form onsubmit={creer} novalidate>
      <div class="corps">
        <section class="colonne" aria-label={tg.grille}>
          {#if !competition.arme}
            <!-- CA-7 : une compétition sans arme : l'arme se choisit en tête de la grille, pour tout le lot. -->
            <div class="champ">
              <label for="arme-lot">{tg.armeDuLot}</label>
              <select id="arme-lot" bind:value={arme} aria-invalid={tente && !arme ? 'true' : undefined}>
                <option value="" disabled>{tg.choisirArme}</option>
                {#each ARMES as candidate (candidate)}<option value={candidate}>{t.armes[candidate]}</option>{/each}
              </select>
              <small>{tg.armeDuLotAide}</small>
            </div>
          {/if}

          <table class="grille">
            <thead>
              <tr>
                <th scope="col"><span class="invisible">{t.categorie}</span></th>
                {#each COLONNES_GRILLE as sexe (sexe)}<th scope="col">{sexeLibelle(sexe)}</th>{/each}
              </tr>
            </thead>
            <tbody>
              {#each lignes as categorie (categorie)}
                <tr>
                  <th scope="row">{categorie}</th>
                  {#each COLONNES_GRILLE as sexe (sexe)}
                    {@const cle = cleCase(categorie, sexe)}
                    {@const prise = occupees.has(cle)}
                    <td>
                      <!-- CA-1 : chaque case est un bouton qu'on coche ou décoche ; CA-2 : une case prise ne se coche pas. -->
                      <button
                        type="button"
                        class="case"
                        aria-pressed={cochees.has(cle) && !prise}
                        aria-label={tg.case(categorie, sexeLibelle(sexe))}
                        disabled={prise || enCours}
                        onclick={() => basculer(categorie, sexe)}
                        >{#if prise}{tg.dejaCreee}{:else if cochees.has(cle)}✓{:else}&nbsp;{/if}</button
                      >
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>

          <!-- CA-6 : une catégorie libre devient une ligne de la grille, pour ce lot seulement. -->
          <div class="champ libre">
            <label for="categorie-libre">{tg.categorieLibre}</label>
            <div class="rangee">
              <input
                id="categorie-libre"
                type="text"
                placeholder={tg.categorieLibreExemple}
                bind:value={categorieLibre}
                aria-invalid={erreurCategorie ? 'true' : undefined}
                onkeydown={(e) =>
                  e.key === 'Enter' && (ajouterCategorie(e as unknown as SubmitEvent), e.preventDefault())}
              />
              <button type="button" class="secondaire" onclick={(e) => ajouterCategorie(e as unknown as SubmitEvent)}
                >{tg.ajouterCategorie}</button
              >
            </div>
            {#if erreurCategorie}<span class="erreur" role="alert">{erreurCategorie}</span>{/if}
          </div>
        </section>

        <section class="colonne" aria-label={tg.reglages}>
          <fieldset>
            <legend>{tg.reglages}</legend>
            <small>{tg.reglagesAide}</small>
            <div class="champ">
              <label for="type-lot">{t.type}</label>
              <select id="type-lot" bind:value={typeEpreuve}>
                {#each TYPES_EPREUVE as type (type)}<option value={type}>{t.types[type]}</option>{/each}
              </select>
            </div>
            <div class="ligne">
              <div class="champ">
                <label for="poules-lot">{tg.touchesPoules}</label>
                <input
                  id="poules-lot"
                  type="number"
                  min={TOUCHES_POULES_MIN}
                  max={TOUCHES_POULES_MAX}
                  bind:value={touchesPoules}
                />
              </div>
              <div class="champ">
                <label for="tableau-lot">{tg.touchesTableau}</label>
                <select id="tableau-lot" bind:value={touchesTableau}>
                  {#each TOUCHES_TABLEAU as touches (touches)}<option value={touches}>{touches}</option>{/each}
                </select>
              </div>
            </div>
            <label class="case-a-cocher"
              ><input type="checkbox" bind:checked={matchTroisieme} /> {tg.matchTroisieme}</label
            >
            {#each jours as jour (jour)}
              <div class="champ">
                <label for="appel-{jour}">{tg.appelDuJour(jourCourt(jour))}</label>
                <input id="appel-{jour}" type="time" bind:value={appelParJour[jour]} />
              </div>
            {/each}
            {#if manifestation?.lieu}<small>{tg.lieuRepris(manifestation.lieu)}</small>{/if}
          </fieldset>

          <!-- CA-3 : les épreuves proposées, leur nom (modifiable), leur jour, et la répartition par jour. -->
          <div class="proposees" aria-live="polite">
            <h2>
              {#if proposition.epreuves.length > 0}{tg.seraCreees(
                  proposition.epreuves.length,
                )}{:else}{tg.aucuneCochee}{/if}
            </h2>
            {#if repartition.length > 0 && jours.length > 0}
              <p class="repartition">
                {repartition.map(({ jour, nombre }) => tg.repartition(jourCourt(jour), nombre)).join(' · ')}
              </p>
            {/if}
            <ul>
              {#each proposition.epreuves as epreuve (epreuve.cle)}
                {@const erreur = tente ? erreurs.get(epreuve.cle) : undefined}
                {@const nomLigne = `${epreuve.categorie} ${sexeLibelle(epreuve.sexe)}`}
                <li>
                  <input
                    type="text"
                    aria-label={tg.nomEpreuve(nomLigne)}
                    value={epreuve.nom}
                    oninput={(e) => modifier(epreuve.cle, { nom: e.currentTarget.value })}
                    aria-invalid={erreur?.nom ? 'true' : undefined}
                  />
                  {#if jours.length > 0}
                    <select
                      aria-label={tg.jourEpreuve(nomLigne)}
                      value={epreuve.date ?? ''}
                      onchange={(e) => modifier(epreuve.cle, { date: e.currentTarget.value || null })}
                    >
                      {#each jours as jour (jour)}<option value={jour}>{jourCourt(jour)}</option>{/each}
                    </select>
                  {/if}
                  {#if erreur}
                    <span class="erreur" role="alert"
                      >{Object.values(erreur)
                        .map((code) => (code ? (t.champs[code as keyof typeof t.champs] ?? code) : ''))
                        .join(' · ')}</span
                    >
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        </section>
      </div>

      {#if compteRendu}
        <p class="avertissement" role="status">
          {#if compteRendu.manquantes.length > 0}{tg.partiel(
              compteRendu.creees.length,
              compteRendu.manquantes.length,
            )}{/if}
          {#if compteRendu.sansFormule.length > 0}{tg.sansFormule(compteRendu.sansFormule.length)}{/if}
        </p>
      {/if}

      <div class="actions">
        <button type="submit" disabled={enCours || proposition.epreuves.length === 0}>
          {enCours ? tg.creation : tg.creer(proposition.epreuves.length)}
        </button>
        {#if !integree}
          <button type="button" class="secondaire" disabled={enCours} onclick={() => naviguer(CHEMINS.organisateur)}
            >{tg.annuler}</button
          >
        {/if}
      </div>
    </form>
  {/if}
</main>

<style>
  main.integree {
    padding: 0;
  }

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
    font-size: 1.1rem;
  }

  .ariane {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem;
  }

  form {
    display: grid;
    gap: 1.25rem;
    width: min(100%, 64rem);
  }

  .corps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
    gap: 1.5rem;
    align-items: start;
  }

  .colonne {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }

  .champ {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    gap: 0.3rem;
  }

  .ligne {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 1rem;
  }

  .rangee {
    display: flex;
    gap: 0.5rem;
  }

  .rangee input {
    flex: 1;
    min-width: 0;
  }

  label,
  legend {
    font-weight: 600;
  }

  small {
    color: var(--texte-discret);
    font-weight: 400;
  }

  .invisible {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  input,
  select {
    max-width: 100%;
    padding: 0.5rem 0.65rem;
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

  fieldset {
    display: grid;
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    border: none;
  }

  .case-a-cocher {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 400;
  }

  table.grille {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0.25rem;
  }

  .grille th {
    font-weight: 600;
    text-align: left;
  }

  .grille thead th {
    text-align: center;
  }

  button.case {
    width: 100%;
    min-height: 2.25rem;
    padding: 0.2rem;
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
    font-size: 0.8rem;
    font-weight: 400;
  }

  button.case[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent-fond);
    color: var(--sur-accent);
    font-weight: 600;
  }

  button.case:disabled {
    color: var(--texte-discret);
    font-style: italic;
  }

  .proposees ul {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .proposees li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .proposees li input {
    flex: 1 1 12rem;
    min-width: 0;
  }

  .repartition {
    margin: 0;
    color: var(--texte-discret);
    text-align: center;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  button {
    padding: 0.7rem 1.2rem;
    border: none;
    border-radius: var(--rayon);
    background: var(--accent-fond);
    color: var(--sur-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button.secondaire {
    padding: 0.5rem 0.8rem;
    min-height: 2.75rem;
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
    font-weight: 400;
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
