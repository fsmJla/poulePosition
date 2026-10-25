<script lang="ts">
  // Écran de connexion (US-003, présentation US-012) : e-mail et mot de passe, connexion en ligne uniquement.
  // Sur PC, panneau décoratif (bannière « login ») et formulaire en carte ; sur smartphone, la carte seule. Hors ligne,
  // l'écran l'indique ; la reconnexion sur un appareil déjà utilisé viendra avec US-005.
  import { onMount } from 'svelte';
  import Banniere from '../composants/Banniere.svelte';
  import IconeAnimee from '../composants/IconeAnimee.svelte';
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

  const t = textes.connexion;

  let email = $state('');
  let motDePasse = $state('');
  let motDePasseVisible = $state(false);
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

  const message = $derived(erreur ? t.erreurs[erreur] : horsLigne ? t.horsLigne : null);
</script>

<div class="ecran">
  <aside class="panneau" aria-label={t.presentation}>
    <Banniere variante="login" surFondSombre hauteur={190} />
    <p class="sous-titre">{textes.sousTitre}</p>
  </aside>

  <main>
    <div class="carte">
      <div class="tete-mobile">
        <Banniere variante="login" hauteur={150} />
        <p class="sous-titre">{textes.sousTitre}</p>
      </div>

      <h1>{t.titre}</h1>
      <form onsubmit={valider}>
        <div class="champ">
          <label for="email">{t.email}</label>
          <input
            id="email"
            type="email"
            name="email"
            autocomplete="username"
            required
            bind:value={email}
            disabled={enCours}
          />
        </div>
        <div class="champ">
          <label for="mot-de-passe">{t.motDePasse}</label>
          <div class="saisie">
            <input
              id="mot-de-passe"
              type={motDePasseVisible ? 'text' : 'password'}
              name="mot-de-passe"
              autocomplete="current-password"
              required
              bind:value={motDePasse}
              disabled={enCours}
            />
            <!-- Nom accessible en texte masqué (pas aria-label) : le champ reste seul à répondre au libellé « Mot de passe ». -->
            <button
              type="button"
              class="oeil"
              aria-pressed={motDePasseVisible}
              onclick={() => (motDePasseVisible = !motDePasseVisible)}
              disabled={enCours}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
                {#if motDePasseVisible}<path d="M4 4l16 16" />{/if}
              </svg>
              <span class="masque">{motDePasseVisible ? t.masquerMotDePasse : t.afficherMotDePasse}</span>
            </button>
          </div>
        </div>

        {#if message}
          <p class="bandeau" role="alert">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 7v6M12 16.5v.5" />
            </svg>{message}
          </p>
        {/if}

        <button type="submit" class="valider" disabled={!complet || enCours}>
          {#if enCours}<IconeAnimee taille={22} />{t.enCours}{:else}{t.valider}{/if}
        </button>
      </form>
      <p class="retour"><Lien chemin={CHEMINS.accueil} {naviguer}>{t.retour}</Lien></p>
    </div>
  </main>
</div>

<style>
  .ecran {
    min-height: 100vh;
    display: grid;
  }

  /* Panneau décoratif (PC seulement) : bannière sombre sur dégradé ardoise → sarcelle. */
  .panneau {
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem 2rem;
    background: linear-gradient(165deg, var(--marque) 55%, var(--palette-sarcelle));
    color: var(--sur-marque);
  }

  .panneau .sous-titre {
    color: var(--sur-marque);
  }

  main {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
  }

  .carte {
    display: grid;
    gap: 1.25rem;
    width: min(100%, 26rem);
    padding: 2rem 1.5rem;
    border: 1px solid var(--bordure);
    border-radius: 18px;
    background: var(--surface);
    box-shadow: 0 18px 40px -24px var(--marque);
  }

  .tete-mobile {
    display: grid;
    justify-items: center;
    gap: 0.75rem;
  }

  .sous-titre {
    margin: 0;
    color: var(--texte-discret);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-align: center;
    text-transform: uppercase;
  }

  h1 {
    margin: 0;
    font-size: 1.6rem;
  }

  form {
    display: grid;
    gap: 1rem;
  }

  .champ {
    display: grid;
    gap: 0.35rem;
  }

  label {
    font-size: 0.9rem;
    font-weight: 600;
  }

  input {
    box-sizing: border-box;
    width: 100%;
    min-height: 48px;
    padding: 0 0.85rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte);
    font: inherit;
  }

  input:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 1px;
  }

  .saisie {
    position: relative;
  }

  .saisie input {
    padding-right: 3.25rem;
  }

  .oeil {
    position: absolute;
    top: 50%;
    right: 0.35rem;
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--texte-discret);
    cursor: pointer;
    transform: translateY(-50%);
  }

  .oeil:hover {
    color: var(--accent);
  }

  .oeil svg,
  .bandeau svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .masque {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .valider {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    min-height: 48px;
    border: none;
    border-radius: var(--rayon);
    background: var(--accent-fond);
    color: var(--sur-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: filter 0.15s;
  }

  .valider:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  .valider:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .bandeau {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    margin: 0;
    padding: 0.75rem 0.9rem;
    border: 1px solid var(--etat-erreur);
    border-radius: var(--rayon);
    background: var(--surface-2);
    color: var(--texte);
    font-size: 0.95rem;
  }

  .bandeau svg {
    flex: none;
    margin-top: 0.1rem;
    color: var(--etat-erreur);
  }

  .retour {
    margin: 0;
    text-align: center;
  }

  @media (min-width: 900px) {
    .ecran {
      grid-template-columns: minmax(20rem, 1fr) minmax(26rem, 1.1fr);
    }

    .panneau {
      display: flex;
    }

    .tete-mobile {
      display: none;
    }

    .carte {
      padding: 2.5rem 2.25rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .valider {
      transition: none;
    }
  }
</style>
