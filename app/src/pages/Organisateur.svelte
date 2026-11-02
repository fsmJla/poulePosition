<script lang="ts">
  // Accueil de l'organisateur (US-003 CA-1), page réservée : nom et rôle du compte connecté, et la gestion des comptes
  // pour un administrateur (US-007, grisée hors ligne). Le profil (US-016) et la déconnexion (US-003 CA-5) sont dans le
  // menu de compte de l'entête (US-017). « Nouvelle compétition » pour tout compte (US-025).
  import { onMount } from 'svelte';
  import type { SessionAppareil } from '../lib/stockage';
  import Lien from '../composants/Lien.svelte';
  import { CHEMINS } from '../lib/routes';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: SessionAppareil;
    naviguer: (chemin: string) => void;
  }

  let { session, naviguer }: Proprietes = $props();

  let horsLigne = $state(!navigator.onLine);

  onMount(() => {
    const surReseau = () => (horsLigne = !navigator.onLine);
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    return () => {
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
    };
  });
</script>

<main>
  <h1>{textes.organisateur.bonjour(session.compte.nom)}</h1>
  <p class="role">{textes.roles[session.compte.role]}</p>
  <!-- Le profil et la déconnexion sont dans le menu de compte de l'entête (US-017). -->
  <nav class="actions" aria-label={textes.organisateur.actions}>
    <!-- US-025 : la création d'une compétition fonctionne aussi hors ligne. La liste viendra avec US-026. -->
    <Lien chemin={CHEMINS.nouvelleCompetition} {naviguer}>{textes.competitions.nouvelle}</Lien>
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
    display: grid;
    gap: 0.75rem;
    justify-items: center;
  }

  /* Entrée grisée hors ligne (US-007) : visible, mais sans lien. */
  .inactive {
    display: grid;
    color: var(--texte-discret);
    font-weight: 600;
  }

  .inactive small {
    font-weight: 400;
  }
</style>
