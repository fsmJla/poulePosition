<script lang="ts">
  // Accueil de l'organisateur (US-003 CA-1), page réservée : nom et rôle du compte connecté, changement de mot de
  // passe (US-010). La déconnexion (US-003 CA-5) est dans l'entête commun (US-014).
  import type { Session } from '@poule-position/protocole';
  import Lien from '../composants/Lien.svelte';
  import { CHEMINS } from '../lib/routes';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: Session;
    naviguer: (chemin: string) => void;
  }

  let { session, naviguer }: Proprietes = $props();
</script>

<main>
  <h1>{textes.organisateur.bonjour(session.compte.nom)}</h1>
  <p class="role">{textes.roles[session.compte.role]}</p>
  <Lien chemin={CHEMINS.motDePasse} {naviguer}>{textes.organisateur.changerMotDePasse}</Lien>
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
</style>
