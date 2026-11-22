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
    jourDeLigne,
    type CaseGrille,
    type ContexteLot,
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
  import ChampHeure from '../composants/ChampHeure.svelte';
  import { HEURE_PAR_DEFAUT } from '../lib/epreuves';

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
  /** US-078 CA-1 : le jour choisi pour chaque ligne (catégorie) ; une ligne absente prend le premier jour. */
  const joursParLigne = new SvelteMap<string, string>();
  let typeEpreuve: TypeEpreuve = $state('individuelle');
  let touchesPoules = $state(formuleParDefaut('individuelle').touchesPoules);
  let touchesTableau = $state(formuleParDefaut('individuelle').touchesTableau);
  let matchTroisieme = $state(false);
  const appelParJour: Record<string, string> = $state({});
  // US-069 CA-1 : l'appel de chaque jour part de 9 h 00 ; un jour déjà réglé n'est pas écrasé.
  $effect(() => {
    for (const jour of jours) appelParJour[jour] ??= HEURE_PAR_DEFAUT;
  });

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
    competition ? proposerLot(competition.nom, casesCochees, occupees, jours, joursParLigne) : null,
  );
  const lot = $derived(
    contexte && proposition
      ? donneesDuLot(contexte, { arme: armeDuLot, typeEpreuve, appelParJour }, proposition.epreuves)
      : [],
  );
  const erreurs = $derived(contexte ? validerLot(lot, contexte) : new Map());
  const repartition = $derived(proposition ? repartitionParJour(proposition.epreuves) : []);
  /** US-078 CA-1 et CA-2 : une colonne par jour, seulement pour une manifestation de plusieurs jours. */
  const colonnesJours = $derived(jours.length > 1 ? jours : []);
  /** US-078 CA-1 : une ligne a des boutons de jour dès qu'une de ses cases est cochée (et pas déjà créée). */
  const ligneCochee = (categorie: string) =>
    COLONNES_GRILLE.some((sexe) => cochees.has(cleCase(categorie, sexe)) && !occupees.has(cleCase(categorie, sexe)));

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

  /** CA-5 : crée les épreuves, puis revient à la liste du club ; un lot interrompu garde ses cases cochées. */
  async function creer(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (enCours || lot.length === 0) return;
    tente = true;
    if (erreurs.size > 0) return;
    enCours = true;
    try {
      // US-149 : par équipes, les touches suivent les rencontres en relais (formule par défaut du type).
      const formule =
        typeEpreuve === 'individuelle'
          ? { ...formuleParDefaut(typeEpreuve), touchesPoules, touchesTableau, matchTroisieme }
          : { ...formuleParDefaut(typeEpreuve), matchTroisieme };
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

          <!-- US-080 CA-1 : largeurs fixées par les colonnes, les trois colonnes de sexe sont égales. -->
          <table class="grille">
            <colgroup>
              <col class="col-categorie" />
              {#each COLONNES_GRILLE as sexe (sexe)}<col class="col-sexe" />{/each}
              {#each colonnesJours as jour (jour)}<col class="col-jour" />{/each}
            </colgroup>
            <thead>
              <tr>
                <th scope="col"><span class="invisible">{t.categorie}</span></th>
                {#each COLONNES_GRILLE as sexe (sexe)}<th scope="col">{sexeLibelle(sexe)}</th>{/each}
                <!-- US-078 CA-1 : une colonne par jour, après un filet ; CA-2 : aucune pour un seul jour. -->
                {#each colonnesJours as jour, indice (jour)}
                  <th scope="col" class="jour" class:premier-jour={indice === 0} title={jourCourt(jour)}
                    >{tg.enteteJour(jour)}</th
                  >
                {/each}
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
                  <!-- US-078 CA-1 : un bouton radio par jour, le premier jour par défaut ; US-080 CA-2 : sur toutes les
                       lignes, désactivé et non choisi tant que la ligne n'a pas de case cochée. -->
                  {#each colonnesJours as jour, indice (jour)}
                    {@const active = ligneCochee(categorie)}
                    <td class="jour" class:premier-jour={indice === 0}>
                      <!-- Toute la case est la cible du clic, pas seulement le petit bouton radio. -->
                      <label class="choix-jour" class:inactif={!active} title={active ? undefined : tg.jourInactif}>
                        <input
                          type="radio"
                          name="jour-{categorie}"
                          value={jour}
                          aria-label={tg.jourDesEpreuves(categorie, jourCourt(jour))}
                          checked={active && jourDeLigne(categorie, jours, joursParLigne) === jour}
                          disabled={!active || enCours}
                          onchange={() => joursParLigne.set(categorie, jour)}
                        />
                      </label>
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
                <span class="etiquette">{tg.appelDuJour(jourCourt(jour))}</span>
                <ChampHeure
                  id="appel-{jour}"
                  libelle={tg.appelDuJour(jourCourt(jour))}
                  bind:value={() => appelParJour[jour] ?? HEURE_PAR_DEFAUT, (v) => (appelParJour[jour] = v)}
                />
              </div>
            {/each}
            {#if manifestation?.lieu}<small>{tg.lieuRepris(manifestation.lieu)}</small>{/if}
          </fieldset>

          <!-- US-078 CA-3 : un récapitulatif sur une ligne (nombre et répartition par jour), sans liste d'épreuves à régler. -->
          <div class="proposees" aria-live="polite">
            <h2>
              {#if proposition.epreuves.length > 0}{tg.seraCreees(
                  proposition.epreuves.length,
                )}{:else}{tg.aucuneCochee}{/if}
            </h2>
            {#if repartition.length > 0 && jours.length > 1}
              <p class="repartition">
                {repartition.map(({ jour, nombre }) => tg.repartition(jourCourt(jour), nombre)).join(' · ')}
              </p>
            {/if}
            {#if tente && erreurs.size > 0}
              <ul class="erreurs">
                {#each proposition.epreuves as epreuve (epreuve.cle)}
                  {@const erreur = erreurs.get(epreuve.cle)}
                  {#if erreur}
                    <li class="erreur" role="alert">
                      {tg.erreurEpreuve(
                        `${epreuve.categorie} ${sexeLibelle(epreuve.sexe)}`,
                        Object.values(erreur)
                          .map((code) => (code ? (t.champs[code as keyof typeof t.champs] ?? code) : ''))
                          .join(' · '),
                      )}
                    </li>
                  {/if}
                {/each}
              </ul>
            {/if}
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
  .etiquette,
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
    table-layout: fixed;
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

  /* US-078 CA-1 : les colonnes de jours, séparées des colonnes de sexe par un filet. */
  .grille .jour {
    min-width: 3rem;
    text-align: center;
  }

  .grille thead th.jour {
    font-weight: 600;
    white-space: nowrap;
  }

  .grille .premier-jour {
    border-left: 1px solid var(--bordure);
    padding-left: 0.5rem;
  }

  /* US-080 CA-1 : la catégorie a sa largeur ; les trois colonnes de sexe se partagent le reste à égalité. */
  .col-categorie {
    width: 6.5rem;
  }

  .col-jour {
    width: 4.5rem;
  }

  /* US-080 CA-2 : un bouton de jour inaccessible reste visible, grisé. */
  .choix-jour.inactif {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .choix-jour {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 2.25rem;
    cursor: pointer;
  }

  .choix-jour input {
    width: 1.15rem;
    height: 1.15rem;
    margin: 0;
    padding: 0;
    accent-color: var(--accent);
  }

  .erreurs {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
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
