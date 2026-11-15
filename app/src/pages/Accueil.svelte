<script lang="ts">
  // Accueil public (US-003 CA-6, US-031) : bannière « Poule Position », lien vers la connexion et épreuves publiées,
  // regroupées par manifestation puis par compétition. Les données viennent du serveur (`GET /public`) : un visiteur n'a
  // pas de mode hors ligne, la page le dit et recharge au retour du réseau. Aucune donnée de tireur (CA-5).
  import { onMount } from 'svelte';
  import type { CompetitionPublique, EpreuvePublique, PagePublique } from '@poule-position/domaine';
  import type { FichierPublic } from '@poule-position/protocole';
  import Banniere from '../composants/Banniere.svelte';
  import Lien from '../composants/Lien.svelte';
  import { fichiersEffectifs } from '../lib/fichiers';
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

  /** CA-3 : affiche et feuille de route de l'épreuve, reprises de sa compétition puis de sa manifestation. */
  function documentsDe(epreuve: EpreuvePublique, competitionId: string, manifestationId: string | null) {
    return fichiersEffectifs(fichiers, [
      { proprietaire: 'epreuve', id: epreuve.id },
      { proprietaire: 'competition', id: competitionId },
      { proprietaire: 'manifestation', id: manifestationId },
    ]);
  }

  const detail = (epreuve: EpreuvePublique) =>
    [
      te.armes[epreuve.arme],
      epreuve.categorie,
      epreuve.sexe ? te.sexes[epreuve.sexe] : null,
      epreuve.date ? te.dateLongue(epreuve.date) : null,
    ].filter(Boolean);

  const horaires = (epreuve: EpreuvePublique) =>
    (['appel', 'scratch', 'debutPoules'] as const)
      .filter((champ) => epreuve.horaires[champ])
      .map((champ) => `${te[champ]} ${epreuve.horaires[champ]}`);
</script>

{#snippet competition(noeud: CompetitionPublique, manifestationId: string | null)}
  <section class="competition" aria-label={noeud.competition.nom}>
    <h4>{noeud.competition.nom}</h4>
    <ul>
      {#each noeud.epreuves as epreuve (epreuve.id)}
        {@const documents = documentsDe(epreuve, noeud.competition.id, manifestationId)}
        <li>
          <div class="texte">
            <strong>{epreuve.nom}</strong>
            <span class="discret">{detail(epreuve).join(' · ')}</span>
            {#if horaires(epreuve).length > 0}<span class="discret">{horaires(epreuve).join(' · ')}</span>{/if}
            {#if epreuve.lieu}<span class="discret">{epreuve.lieu}</span>{/if}
            <span class="liens">
              {#if documents.feuilleDeRoute}
                <a href={client.adresseFichier(documents.feuilleDeRoute.nom)} target="_blank" rel="noopener"
                  >{t.feuilleDeRoute}</a
                >
              {/if}
              <Lien chemin={cheminDirect(epreuve.id)} {naviguer}>{t.voir}</Lien>
            </span>
          </div>
          {#if documents.affiche}
            <img src={client.adresseFichier(documents.affiche.nom)} alt={t.affiche(epreuve.nom)} loading="lazy" />
          {/if}
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
        <article class="manifestation">
          <h3>{manifestation.nom}</h3>
          <p class="discret">
            {t.jours(manifestation.debut, manifestation.fin)}{manifestation.lieu ? ` · ${manifestation.lieu}` : ''}
          </p>
          {#each competitions as noeud (noeud.competition.id)}
            {@render competition(noeud, manifestation.id)}
          {/each}
        </article>
      {/each}
      {#if page.competitionsSeules.length > 0}
        <article class="manifestation">
          <h3>{t.competitionsSeules}</h3>
          {#each page.competitionsSeules as noeud (noeud.competition.id)}
            {@render competition(noeud, null)}
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
    gap: 0.5rem;
    padding: 1rem;
    border: 1px solid var(--bordure);
    border-radius: 0.6rem;
    background: var(--surface);
  }

  .competition {
    display: grid;
    gap: 0.4rem;
    margin-top: 0.5rem;
  }

  ul {
    display: grid;
    gap: 0.6rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    border-radius: 0.4rem;
    background: var(--fond);
  }

  .texte {
    display: grid;
    gap: 0.15rem;
  }

  .liens {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
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
</style>
