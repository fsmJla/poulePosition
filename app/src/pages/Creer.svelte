<script lang="ts">
  // « Que voulez-vous créer ? » (US-046), page réservée : le point d'entrée unique de la création. Trois cartes, chacune
  // avec une miniature qui montre où l'élément se place, une phrase « quand choisir », un exemple et son bouton : une
  // manifestation (l'assistant, US-047), « Compléter » (ajouter une compétition ou des épreuves à ce qui existe) et une
  // compétition seule (formulaire en une étape, US-045 CA-4). Hors ligne, la page s'affiche : les créations qui exigent le
  // serveur (manifestation, compétition seule, nouvelle compétition) sont grisées, l'ajout d'épreuves reste possible
  // dans une compétition connue de l'appareil (US-025, US-045). Le choix de « Compléter » vient du domaine (`creer.ts`).
  import { onMount } from 'svelte';
  import {
    actionsCompleter,
    LIMITE_OPTIONS_COMPLETER,
    optionsCompleter,
    rienACompleter,
    type ChoixCompleter,
  } from '@poule-position/domaine';
  import FilAriane from '../composants/FilAriane.svelte';
  import Lien from '../composants/Lien.svelte';
  import { filSousAccueil } from '../lib/fil-ariane';
  import Niveaux from '../composants/Niveaux.svelte';
  import type { Accueil, DonneesAccueil } from '../lib/accueil';
  import {
    cheminGrilleEpreuves,
    cheminNouvelleCompetition,
    CHEMIN_NOUVELLE_COMPETITION_SEULE,
    CHEMINS,
  } from '../lib/routes';
  import { textes } from '../lib/textes';

  interface Proprietes {
    accueil: Accueil;
    naviguer: (chemin: string) => void;
  }

  let { accueil, naviguer }: Proprietes = $props();

  const t = textes.creer;
  const tc = t.completer;

  let horsLigne = $state(!navigator.onLine);
  let donnees = $state<DonneesAccueil | null>(null);
  let recherche = $state('');
  let choix = $state<ChoixCompleter | null>(null);

  const rien = $derived(donnees !== null && rienACompleter(donnees));
  const resultat = $derived(donnees ? optionsCompleter(donnees, recherche) : { options: [], total: 0 });
  const actions = $derived(donnees && choix ? actionsCompleter(donnees, choix, !horsLigne) : []);
  /** Nom du choix en cours, lu dans les données (le choix reste valable même si la recherche change). */
  const nomDuChoix = $derived(
    choix === null || donnees === null
      ? ''
      : ((choix.type === 'manifestation' ? donnees.manifestations : donnees.competitions).find(
          ({ id }) => id === choix?.id,
        )?.nom ?? ''),
  );

  async function charger() {
    donnees = await accueil.charger();
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

<main>
  <FilAriane niveaux={filSousAccueil(t.bouton, [], textes.entete.accueil)} {naviguer} />
  <h1>{t.titre}</h1>
  <p class="intro">{t.intro}</p>
  <p><Lien chemin={CHEMINS.aideOrganisation} {naviguer}>{t.lienAide}</Lien></p>

  <div class="cartes" role="group" aria-label={t.cartes}>
    <!-- CA-2 : « Une manifestation » (le plus courant) ouvre l'assistant. -->
    <section class="carte" aria-labelledby="carte-manifestation">
      <Niveaux variante="manifestation" etiquette={t.manifestation.miniature} />
      <h2 id="carte-manifestation">{t.manifestation.titre}</h2>
      <p class="etiquette">{t.manifestation.etiquette}</p>
      <p><strong>{t.quand}</strong> : {t.manifestation.quand}</p>
      <p><strong>{t.exemple}</strong> : {t.manifestation.exemple}</p>
      {#if horsLigne}
        <span class="inactive" aria-disabled="true">{t.manifestation.bouton}<small>{t.horsLigne}</small></span>
      {:else}
        <Lien chemin={CHEMINS.assistantManifestation} {naviguer}>{t.manifestation.bouton}</Lien>
      {/if}
    </section>

    <!-- CA-2 : « Compléter » choisit une manifestation ou une compétition existante, puis ce qu'on y ajoute. -->
    <section class="carte" aria-labelledby="carte-completer">
      <Niveaux variante="completer" etiquette={tc.miniature} />
      <h2 id="carte-completer">{tc.titre}</h2>
      <p><strong>{t.quand}</strong> : {tc.quand}</p>
      <p><strong>{t.exemple}</strong> : {tc.exemple}</p>
      {#if donnees === null}
        <p role="status" class="discret">{tc.chargement}</p>
      {:else if rien}
        <!-- Cas limite : un club vide n'a rien à compléter. -->
        <span class="inactive" aria-disabled="true">{tc.titre}<small>{tc.rienACompleter}</small></span>
      {:else}
        {#if horsLigne}<p class="discret" role="status">{tc.horsLigne}</p>{/if}
        <label>
          {tc.rechercher}
          <input type="search" bind:value={recherche} placeholder={tc.placeholder} autocomplete="off" />
        </label>
        <ul class="resultats" aria-label={tc.resultats}>
          {#each resultat.options as option (`${option.type}-${option.id}`)}
            <li>
              <button
                type="button"
                class="choix"
                aria-pressed={choix?.id === option.id && choix.type === option.type}
                aria-label={tc.choisir(option.nom)}
                onclick={() => (choix = { type: option.type, id: option.id })}
              >
                <span>{option.nom}</span>
                <small>
                  {tc.types[option.type]}{#if option.manifestation}, {tc.dans(option.manifestation)}{/if}
                </small>
              </button>
            </li>
          {:else}
            <li class="discret" role="status">{tc.aucunResultat}</li>
          {/each}
        </ul>
        {#if resultat.total > LIMITE_OPTIONS_COMPLETER}
          <p class="discret" role="status">{tc.limite(resultat.options.length, resultat.total)}</p>
        {/if}
        {#if choix}
          <div class="actions" role="group" aria-label={tc.actionsDe(nomDuChoix)}>
            {#each actions as action (action.genre === 'competition' ? `c-${action.manifestationId}` : `e-${action.competitionId}`)}
              {#if action.genre === 'competition'}
                <Lien
                  chemin={cheminNouvelleCompetition(action.manifestationId)}
                  {naviguer}
                  etiquette={textes.listeClub.nouvelleCompetitionDans(nomDuChoix)}
                  >{textes.listeClub.nouvelleCompetition}</Lien
                >
              {:else}
                <Lien
                  chemin={cheminGrilleEpreuves(action.competitionId)}
                  {naviguer}
                  etiquette={textes.epreuves.grille.ajouterA(action.nom)}>{textes.epreuves.grille.ajouter}</Lien
                >
              {/if}
            {:else}
              <p class="discret" role="status">{tc.aucuneAction}</p>
            {/each}
          </div>
        {/if}
      {/if}
    </section>

    <!-- CA-2 : « Une compétition seule » (un challenge) ouvre le formulaire en une étape (US-045 CA-4). -->
    <section class="carte" aria-labelledby="carte-seule">
      <Niveaux variante="seule" etiquette={t.seule.miniature} />
      <h2 id="carte-seule">{t.seule.titre}</h2>
      <p><strong>{t.quand}</strong> : {t.seule.quand}</p>
      <p><strong>{t.exemple}</strong> : {t.seule.exemple}</p>
      {#if horsLigne}
        <span class="inactive" aria-disabled="true">{t.seule.bouton}<small>{t.horsLigne}</small></span>
      {:else}
        <Lien chemin={CHEMIN_NOUVELLE_COMPETITION_SEULE} {naviguer}>{t.seule.bouton}</Lien>
      {/if}
    </section>
  </div>
</main>

<style>
  main {
    display: grid;
    gap: 0.75rem;
    width: min(100%, 64rem);
    margin: 0 auto;
    padding: 2rem 1rem 4rem;
  }

  h1,
  p {
    margin: 0;
  }

  .intro {
    color: var(--texte-discret);
  }

  .cartes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
    gap: 1rem;
    align-items: start;
    margin-top: 0.5rem;
  }

  .carte {
    display: grid;
    gap: 0.6rem;
    padding: 1rem;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--surface);
  }

  h2 {
    margin: 0;
    font-size: 1.15rem;
  }

  .etiquette {
    justify-self: start;
    padding: 0.1rem 0.6rem;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--texte);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .discret,
  small {
    color: var(--texte-discret);
    font-weight: 400;
  }

  .inactive {
    display: grid;
    color: var(--texte-discret);
    font-weight: 600;
  }

  label {
    display: grid;
    gap: 0.25rem;
    font-weight: 600;
  }

  input[type='search'] {
    padding: 0.55rem 0.65rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte);
    font: inherit;
    font-weight: 400;
  }

  .resultats {
    display: grid;
    gap: 0.35rem;
    max-height: 14rem;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  }

  .choix {
    display: grid;
    width: 100%;
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .choix[aria-pressed='true'] {
    border-color: var(--accent);
    box-shadow: inset 0.25rem 0 0 var(--accent);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
  }
</style>
