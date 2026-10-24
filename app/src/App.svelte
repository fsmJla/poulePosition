<script lang="ts">
  // Page minimale du walking skeleton (US-001) : nom de l'application et état de la connexion au serveur.
  import { onMount } from 'svelte';
  import { demarrerConnexion, urlConnexion, URL_SERVEUR_LOCAL, type EtatConnexion } from './lib/connexion';
  import { textes } from './lib/textes';

  /** Compétition de démonstration, en attendant les vraies compétitions (E2). */
  const COMPETITION_DEMO = 'demo';
  const urlServeur = import.meta.env.VITE_URL_SERVEUR ?? (import.meta.env.DEV ? URL_SERVEUR_LOCAL : undefined);

  let etat: EtatConnexion = $state('connexion');

  onMount(
    () =>
      demarrerConnexion({
        url: urlConnexion(urlServeur, COMPETITION_DEMO),
        surEtat: (nouvelEtat) => (etat = nouvelEtat),
      }).arreter,
  );
</script>

<main>
  <img src="/icone.svg" alt="" width="72" height="72" />
  <h1>poulePosition</h1>
  <p class="accroche">{textes.accroche}</p>
  <p class="etat" data-etat={etat} role="status">
    <span class="pastille" aria-hidden="true"></span>{textes.etats[etat]}
  </p>
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
    font-size: clamp(2rem, 6vw, 3rem);
    letter-spacing: -0.02em;
  }

  .accroche {
    margin: 0;
    color: var(--texte-discret);
  }

  .etat {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1.5rem;
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
