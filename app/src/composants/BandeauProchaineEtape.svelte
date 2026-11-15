<script lang="ts">
  // Bandeau « Prochaine étape » du résumé d'une épreuve (US-064, planches 3 et 6) : une phrase et une seule action
  // principale. Affichage seul : la page décide de l'étape (règle du domaine) et fournit les actions.
  import type { ProchaineEtape } from '@poule-position/domaine';
  import Icone from './Icone.svelte';
  import { textes } from '../lib/textes';

  interface Proprietes {
    etape: ProchaineEtape;
    /** Seul le PC pilote agit : ailleurs, le bandeau annonce l'étape sans bouton (CA-4). */
    peutAgir: boolean;
    /** Action de l'étape « publier » en cours. */
    enCours?: boolean;
    surPublier: () => void;
    surCopier: () => void;
    /** Retour de la copie : « Lien copié » ou le motif de l'échec. */
    retourCopie?: { ok: boolean; message: string } | null;
    /** Erreur de l'action (publier), avec le message d'US-031 (cas limite). */
    erreur?: string | null;
  }

  let {
    etape,
    peutAgir,
    enCours = false,
    surPublier,
    surCopier,
    retourCopie = null,
    erreur = null,
  }: Proprietes = $props();

  const t = textes.pageEpreuve.prochaineEtape;
</script>

<section class="bandeau" aria-label={t.titre}>
  <div class="texte">
    <p class="surtitre">{t.titre}</p>
    <p class="phrase">{t.phrases[etape]}</p>
    {#if !peutAgir}<p class="detail">{t.depuisLePilote}</p>{/if}
  </div>
  {#if peutAgir}
    <div class="action">
      {#if etape === 'publier'}
        <button type="button" onclick={surPublier} disabled={enCours}>
          <Icone nom="oeil" />{enCours ? textes.publication.enCours : t.boutons.publier}
        </button>
      {:else}
        <button type="button" onclick={surCopier}>{t.boutons.copier}</button>
      {/if}
    </div>
  {/if}
  {#if retourCopie}
    <p class="retour" role={retourCopie.ok ? 'status' : 'alert'}>{retourCopie.message}</p>
  {/if}
  {#if erreur}<p class="retour erreur" role="alert">{erreur}</p>{/if}
</section>

<style>
  .bandeau {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1.5rem;
    padding: 1rem 1.25rem;
    border-radius: 14px;
    background: var(--marque);
    color: var(--sur-marque);
  }

  .texte {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }

  .texte p,
  .retour {
    margin: 0;
  }

  .surtitre {
    font-size: 0.85rem;
  }

  .phrase {
    font-size: 1.15rem;
    font-weight: 700;
  }

  .detail {
    margin-top: 0.35rem;
    font-size: 0.95rem;
  }

  .action button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 2.5rem;
    padding: 0 1rem;
    border: none;
    border-radius: 10px;
    background: var(--accent-fond);
    color: var(--sur-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .action button:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .retour {
    flex-basis: 100%;
    font-size: 0.95rem;
  }

  .erreur {
    font-weight: 600;
  }
</style>
