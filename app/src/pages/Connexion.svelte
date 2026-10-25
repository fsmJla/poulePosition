<script lang="ts">
  // Écran de connexion (US-003) : e-mail et mot de passe, connexion en ligne uniquement. Hors ligne, il l'indique ;
  // la reconnexion sur un appareil déjà utilisé viendra avec US-005.
  import { onMount } from 'svelte';
  import Lien from '../composants/Lien.svelte';
  import { CHEMINS } from '../lib/routes';
  import type { ClientSession, ErreurConnexion } from '../lib/session';
  import { textes } from '../lib/textes';
  import type { Session } from '@poule-position/protocole';

  interface Proprietes {
    client: ClientSession;
    surConnexion: (session: Session) => void;
    naviguer: (chemin: string) => void;
  }

  let { client, surConnexion, naviguer }: Proprietes = $props();

  let email = $state('');
  let motDePasse = $state('');
  let enCours = $state(false);
  let erreur: ErreurConnexion | null = $state(null);
  let horsLigne = $state(!navigator.onLine);

  const complet = $derived(email.trim() !== '' && motDePasse !== '');

  onMount(() => {
    const surReseau = () => (horsLigne = !navigator.onLine);
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    return () => {
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
    };
  });

  async function valider(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (!complet || enCours) return;
    enCours = true;
    erreur = null;
    try {
      const resultat = await client.seConnecter(email, motDePasse);
      if (resultat.ok) surConnexion(resultat.session);
      else erreur = resultat.erreur;
    } finally {
      enCours = false;
    }
  }

  const message = $derived(erreur ? textes.connexion.erreurs[erreur] : horsLigne ? textes.connexion.horsLigne : null);
</script>

<main>
  <h1>{textes.connexion.titre}</h1>
  <form onsubmit={valider}>
    <label>
      {textes.connexion.email}
      <input type="email" name="email" autocomplete="username" required bind:value={email} disabled={enCours} />
    </label>
    <label>
      {textes.connexion.motDePasse}
      <input
        type="password"
        name="mot-de-passe"
        autocomplete="current-password"
        required
        bind:value={motDePasse}
        disabled={enCours}
      />
    </label>
    {#if message}
      <p class="message" role="alert">{message}</p>
    {/if}
    <button type="submit" disabled={!complet || enCours}>
      {enCours ? textes.connexion.enCours : textes.connexion.valider}
    </button>
  </form>
  <Lien chemin={CHEMINS.accueil} {naviguer}>{textes.connexion.retour}</Lien>
</main>

<style>
  main {
    display: grid;
    justify-items: center;
    gap: 1.25rem;
    padding: 4rem 1rem;
  }

  h1 {
    margin: 0;
  }

  form {
    display: grid;
    gap: 1rem;
    width: min(100%, 22rem);
  }

  label {
    display: grid;
    gap: 0.3rem;
    font-weight: 600;
  }

  input {
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte);
    font: inherit;
  }

  button {
    padding: 0.7rem;
    border: none;
    border-radius: var(--rayon);
    background: var(--accent-fond);
    color: var(--sur-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .message {
    margin: 0;
    padding: 0.6rem 0.75rem;
    border-left: 4px solid var(--etat-erreur);
    background: var(--surface);
  }
</style>
