<script lang="ts">
  // Gabarit à étapes de la page d'une épreuve (US-058) : fil d'Ariane, entête (nom court, statut, compétition, arme,
  // date, actions), navigation par étapes à gauche et contenu de l'étape à droite. Le Résumé, la Formule et les
  // Paramètres s'y insèrent ; leurs adresses ne changent pas.
  import { couleurDeCompetition, nomsCourts, type Epreuve } from '@poule-position/domaine';
  import { onMount, type Snippet } from 'svelte';
  import type { Accueil } from '../lib/accueil';
  import type { IdEtapeEpreuve } from '../lib/etapes-epreuve';
  import { filDeLEpreuve, type HierarchieClub } from '../lib/fil-ariane';
  import { textes } from '../lib/textes';
  import FilAriane from './FilAriane.svelte';
  import NavigationEpreuve from './NavigationEpreuve.svelte';

  interface Proprietes {
    accueil: Accueil;
    epreuve: Epreuve;
    /** Étape ouverte, mise en évidence dans la navigation. */
    courante: IdEtapeEpreuve;
    /** Dernier niveau du fil quand l'étape n'est pas le Résumé (« Formule », « Paramètres »). */
    suite?: string;
    naviguer: (chemin: string) => void;
    /** Boutons de l'entête, à droite (« Modifier », « ⋯ ») : le Résumé seul les porte. */
    actions?: Snippet;
    children: Snippet;
  }

  let { accueil, epreuve, courante, suite, naviguer, actions, children }: Proprietes = $props();

  const t = textes.epreuves;
  const tp = textes.pageEpreuve;

  let hierarchie = $state<HierarchieClub | null>(null);
  onMount(() => {
    void accueil
      .hierarchie()
      .then((lue) => (hierarchie = lue))
      .catch(() => undefined);
  });

  const niveaux = $derived(filDeLEpreuve(hierarchie, epreuve, suite, textes.entete.accueil));
  const competition = $derived(hierarchie?.competitions.find(({ id }) => id === epreuve.rattachement?.competitionId));
  const couleur = $derived(
    hierarchie && competition
      ? couleurDeCompetition(
          hierarchie.competitions.map(({ id, nom, manifestationId, arme }) => ({
            id,
            nom,
            manifestationId,
            arme: arme ?? null,
          })),
          competition.id,
        )
      : 0,
  );
  /** Nom court (« M13 Dames ») ; sans catégorie ou sans sexe, le nom complet. */
  const nomCourt = $derived(nomsCourts([epreuve], t.sexes).get(epreuve.id) ?? epreuve.nom);
</script>

<main>
  <FilAriane {niveaux} {naviguer} />
  <header>
    <div class="identite">
      <div class="titre">
        <h1>{nomCourt}</h1>
        <span class="pastille {epreuve.statut}">{t.statuts[epreuve.statut]}</span>
      </div>
      <p class="sous-titre">
        {#if competition}<span class="carre" style="--couleur: var(--plan-{couleur})" aria-hidden="true"></span>{/if}
        <span
          >{[competition?.nom, t.armes[epreuve.arme], epreuve.date ? t.dateLongue(epreuve.date) : null]
            .filter(Boolean)
            .join(' · ')}</span
        >
      </p>
    </div>
    {#if actions}<div class="actions">{@render actions()}</div>{/if}
  </header>
  <div class="corps">
    <NavigationEpreuve epreuveId={epreuve.id} {courante} {naviguer} />
    <div class="contenu" data-etape={courante} aria-label={tp.etapes[courante]} role="region">
      {@render children()}
    </div>
  </div>
</main>

<style>
  main {
    display: grid;
    gap: 1rem;
    width: min(100% - 2rem, 78rem);
    margin: 0 auto;
    padding: 1.25rem 0 4rem;
  }

  main :global(.fil) {
    margin-bottom: 0.25rem;
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .titre {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }

  h1 {
    margin: 0;
    font-family: var(--police-titre);
    font-size: 2rem;
    line-height: 1.1;
    overflow-wrap: anywhere;
  }

  .pastille {
    padding: 0.2rem 0.7rem;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--texte-discret);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .pastille.enCours {
    background: var(--accent-teinte);
    color: var(--accent);
  }

  .pastille.terminee {
    background: var(--etat-ok-fond);
    color: var(--sur-etat-ok-fond);
  }

  .sous-titre {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    margin: 0.5rem 0 0;
    color: var(--texte-discret);
  }

  .carre {
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 2px;
    background: var(--couleur);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .corps {
    display: grid;
    grid-template-columns: 14.5rem minmax(0, 1fr);
    gap: 1.25rem;
    align-items: start;
  }

  .contenu {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }

  @media (max-width: 52rem) {
    .corps {
      grid-template-columns: minmax(0, 1fr);
    }

    header {
      flex-direction: column;
    }
  }
</style>
