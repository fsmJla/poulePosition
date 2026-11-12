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
  import BarreOngletsEpreuve from './BarreOngletsEpreuve.svelte';
  import FilAriane from './FilAriane.svelte';
  import Icone from './Icone.svelte';
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
  const tb = tp.barre;

  let hierarchie = $state<HierarchieClub | null>(null);
  onMount(() => {
    void accueil
      .hierarchie()
      .then((lue) => (hierarchie = lue))
      .catch(() => undefined);
  });

  const niveaux = $derived(filDeLEpreuve(hierarchie, epreuve, suite, textes.entete.accueil));
  /** US-061 CA-3 : sur smartphone, la flèche de retour mène au niveau supérieur du fil d'Ariane. */
  const parent = $derived(niveaux.filter((niveau) => niveau.chemin).at(-1));
  const CHEMIN_ACCUEIL = '/organisateur';
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
  <div class="corps">
    <NavigationEpreuve epreuveId={epreuve.id} {courante} {naviguer} />
    <div class="colonne">
      <header>
        <!-- US-061 CA-3 : flèche de retour, visible seulement sur smartphone (le fil d'Ariane y est masqué). -->
        <a
          class="retour"
          href={parent?.chemin ?? CHEMIN_ACCUEIL}
          aria-label={tb.retour(parent?.libelle ?? textes.entete.accueil)}
          onclick={(evenement) => {
            if (evenement.button !== 0 || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey) return;
            evenement.preventDefault();
            naviguer(parent?.chemin ?? CHEMIN_ACCUEIL);
          }}><Icone nom="flecheGauche" taille={24} /></a
        >
        <div class="identite">
          <div class="titre">
            <h1>{nomCourt}</h1>
            <span class="pastille {epreuve.statut}">{t.statuts[epreuve.statut]}</span>
          </div>
          <p class="sous-titre">
            {#if competition}<span class="carre" style="--couleur: var(--plan-{couleur})" aria-hidden="true"
              ></span>{/if}
            <span
              >{[competition?.nom, t.armes[epreuve.arme]].filter(Boolean).join(' · ')}{#if epreuve.date}<span
                  class="date-large">{` · ${t.dateLongue(epreuve.date)}`}</span
                >{/if}</span
            >
          </p>
        </div>
        {#if actions}<div class="actions">{@render actions()}</div>{/if}
      </header>
      <div class="contenu" data-etape={courante} aria-label={tp.etapes[courante]} role="region">
        {@render children()}
      </div>
    </div>
  </div>
</main>
<BarreOngletsEpreuve epreuveId={epreuve.id} {courante} {naviguer} />

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

  .colonne {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    min-width: 0;
  }

  .contenu {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }

  .retour {
    display: none;
  }

  @media (max-width: 52rem) {
    .corps {
      grid-template-columns: minmax(0, 1fr);
    }

    header {
      flex-direction: column;
    }
  }

  /* Smartphone (US-061, planche 6, sous 40 rem) : l'entête devient un bandeau de la couleur de la marque (retour, nom court,
     compétition et arme, actions), sans fil d'Ariane ; la barre d'onglets du bas remplace la navigation. */
  @media (max-width: 39.99rem) {
    main {
      width: 100%;
      gap: 0;
      padding: 0 0 calc(5.5rem + env(safe-area-inset-bottom));
    }

    main :global(.fil) {
      display: none;
    }

    .corps,
    .colonne {
      gap: 0;
    }

    header {
      position: sticky;
      top: 0;
      z-index: 5;
      flex-direction: row;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem max(0.75rem, env(safe-area-inset-right)) 0.5rem max(0.25rem, env(safe-area-inset-left));
      background: var(--marque);
      color: var(--sur-marque);
    }

    .retour {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
      color: var(--sur-marque);
    }

    .identite {
      flex: 1;
      min-width: 0;
    }

    /* La pastille de statut passe sous le nom quand il manque de place : le nom n'est tronqué que s'il dépasse la ligne. */
    .titre {
      flex-wrap: wrap;
      gap: 0.15rem 0.5rem;
    }

    h1 {
      max-width: 100%;
      overflow: hidden;
      font-size: 1.25rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sous-titre {
      flex-wrap: nowrap;
      margin: 0.15rem 0 0;
      overflow: hidden;
      color: var(--sur-marque);
      font-size: 0.85rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .actions {
      flex: none;
    }

    /* Planche 6 : « compétition · arme » seulement ; la date est dans le Résumé. */
    .date-large {
      display: none;
    }

    .contenu {
      padding: 1rem max(1rem, env(safe-area-inset-right)) 0 max(1rem, env(safe-area-inset-left));
    }
  }
</style>
