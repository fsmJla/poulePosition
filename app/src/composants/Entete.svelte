<script lang="ts">
  // Entête des pages réservées (US-014) : bannière « header » qui ramène à l'accueil de l'organisateur, et
  // déconnexion. Les liens de navigation (Compétitions, Résultats) viendront avec leurs US. Bandeau « connexion
  // locale » tant que la session ouverte hors ligne n'est pas revalidée (US-005 CA-1). « Se déconnecter et oublier
  // cet appareil » (US-006), confirmé dans un panneau sous l'entête, sans boîte de dialogue du navigateur.
  import { CHEMINS } from '../lib/routes';
  import { textes } from '../lib/textes';
  import Banniere from './Banniere.svelte';

  interface Proprietes {
    surDeconnexion: () => void;
    surOubli: () => void;
    naviguer: (chemin: string) => void;
    locale?: boolean;
  }

  let { surDeconnexion, surOubli, naviguer, locale = false }: Proprietes = $props();

  const t = textes.organisateur.oublier;
  /** US-006 : confirmation de l'oubli affichée. */
  let aConfirmer = $state(false);

  function versAccueil(evenement: MouseEvent) {
    if (evenement.button !== 0 || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey) return;
    evenement.preventDefault();
    naviguer(CHEMINS.organisateur);
  }
</script>

<header>
  <a href={CHEMINS.organisateur} onclick={versAccueil} class="marque">
    <Banniere variante="header" surFondSombre hauteur={32} />
  </a>
  <div class="boutons">
    <button
      type="button"
      onclick={() => (aConfirmer = true)}
      aria-expanded={aConfirmer}
      aria-controls="confirmation-oubli">{t.bouton}</button
    >
    <button type="button" onclick={surDeconnexion}>{textes.organisateur.seDeconnecter}</button>
  </div>
</header>
{#if aConfirmer}
  <div class="confirmation" id="confirmation-oubli" role="group" aria-labelledby="avertissement-oubli">
    <p id="avertissement-oubli">{t.avertissement}</p>
    <div class="choix">
      <button type="button" class="principal" onclick={surOubli}>{t.confirmer}</button>
      <button type="button" class="lien" onclick={() => (aConfirmer = false)}>{t.annuler}</button>
    </div>
  </div>
{/if}
{#if locale}
  <p class="locale" role="status">{textes.organisateur.connexionLocale}</p>
{/if}

<style>
  .locale {
    margin: 0;
    padding: 0.45rem max(1rem, env(safe-area-inset-left));
    border-bottom: 1px solid var(--bordure);
    background: var(--surface-2);
    color: var(--texte);
    font-size: 0.9rem;
    font-weight: 600;
    text-align: center;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem 1rem;
    padding: 0.6rem max(1rem, env(safe-area-inset-left));
    background: var(--marque);
    color: var(--sur-marque);
  }

  .marque {
    display: flex;
    min-width: 0;
    border-radius: 6px;
  }

  .marque:focus-visible {
    outline-color: var(--sur-marque);
  }

  /* Sur smartphone, les deux boutons passent à la ligne sous la bannière ; jamais plus larges que l'écran. */
  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: flex-end;
    min-width: 0;
  }

  header button {
    flex: 0 1 auto;
    min-width: 0;
    min-height: 44px;
    padding: 0 1rem;
    border: 1px solid var(--sur-marque);
    border-radius: var(--rayon);
    background: transparent;
    color: var(--sur-marque);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  header button:focus-visible {
    outline-color: var(--sur-marque);
  }

  .confirmation {
    display: grid;
    gap: 0.75rem;
    padding: 0.9rem max(1rem, env(safe-area-inset-left));
    border-bottom: 1px solid var(--etat-erreur);
    background: var(--surface-2);
    color: var(--texte);
  }

  .confirmation p {
    margin: 0;
    max-width: 60rem;
  }

  .choix {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  .confirmation button {
    min-height: 44px;
    padding: 0 1rem;
    border-radius: var(--rayon);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .principal {
    border: none;
    background: var(--accent-fond);
    color: var(--sur-accent);
  }

  .lien {
    border: none;
    background: none;
    color: var(--accent);
    text-decoration: underline;
  }
</style>
