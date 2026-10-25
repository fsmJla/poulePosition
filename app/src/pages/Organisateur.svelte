<script lang="ts">
  // Accueil de l'organisateur (US-003 CA-1), page réservée : nom et rôle du compte connecté, déconnexion (CA-5),
  // changement de mot de passe (US-010).
  import type { Session } from '@poule-position/protocole';
  import Lien from '../composants/Lien.svelte';
  import { CHEMINS } from '../lib/routes';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: Session;
    surDeconnexion: () => void;
    naviguer: (chemin: string) => void;
  }

  let { session, surDeconnexion, naviguer }: Proprietes = $props();
</script>

<main>
  <h1>{textes.organisateur.bonjour(session.compte.nom)}</h1>
  <p class="role">{textes.roles[session.compte.role]}</p>
  <Lien chemin={CHEMINS.motDePasse} {naviguer}>{textes.organisateur.changerMotDePasse}</Lien>
  <button type="button" onclick={surDeconnexion}>{textes.organisateur.seDeconnecter}</button>
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

  button {
    padding: 0.6rem 1.2rem;
    border: 1px solid var(--accent);
    border-radius: 0.4rem;
    background: transparent;
    color: var(--accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
</style>
