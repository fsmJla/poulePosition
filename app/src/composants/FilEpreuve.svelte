<script lang="ts">
  // Fil d'Ariane d'une page d'épreuve (US-054 CA-3) : « Accueil › manifestation › compétition › épreuve ». La
  // hiérarchie vient des listes du club, ou de leur dernière copie gardée sur l'appareil quand le serveur ne répond pas.
  import { onMount } from 'svelte';
  import type { Accueil } from '../lib/accueil';
  import { filDeLEpreuve, type HierarchieClub } from '../lib/fil-ariane';
  import { textes } from '../lib/textes';
  import FilAriane from './FilAriane.svelte';

  interface Proprietes {
    accueil: Accueil;
    epreuve: { id: string; nom: string; rattachement?: { competitionId: string } | null };
    /** Page de l'épreuve en cours (« Formule », « Paramètres ») ; absent sur la page de l'épreuve elle-même. */
    suite?: string;
    naviguer: (chemin: string) => void;
  }

  let { accueil, epreuve, suite, naviguer }: Proprietes = $props();

  let hierarchie = $state<HierarchieClub | null>(null);
  const niveaux = $derived(filDeLEpreuve(hierarchie, epreuve, suite, textes.entete.accueil));

  onMount(() => {
    void accueil
      .hierarchie()
      .then((lue) => (hierarchie = lue))
      .catch(() => undefined);
  });
</script>

<FilAriane {niveaux} {naviguer} />
