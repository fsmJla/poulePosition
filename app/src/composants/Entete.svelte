<script lang="ts">
  // Entête des pages réservées (US-014) : bannière « header » qui ramène à l'accueil de l'organisateur, et menu de
  // compte en haut à droite (US-017 : profil, déconnexions). Les liens de navigation (Compétitions, Résultats)
  // viendront avec leurs US. Bandeau « connexion locale » tant que la session ouverte hors ligne n'est pas revalidée
  // (US-005 CA-1). « Se déconnecter et oublier cet appareil » (US-006) se confirme dans un panneau sous l'entête, sans
  // boîte de dialogue du navigateur.
  import type { CompteConnecte } from '@poule-position/protocole';
  import { CHEMINS } from '../lib/routes';
  import { textes } from '../lib/textes';
  import Banniere from './Banniere.svelte';
  import MenuCompte from './MenuCompte.svelte';

  interface Proprietes {
    compte: CompteConnecte;
    surDeconnexion: () => void;
    surOubli: () => void;
    naviguer: (chemin: string) => void;
    locale?: boolean;
  }

  let { compte, surDeconnexion, surOubli, naviguer, locale = false }: Proprietes = $props();

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
  <MenuCompte {compte} {naviguer} {surDeconnexion} surOubli={() => (aConfirmer = true)} />
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

  /* Bannière à gauche, avatar à droite : une seule ligne, smartphone compris (US-017). */
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
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
