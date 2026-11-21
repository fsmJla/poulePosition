<script lang="ts">
  // Lien public d'une épreuve (US-031 CA-4, ADR-0007) : accessible sans connexion tant que l'épreuve est publiée,
  // sinon « Cette épreuve n'est pas publiée ». Le suivi en direct (poules, tableau) viendra avec E9 : cette page n'affiche
  // pour l'instant que l'épreuve elle-même, jamais de donnée de tireur (CA-5). US-137 : le suivi en direct s'y ajoute.
  import { onMount } from 'svelte';
  import type { EpreuvePublique } from '@poule-position/domaine';
  import Banniere from '../composants/Banniere.svelte';
  import SuiviDirect from '../composants/SuiviDirect.svelte';
  import Lien from '../composants/Lien.svelte';
  import type { ClientPublic, ErreurPublic } from '../lib/publication';
  import { CHEMINS } from '../lib/routes';
  import { textes } from '../lib/textes';

  interface Proprietes {
    client: ClientPublic;
    epreuveId: string;
    /** US-137 : adresse WebSocket du serveur, pour la vue en direct. */
    urlServeur?: string | undefined;
    naviguer: (chemin: string) => void;
  }

  let { client, epreuveId, urlServeur, naviguer }: Proprietes = $props();

  const t = textes.accueilPublic;
  const te = textes.epreuves;

  let epreuve: EpreuvePublique | null = $state(null);
  let refus: ErreurPublic | 'NON_PUBLIEE' | null = $state(null);
  let chargement = $state(true);

  async function charger() {
    chargement = true;
    const resultat = await client.epreuve(epreuveId);
    if (resultat.ok) {
      epreuve = resultat.epreuve;
      refus = null;
    } else {
      epreuve = null;
      refus = resultat.erreur;
    }
    chargement = false;
  }

  onMount(() => {
    void charger();
    const surReseau = () => void charger();
    window.addEventListener('online', surReseau);
    return () => window.removeEventListener('online', surReseau);
  });

  const message = $derived(
    refus === 'NON_PUBLIEE' ? t.direct.nonPubliee : refus === 'HORS_LIGNE' ? t.injoignable : t.erreur,
  );
</script>

<main>
  <h1><Banniere variante="login" hauteur={120} /></h1>
  {#if chargement && !epreuve && !refus}
    <p class="discret" role="status">{t.direct.chargement}</p>
  {:else if epreuve}
    <h2>{epreuve.nom}</h2>
    <dl>
      <dt>{te.arme}</dt>
      <dd>{te.armes[epreuve.arme]}</dd>
      {#if epreuve.categorie}
        <dt>{te.categorie}</dt>
        <dd>{epreuve.categorie}</dd>
      {/if}
      {#if epreuve.sexe}
        <dt>{te.sexe}</dt>
        <dd>{te.sexes[epreuve.sexe]}</dd>
      {/if}
      {#if epreuve.date}
        <dt>{te.date}</dt>
        <dd>{te.dateLongue(epreuve.date)}</dd>
      {/if}
      {#each ['appel', 'scratch', 'debutPoules'] as const as champ (champ)}
        {#if epreuve.horaires[champ]}
          <dt>{te[champ]}</dt>
          <dd>{epreuve.horaires[champ]}</dd>
        {/if}
      {/each}
      {#if epreuve.lieu}
        <dt>{te.lieu}</dt>
        <dd>{epreuve.lieu}</dd>
      {/if}
    </dl>
    <SuiviDirect
      {epreuveId}
      {urlServeur}
      surNonPubliee={() => {
        epreuve = null;
        refus = 'NON_PUBLIEE';
      }}
    />
  {:else}
    <p class="message" role="alert">{message}</p>
    {#if refus !== 'NON_PUBLIEE'}
      <button type="button" class="secondaire" onclick={charger}>{t.reessayer}</button>
    {/if}
  {/if}
  <Lien chemin={CHEMINS.accueil} {naviguer}>{t.direct.accueil}</Lien>
</main>

<style>
  main {
    display: grid;
    justify-items: center;
    gap: 0.75rem;
    padding: 3rem 1rem;
    text-align: center;
  }

  h1 {
    display: flex;
    justify-content: center;
    margin: 0;
  }

  h2 {
    margin: 0;
  }

  dl {
    display: grid;
    grid-template-columns: auto auto;
    gap: 0.3rem 1rem;
    margin: 0;
    text-align: left;
  }

  dt {
    color: var(--texte-discret);
  }

  dd {
    margin: 0;
  }

  .discret {
    margin: 0;
    color: var(--texte-discret);
  }

  .message {
    margin: 0;
    color: var(--etat-erreur);
  }
</style>
