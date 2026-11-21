<script lang="ts">
  // Écrans géants d'une compétition seule (US-133 CA-6) : la même gestion que l'onglet « Écrans » d'une manifestation
  // (planche 36), limitée aux épreuves de la compétition. On y arrive par le menu « ⋯ » de l'épreuve.
  import { onMount } from 'svelte';
  import { construireListe } from '@poule-position/domaine';
  import type { Ecran, VueImposee } from '@poule-position/protocole';
  import FilAriane from '../composants/FilAriane.svelte';
  import GestionEcrans from '../composants/GestionEcrans.svelte';
  import type { Accueil, DonneesAccueil } from '../lib/accueil';
  import type { ClientEcrans } from '../lib/ecrans';
  import { filSousAccueil } from '../lib/fil-ariane';
  import { textes } from '../lib/textes';

  interface Proprietes {
    accueil: Accueil;
    ecrans: ClientEcrans;
    competitionId: string;
    ouvrirSurCePc?: ((ecran: Ecran) => boolean) | undefined;
    /** US-135 CA-4 : une vue imposée depuis ce PC, pour sa fenêtre locale. */
    imposerLocalement?: ((ecranId: string, vue: VueImposee | null) => void) | undefined;
    naviguer: (chemin: string) => void;
  }

  let { accueil, ecrans, competitionId, ouvrirSurCePc, imposerLocalement, naviguer }: Proprietes = $props();
  const t = textes.ecrans;

  let donnees: DonneesAccueil | null = $state(null);
  const noeud = $derived(
    donnees
      ? ([
          ...construireListe(donnees, { afficherArchives: true }).competitionsSeules,
          ...construireListe(donnees, { afficherArchives: true }).manifestations.flatMap((m) => m.competitions),
        ].find(({ competition }) => competition.id === competitionId) ?? null)
      : null,
  );

  onMount(() => {
    void accueil.charger().then((lues) => (donnees = lues));
  });
</script>

<main>
  {#if noeud}
    <FilAriane niveaux={filSousAccueil(t.titre, [{ libelle: noeud.competition.nom }])} {naviguer} />
    <h1>{t.titre} · {noeud.competition.nom}</h1>
    <GestionEcrans
      client={ecrans}
      proprietaire={{ type: 'competition', id: competitionId }}
      groupes={[{ competition: noeud.competition, epreuves: noeud.epreuves }]}
      {ouvrirSurCePc}
      {imposerLocalement}
    />
  {:else if donnees}
    <FilAriane niveaux={filSousAccueil(t.titre)} {naviguer} />
    <p role="alert">{t.erreurs.PROPRIETAIRE_INCONNU}</p>
  {/if}
</main>

<style>
  main {
    display: grid;
    gap: 1.25rem;
    max-width: 65rem;
    margin: 0 auto;
    padding: 1.25rem 1.5rem 4rem;
  }

  h1 {
    margin: 0;
    font-family: var(--police-titre);
    font-size: 2rem;
    overflow-wrap: anywhere;
  }
</style>
