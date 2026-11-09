<script lang="ts">
  // Accueil public (US-003 CA-6), issu de la page minimale du walking skeleton (US-001) : bannière « Poule Position »
  // et sous-titre (US-014), état de la connexion au serveur et lien vers la connexion.
  import { onMount } from 'svelte';
  import Banniere from '../composants/Banniere.svelte';
  import Lien from '../composants/Lien.svelte';
  import { demarrerConnexion, urlConnexion, type EtatConnexion } from '../lib/connexion';
  import { CHEMINS } from '../lib/routes';
  import { textes } from '../lib/textes';

  interface Proprietes {
    /** Adresse WebSocket du serveur (`VITE_URL_SERVEUR`). */
    urlServeur: string | undefined;
    connecte: boolean;
    naviguer: (chemin: string) => void;
  }

  let { urlServeur, connecte, naviguer }: Proprietes = $props();

  /** Épreuve de démonstration, en attendant les vraies épreuves (E2). */
  const EPREUVE_DEMO = 'demo';

  let etat: EtatConnexion = $state('connexion');

  onMount(
    () =>
      demarrerConnexion({
        url: urlConnexion(urlServeur, EPREUVE_DEMO),
        surEtat: (nouvelEtat) => (etat = nouvelEtat),
      }).arreter,
  );
</script>

<main>
  <h1><Banniere variante="login" hauteur={190} /></h1>
  <p class="sous-titre">{textes.sousTitre}</p>
  <p class="etat" data-etat={etat} role="status">
    <span class="pastille" aria-hidden="true"></span>{textes.etats[etat]}
  </p>
  {#if connecte}
    <Lien chemin={CHEMINS.organisateur} {naviguer}>{textes.accueil.espaceOrganisateur}</Lien>
  {:else}
    <Lien chemin={CHEMINS.connexion} {naviguer}>{textes.accueil.seConnecter}</Lien>
  {/if}
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

  .etat {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin: 1.5rem 0 1rem;
    padding: 0.4rem 0.9rem;
    border-radius: 999px;
    background: var(--surface);
    font-size: 0.9rem;
  }

  .pastille {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    background: var(--etat-attente);
  }

  [data-etat='connecte'] .pastille {
    background: var(--etat-ok);
  }

  [data-etat='injoignable'] .pastille,
  [data-etat='non-configure'] .pastille {
    background: var(--etat-erreur);
  }
</style>
