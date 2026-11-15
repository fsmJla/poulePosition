<script lang="ts">
  // Légende des quatre icônes d'état (US-055 CA-5), sous la liste.
  import { textes } from '../lib/textes';
  import Icone from './Icone.svelte';

  interface Proprietes {
    /** US-073 CA-5 : la légende ajoute le repère « Document » quand un élément en porte un. */
    avecDocuments?: boolean;
  }

  let { avecDocuments = false }: Proprietes = $props();

  const tc = textes.epreuves;
  const base = [
    { icone: 'oeil', texte: tc.publiee },
    { icone: 'oeilBarre', texte: tc.nonPubliee },
    { icone: 'ecran', texte: tc.pilote },
    { icone: 'cadenas', texte: textes.listeClub.lectureSeule },
  ] as const;
  const elements = $derived(
    avecDocuments ? [...base, { icone: 'document', texte: textes.fichiers.repere.legende } as const] : base,
  );
</script>

<ul class="legende" aria-label={textes.listeClub.legende}>
  {#each elements as { icone, texte } (icone)}
    <li><Icone nom={icone} taille={18} />{texte}</li>
  {/each}
</ul>

<style>
  .legende {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.5rem;
    margin: 0.5rem 0 0;
    padding: 0;
    list-style: none;
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  li {
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
  }
</style>
