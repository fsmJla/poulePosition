<script lang="ts">
  // Accueil public (US-003 CA-6, US-031, US-079) : bannière « Poule Position », lien vers la connexion et épreuves
  // publiées, regroupées par manifestation puis par compétition. Les données viennent du serveur (`GET /public`) : un
  // visiteur n'a pas de mode hors ligne, la page le dit et recharge au retour du réseau. Aucune donnée de tireur (CA-5).
  // US-079 : la manifestation porte sa ville et son adresse une seule fois ; chaque épreuve est une ligne courte en
  // colonnes ; l'affiche et la feuille de route s'affichent au niveau où elles sont jointes.
  import { onMount } from 'svelte';
  import {
    couleurDeCompetition,
    lienOpenStreetMap,
    lieuAEcrire,
    lieuCommun,
    nomsCourts,
    villeDeLieu,
    type CompetitionPublique,
    type EpreuvePublique,
    type PagePublique,
    type ProprietaireFichier,
  } from '@poule-position/domaine';
  import type { FichierPublic } from '@poule-position/protocole';
  import Banniere from '../composants/Banniere.svelte';
  import Icone from '../composants/Icone.svelte';
  import Lien from '../composants/Lien.svelte';
  import { fichiersPropres } from '../lib/fichiers';
  import type { ClientPublic, ErreurPublic } from '../lib/publication';
  import { cheminDirect, CHEMINS } from '../lib/routes';
  import { textes } from '../lib/textes';

  interface Proprietes {
    client: ClientPublic;
    connecte: boolean;
    naviguer: (chemin: string) => void;
  }

  let { client, connecte, naviguer }: Proprietes = $props();

  const t = textes.accueilPublic;
  const te = textes.epreuves;

  let page = $state<PagePublique | null>(null);
  let fichiers: FichierPublic[] = $state([]);
  let erreur: ErreurPublic | null = $state(null);
  let chargement = $state(true);

  async function charger() {
    chargement = true;
    const resultat = await client.page();
    if (resultat.ok) {
      page = resultat.page;
      fichiers = resultat.fichiers;
      erreur = null;
    } else {
      erreur = resultat.erreur;
    }
    chargement = false;
  }

  onMount(() => {
    void charger();
    const surReseau = () => void charger();
    window.addEventListener('online', surReseau);
    return () => window.removeEventListener('online', surReseau);
  });

  const vide = $derived(page !== null && page.manifestations.length === 0 && page.competitionsSeules.length === 0);

  /** CA-8 : l'affiche et la feuille de route que porte un élément lui-même (sans héritage). */
  const documentsDe = (proprietaire: ProprietaireFichier, id: string) => fichiersPropres(fichiers, proprietaire, id);

  /** CA-7 : « Appel 09:00 · Scratch 09:15 · Début des poules 09:30 ». */
  const horaires = (epreuve: EpreuvePublique) =>
    (['appel', 'scratch', 'debutPoules'] as const)
      .filter((champ) => epreuve.horaires[champ])
      .map((champ) => `${te[champ]} ${epreuve.horaires[champ]}`)
      .join(' · ');
</script>

