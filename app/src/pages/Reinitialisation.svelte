<script lang="ts">
  // Lien de réinitialisation (US-019 CA-3 / CA-4), page publique : le jeton est dans le fragment de l'adresse (#), qui
  // n'est jamais envoyé à un serveur. On y choisit un nouveau mot de passe (règles d'US-010), puis on est connecté
  // directement. Un lien tronqué, expiré ou déjà utilisé invite à faire une nouvelle demande. Le réseau est exigé.
  import { onMount, untrack } from 'svelte';
  import { validerNouveauMotDePasse } from '@poule-position/domaine';
  import { jetonDuFragment, type Session } from '@poule-position/protocole';
  import Lien from '../composants/Lien.svelte';
  import { CHEMINS } from '../lib/routes';
  import type { ClientSession, ErreurNouveauMotDePasseParLien } from '../lib/session';
  import { textes } from '../lib/textes';

  interface Proprietes {
    client: ClientSession;
    surConnexion: (session: Session) => void;
    naviguer: (chemin: string) => void;
  }

  let { client, surConnexion, naviguer }: Proprietes = $props();

  const t = textes.reinitialisation;
  /** Jeton du lien, lu une fois à l'ouverture de la page. */
  const jeton = untrack(() => jetonDuFragment(location.hash));

  let nouveau = $state('');
  let confirmation = $state('');
  let erreursChamps: Partial<Record<'nouveau' | 'confirmation', keyof typeof t.champs>> = $state({});
  let erreur: ErreurNouveauMotDePasseParLien | null = $state(jeton ? null : 'LIEN_INVALIDE');
  let enCours = $state(false);
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

  async function enregistrer(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (!jeton || enCours || horsLigne) return;
    erreur = null;
    const regles = validerNouveauMotDePasse(null, nouveau, confirmation);
    erreursChamps = {
      ...(regles.nouveau === 'MOT_DE_PASSE_TROP_COURT' && { nouveau: regles.nouveau }),
      ...(regles.confirmation && { confirmation: regles.confirmation }),
    };
    if (Object.keys(erreursChamps).length > 0) return;
    enCours = true;
    try {
      const resultat = await client.reinitialiserParLien(jeton, nouveau);
      if (!resultat.ok) {
        erreur = resultat.erreur;
        return;
      }
      // Le jeton ne doit pas rester dans l'adresse (historique) : il ne sert plus.
      history.replaceState(null, '', location.pathname);
      surConnexion(resultat.session);
    } finally {
      enCours = false;
    }
  }
</script>

<main>
  <h1>{t.titre}</h1>
  {#if erreur === 'LIEN_INVALIDE'}
    <p class="message" role="alert">{t.erreurs.LIEN_INVALIDE}</p>
    <Lien chemin={CHEMINS.motDePasseOublie} {naviguer}>{t.nouvelleDemande}</Lien>
  {:else}
    <form onsubmit={enregistrer} novalidate>
      <div class="champ">
        <label for="nouveau">{t.nouveau}</label>
        <input
          id="nouveau"
          type="password"
          autocomplete="new-password"
          bind:value={nouveau}
          disabled={enCours}
          aria-invalid={erreursChamps.nouveau ? 'true' : undefined}
          aria-describedby={erreursChamps.nouveau ? 'erreur-nouveau' : 'aide-nouveau'}
        />
        {#if erreursChamps.nouveau}
          <span class="erreur" id="erreur-nouveau">{t.champs[erreursChamps.nouveau]}</span>
        {:else}
          <span class="aide" id="aide-nouveau">{t.aide}</span>
        {/if}
      </div>
      <div class="champ">
        <label for="confirmation">{t.confirmation}</label>
        <input
          id="confirmation"
          type="password"
          autocomplete="new-password"
          bind:value={confirmation}
          disabled={enCours}
          aria-invalid={erreursChamps.confirmation ? 'true' : undefined}
          aria-describedby={erreursChamps.confirmation ? 'erreur-confirmation' : undefined}
        />
        {#if erreursChamps.confirmation}
          <span class="erreur" id="erreur-confirmation">{t.champs[erreursChamps.confirmation]}</span>
        {/if}
      </div>
      {#if horsLigne || erreur}
        <p class="message" role="alert">
          {horsLigne ? t.horsLigne : t.erreurs[erreur as ErreurNouveauMotDePasseParLien]}
        </p>
      {/if}
      <button type="submit" disabled={enCours || horsLigne}>{enCours ? t.enCours : t.valider}</button>
    </form>
  {/if}
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

  input[aria-invalid='true'] {
    border-color: var(--etat-erreur);
  }

  .aide,
  .erreur {
    font-size: 0.85rem;
  }

  .aide {
    color: var(--texte-discret);
  }

  .erreur {
    color: var(--etat-erreur);
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
    width: min(100%, 22rem);
    margin: 0;
    padding: 0.6rem 0.75rem;
    border-left: 4px solid var(--etat-erreur);
    background: var(--surface);
  }
</style>
