<script lang="ts">
  // Changer son mot de passe (US-010), page réservée. Avec un mot de passe temporaire tout juste saisi à la connexion,
  // il n'est pas redemandé (CA-4). Le changement exige le réseau.
  import { onMount, untrack } from 'svelte';
  import { validerNouveauMotDePasse } from '@poule-position/domaine';
  import type { Session } from '@poule-position/protocole';
  import Lien from '../composants/Lien.svelte';
  import { CHEMINS } from '../lib/routes';
  import type { ClientSession, ErreurChangementMotDePasse } from '../lib/session';
  import { textes } from '../lib/textes';

  interface Proprietes {
    client: ClientSession;
    session: Session;
    surChangement: (session: Session) => void;
    surSessionPerdue: () => void;
    naviguer: (chemin: string) => void;
  }

  let { client, session, surChangement, surSessionPerdue, naviguer }: Proprietes = $props();

  const t = textes.motDePasse;
  /** Mot de passe temporaire : seul usage permis du compte jusqu'au changement (CA-4). */
  const temporaire = $derived(session.compte.temporaire);
  /** CA-4 : le mot de passe actuel vient d'être saisi à la connexion, inutile de le redemander (fixé à l'ouverture). */
  const demanderActuel = untrack(() => !(session.compte.temporaire && client.connaitMotDePasseActuel()));

  let actuel = $state('');
  let nouveau = $state('');
  let confirmation = $state('');
  let erreursChamps: Partial<Record<'actuel' | 'nouveau' | 'confirmation', keyof typeof t.champs>> = $state({});
  let erreur: ErreurChangementMotDePasse | null = $state(null);
  let modifie = $state(false);
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

  async function valider(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (enCours) return;
    erreur = null;
    modifie = false;
    // CA-2 : règles vérifiées avant tout envoi, un message sous chaque champ concerné.
    const regles = validerNouveauMotDePasse(demanderActuel ? actuel : null, nouveau, confirmation);
    erreursChamps = {
      ...(demanderActuel && actuel === '' && { actuel: 'ACTUEL_VIDE' }),
      ...(regles.nouveau && { nouveau: regles.nouveau }),
      ...(regles.confirmation && { confirmation: regles.confirmation }),
    };
    if (Object.keys(erreursChamps).length > 0) return;

    enCours = true;
    try {
      const resultat = await client.changerMotDePasse(demanderActuel ? actuel : null, nouveau);
      if (resultat.ok) {
        modifie = true;
        actuel = nouveau = confirmation = '';
        surChangement(resultat.session);
      } else if (resultat.erreur === 'SESSION_INVALIDE') {
        surSessionPerdue();
      } else {
        erreur = resultat.erreur;
      }
    } finally {
      enCours = false;
    }
  }
</script>

<main>
  <h1>{t.titre}</h1>
  {#if temporaire && !modifie}
    <p class="info">{t.temporaire}</p>
  {/if}
  {#if modifie}
    <p class="succes" role="status">{t.modifie}</p>
    <Lien chemin={CHEMINS.organisateur} {naviguer}>{t.continuer}</Lien>
  {:else}
    <form onsubmit={valider} novalidate>
      <!-- Étiquette et message séparés : le message décrit le champ (aria-describedby) sans entrer dans son nom. -->
      {#if demanderActuel}
        <div class="champ">
          <label for="actuel">{t.actuel}</label>
          <input
            id="actuel"
            type="password"
            autocomplete="current-password"
            bind:value={actuel}
            disabled={enCours}
            aria-invalid={erreursChamps.actuel ? 'true' : undefined}
            aria-describedby={erreursChamps.actuel ? 'erreur-actuel' : undefined}
          />
          {#if erreursChamps.actuel}<span class="erreur" id="erreur-actuel">{t.champs[erreursChamps.actuel]}</span>{/if}
        </div>
      {/if}
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
        <p class="message" role="alert">{horsLigne ? t.horsLigne : t.erreurs[erreur as ErreurChangementMotDePasse]}</p>
      {/if}
      <button type="submit" disabled={enCours || horsLigne}>{enCours ? t.enCours : t.valider}</button>
    </form>
    {#if !temporaire}
      <Lien chemin={CHEMINS.organisateur} {naviguer}>{t.retour}</Lien>
    {/if}
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
    font-weight: 400;
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

  .info,
  .message,
  .succes {
    width: min(100%, 22rem);
    margin: 0;
    padding: 0.6rem 0.75rem;
    background: var(--surface);
  }

  .info {
    border-left: 4px solid var(--etat-attente);
  }

  .message {
    border-left: 4px solid var(--etat-erreur);
  }

  .succes {
    border-left: 4px solid var(--etat-ok);
  }
</style>
