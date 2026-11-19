<script lang="ts">
  // « Mes matchs » du tireur (US-103 CA-3, détaillé par US-104, planche 18) : son nom, sa poule, sa piste et son club,
  // et « Ce n'est pas moi » pour revenir au choix du nom.
  import { tireurDeLaVue, type VueSaisie } from '@poule-position/domaine';
  import { textes } from '../lib/textes';

  interface Proprietes {
    vue: VueSaisie | null;
    tireurId: string;
    oublier: () => void;
  }

  let { vue, tireurId, oublier }: Proprietes = $props();

  const t = textes.saisie.tireur;
  const moi = $derived(tireurDeLaVue(vue, tireurId));
</script>

<main class="mes-matchs">
  <div class="tete">
    <div class="titre">
      <h1>{moi ? `${moi.prenom} ${moi.nom}` : ''}</h1>
      {#if moi}<span class="discret">{t.resume(moi.poule, moi.piste, moi.club)}</span>{/if}
    </div>
    <button type="button" class="lien" onclick={oublier}>{t.cePasMoi}</button>
  </div>
</main>

<style>
  .mes-matchs {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }

  .tete {
    display: flex;
    align-items: flex-end;
    gap: 12px;
  }

  .titre {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    line-height: 1.2;
  }

  .discret {
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .lien {
    min-height: 44px;
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 0.9375rem;
    font-weight: 600;
    text-decoration: underline;
    cursor: pointer;
  }
</style>