<!-- CA-10 : le lieu ouvre OpenStreetMap ; avec un texte (la ville) ou seul (icône avec nom accessible et infobulle). -->
{#snippet lienLieu(lieu: string, texte: string | null)}
  <a
    class="lieu"
    class:seule={texte === null}
    href={lienOpenStreetMap(lieu)}
    target="_blank"
    rel="noopener"
    aria-label={t.voirSurCarte(lieu)}
    title={t.voirSurCarte(lieu)}
    ><Icone nom="lieu" taille={18} />{#if texte}<span>{texte}</span>{/if}</a
  >
{/snippet}

{#snippet documents(proprietaire: ProprietaireFichier, id: string, nom: string)}
  {@const propres = documentsDe(proprietaire, id)}
  {#if propres.feuilleDeRoute}
    <a class="feuille" href={client.adresseFichier(propres.feuilleDeRoute.nom)} target="_blank" rel="noopener"
      >{t.feuilleDeRoute}</a
    >
  {/if}
  {#if propres.affiche}
    <img src={client.adresseFichier(propres.affiche.nom)} alt={t.affiche(nom)} loading="lazy" />
  {/if}
{/snippet}

<!-- CA-7 à CA-9 : la compétition en intertitre, ses épreuves en lignes courtes ; `lieuParent` est celui de la manifestation. -->
{#snippet competition(noeud: CompetitionPublique, lieuParent: string | null, couleur: number)}
  {@const courts = nomsCourts(noeud.epreuves, te.sexes)}
  {@const arme = noeud.competition.arme}
  <!-- Cas limite : une compétition seule écrit une fois le lieu commun de ses épreuves. -->
  {@const lieuDeLaCompetition = lieuAEcrire(lieuCommun(noeud.epreuves.map(({ lieu }) => lieu)), lieuParent)}
  {@const lieuDesLignes = lieuDeLaCompetition ?? lieuParent}
  <section class="competition" aria-label={noeud.competition.nom} style="--couleur: var(--plan-{couleur})">
    <div class="intertitre">
      <span class="carre" aria-hidden="true"></span>
      <h4>
        {noeud.competition.nom}{#if arme}<span class="arme">{` · ${te.armes[arme]}`}</span>{/if}
      </h4>
      <span class="documents">{@render documents('competition', noeud.competition.id, noeud.competition.nom)}</span>
    </div>
    {#if lieuDeLaCompetition}<p class="adresse">{@render lienLieu(lieuDeLaCompetition, lieuDeLaCompetition)}</p>{/if}
    <ul>
      {#each noeud.epreuves as epreuve (epreuve.id)}
        {@const lieu = lieuAEcrire(epreuve.lieu, lieuDesLignes)}
        <li>
          <Lien chemin={cheminDirect(epreuve.id)} {naviguer} etiquette={t.voirEpreuve(epreuve.nom)}>
            <span class="ligne">
              <span class="nom"
                >{courts.get(epreuve.id) ?? epreuve.nom}{#if !arme}<span class="arme"
                    >{` · ${te.armes[epreuve.arme]}`}</span
                  >{/if}</span
              >
              <span class="jour">{epreuve.date ? t.jourCourt(epreuve.date) : ''}</span>
              <span class="horaires">{horaires(epreuve)}</span>
              <span class="chevron" aria-hidden="true"><Icone nom="chevron" taille={18} /></span>
            </span>
          </Lien>
          {#if lieu}<p class="adresse ligne-lieu">{@render lienLieu(lieu, lieu)}</p>{/if}
          <span class="documents">{@render documents('epreuve', epreuve.id, epreuve.nom)}</span>
        </li>
      {/each}
    </ul>
  </section>
{/snippet}

<main>
  <h1><Banniere variante="login" hauteur={190} /></h1>
  <p class="sous-titre">{textes.sousTitre}</p>
  {#if connecte}
    <Lien chemin={CHEMINS.organisateur} {naviguer}>{textes.accueil.espaceOrganisateur}</Lien>
  {:else}
    <Lien chemin={CHEMINS.connexion} {naviguer}>{textes.accueil.seConnecter}</Lien>
  {/if}

  <section class="epreuves" aria-label={t.titre}>
    <h2>{t.titre}</h2>
    {#if chargement && page === null}
      <p class="discret" role="status">{t.chargement}</p>
    {:else if erreur && page === null}
      <p class="message" role="alert">{erreur === 'HORS_LIGNE' ? t.injoignable : t.erreur}</p>
      <button type="button" class="secondaire" onclick={charger}>{t.reessayer}</button>
    {:else if vide}
      <p class="discret" role="status">{t.aucune}</p>
    {:else if page}
      {#each page.manifestations as { manifestation, competitions } (manifestation.id)}
        {@const ville = villeDeLieu(manifestation.lieu)}
        {@const listees = competitions.map(({ competition }) => competition)}
        <article class="manifestation" aria-label={manifestation.nom}>
          <!-- CA-6 : le nom et la ville sur la même ligne, puis les dates en toutes lettres et l'adresse, une seule fois. -->
          <header>
            <div class="identite">
              <div class="titre">
                <h3>{manifestation.nom}</h3>
                {#if manifestation.lieu && ville}{@render lienLieu(manifestation.lieu, ville)}{/if}
              </div>
              <p class="discret">{t.periode(manifestation.debut, manifestation.fin)}</p>
              {#if manifestation.lieu}
                <p class="discret adresse">
                  {#if !ville}{@render lienLieu(manifestation.lieu, null)}{/if}{manifestation.lieu}
                </p>
              {/if}
            </div>
            <span class="documents">{@render documents('manifestation', manifestation.id, manifestation.nom)}</span>
          </header>
          {#each competitions as noeud (noeud.competition.id)}
            {@render competition(noeud, manifestation.lieu, couleurDeCompetition(listees, noeud.competition.id))}
          {/each}
        </article>
      {/each}
      {#if page.competitionsSeules.length > 0}
        {@const seules = page.competitionsSeules.map(({ competition }) => competition)}
        <article class="manifestation" aria-label={t.competitionsSeules}>
          <header><h3>{t.competitionsSeules}</h3></header>
          {#each page.competitionsSeules as noeud (noeud.competition.id)}
            {@render competition(noeud, null, couleurDeCompetition(seules, noeud.competition.id))}
          {/each}
        </article>
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
    display: flex;
    justify-content: center;
    margin: 0;
  }

  /* Sous-titre de la maquette : petites majuscules espacées, sous le filet de la bannière. */
  .sous-titre {
    margin: 0;
    color: var(--texte-discret);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .epreuves {
    display: grid;
    gap: 1rem;
    width: min(100%, 46rem);
    margin-top: 2rem;
    text-align: left;
  }

  h2,
  h3,
  h4 {
    margin: 0;
  }

  h2 {
    text-align: center;
  }

  .manifestation {
    display: grid;
    gap: 1rem;
    padding: 1rem;
    border: 1px solid var(--bordure);
    border-radius: 0.6rem;
    background: var(--surface);
  }

  /* CA-6 : l'entête de la manifestation ; l'affiche à droite. */
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .identite {
    display: grid;
    flex: 1 1 18rem;
    gap: 0.2rem;
    min-width: 0;
  }

  .titre {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem 1rem;
  }

  /* CA-10 : le lien vers la carte, avec la ville, ou seul (cible de 44 px). */
  .lieu {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    min-height: 2.75rem;
    color: var(--accent);
    font-weight: 600;
  }

  .lieu.seule {
    justify-content: center;
    min-width: 2.75rem;
    vertical-align: middle;
  }

  .adresse {
    margin: 0;
  }

  .adresse .lieu {
    min-height: 0;
    font-weight: 400;
  }

  .adresse .lieu.seule {
    min-height: 2.75rem;
  }

  /* CA-7 : la compétition en intertitre, avec son carré de couleur et son arme. */
  .competition {
    display: grid;
    gap: 0.4rem;
  }

  .intertitre {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }

  .carre {
    flex: none;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 0.2rem;
    background: var(--couleur);
  }

  h4 {
    flex: 1 1 12rem;
    font-size: 1rem;
  }

  .arme {
    color: var(--texte-discret);
    font-weight: 400;
  }

  .documents {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  .documents:empty {
    display: none;
  }

  ul {
    display: grid;
    gap: 0.35rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    gap: 0.25rem;
  }

  /* CA-7 : une ligne par épreuve, en colonnes (nom, jour, horaires), toute la ligne est le lien. */
  li :global(a) {
    display: block;
    border-radius: 0.4rem;
    color: var(--texte);
    font-weight: 400;
    text-decoration: none;
  }

  .ligne {
    display: grid;
    grid-template-columns: minmax(0, 12rem) 4.5rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    min-height: 2.75rem;
    padding: 0.3rem 0.5rem 0.3rem 0.75rem;
    border-radius: 0.4rem;
    background: var(--fond);
  }

  .ligne:hover {
    background: var(--surface-2);
  }

  .nom {
    font-weight: 600;
  }

  .jour,
  .horaires {
    color: var(--texte-discret);
    font-size: 0.9rem;
  }

  .chevron {
    display: inline-flex;
    color: var(--texte-discret);
  }

  .ligne-lieu {
    padding-left: 0.75rem;
    font-size: 0.9rem;
  }

  img {
    max-width: 7rem;
    max-height: 7rem;
    border-radius: 0.4rem;
    border: 1px solid var(--bordure);
    object-fit: contain;
  }

  .discret {
    margin: 0;
    color: var(--texte-discret);
    font-size: 0.9rem;
  }

  .message {
    margin: 0;
    color: var(--etat-erreur);
    text-align: center;
  }

  /* CA-11 : sur un smartphone, chaque ligne passe sur deux lignes (nom et jour, puis horaires). */
  @media (max-width: 40rem) {
    .ligne {
      grid-template-columns: minmax(0, 1fr) auto auto;
      row-gap: 0.1rem;
    }

    .horaires {
      grid-column: 1 / 3;
      grid-row: 2;
    }

    .chevron {
      grid-column: 3;
      grid-row: 1 / 3;
    }

    header .documents {
      flex-basis: 100%;
    }
  }
</style>
