<script lang="ts">
  // Mot de passe oublié (US-019 CA-1), page publique : demande d'un lien de réinitialisation par e-mail. Le message
  // est le même que le compte existe ou non (CA-2). La demande exige le réseau.
  import { onMount } from 'svelte';
  import { validerEmail } from '@poule-position/domaine';
  import Lien from '../composants/Lien.svelte';
  import { CHEMINS } from '../lib/routes';
  import type { ClientSession, ErreurDemandeLien } from '../lib/session';
  import { textes } from '../lib/textes';

  interface Proprietes {
    client: ClientSession;
    naviguer: (chemin: string) => void;
  }

  let { client, naviguer }: Proprietes = $props();

  const t = textes.oubli;

  let email = $state('');
  let enCours = $state(false);
  let envoye = $state(false);
  let erreur: ErreurDemandeLien | null = $state(null);
  let horsLigne = $state(!navigator.onLine);

  const valide = $derived(validerEmail(email) === null);

  onMount(() => {
    const surReseau = () => (horsLigne = !navigator.onLine);
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    return () => {
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
    };
  });

  async function demander(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (!valide || enCours || horsLigne) return;
    enCours = true;
    erreur = null;
    try {
      const resultat = await client.demanderReinitialisation(email);
      if (resultat.ok) envoye = true;
      else erreur = resultat.erreur;
    } finally {
      enCours = false;
    }
  }
</script>

<main>
  <h1>{t.titre}</h1>
  {#if envoye}
    <p class="succes" role="status">{t.envoye}</p>
  {:else}
    <p class="texte">{t.explication}</p>
    <form onsubmit={demander} novalidate>
      <div class="champ">
        <label for="email-oubli">{t.email}</label>
        <input id="email-oubli" type="email" autocomplete="username" bind:value={email} disabled={enCours} />
      </div>
      {#if horsLigne || erreur}
        <p class="message" role="alert">{horsLigne ? t.horsLigne : t.erreurs[erreur as ErreurDemandeLien]}</p>
      {/if}
      <button type="submit" disabled={!valide || enCours || horsLigne}>{enCours ? t.enCours : t.valider}</button>
    </form>
  {/if}
  <p class="texte discret">{t.administrateur}</p>
  <Lien chemin={CHEMINS.connexion} {naviguer}>{t.retour}</Lien>
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
    text-align: center;
  }

  .texte {
    width: min(100%, 22rem);
    margin: 0;
  }

  .discret {
    color: var(--texte-discret);
    font-size: 0.9rem;
  }

  form {
    display: grid;
    gap: 1rem;
    width: min(100%, 22rem);
  }

  .champ {
    display: grid;
    gap: 0.3rem;
  }

  label {
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

  .message,
  .succes {
    width: min(100%, 22rem);
    margin: 0;
    padding: 0.6rem 0.75rem;
    background: var(--surface);
  }

  .message {
    border-left: 4px solid var(--etat-erreur);
  }

  .succes {
    border-left: 4px solid var(--etat-ok);
  }
</style>
