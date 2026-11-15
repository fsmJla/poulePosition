<script lang="ts">
  // Deux icônes d'état d'une épreuve (US-055 CA-4) : œil (publiée) ou œil barré (non publiée), écran (ce PC est le
  // pilote) ou cadenas (lecture seule). Chacune a un nom accessible et une infobulle, jamais une icône muette.
  import { textes } from '../lib/textes';
  import Icone from './Icone.svelte';

  interface Proprietes {
    publiee: boolean;
    pilote: boolean;
  }

  let { publiee, pilote }: Proprietes = $props();

  const tc = textes.epreuves;
  const publication = $derived(publiee ? tc.publiee : tc.nonPubliee);
  const role = $derived(pilote ? tc.pilote : textes.listeClub.lectureSeule);
</script>

<span class="icones">
  <span role="img" aria-label={publication} title={publication} class:actif={publiee}>
    <Icone nom={publiee ? 'oeil' : 'oeilBarre'} />
  </span>
  <span role="img" aria-label={role} title={role} class:actif={pilote}>
    <Icone nom={pilote ? 'ecran' : 'cadenas'} />
  </span>
</span>

<style>
  .icones {
    display: inline-flex;
    gap: 0.6rem;
    align-items: center;
  }

  span[role='img'] {
    display: inline-flex;
    color: var(--texte-inactif);
  }

  .actif {
    color: var(--accent);
  }
</style>
