<script lang="ts">
  // Arbre du tableau (US-110, planche 11) : à partir du tour choisi, une colonne par tour jusqu'à la finale (quatre au
  // plus), les matchs deux par deux reliés vers le match qu'ils alimentent. Chaque match montre ses tireurs (rang après
  // poules entre parenthèses), les scores, le vainqueur en gras et son état ; un clic le choisit (carte de saisie, US-111).
  import {
    placesAffichees,
    type MatchTableau,
    type PlaceTableau,
    type StructureTableau,
    type Tireur,
  } from '@poule-position/domaine';
  import { textes } from '../lib/textes';
  import Icone from './Icone.svelte';

  interface Proprietes {
    structure: StructureTableau;
    tireurs: ReadonlyMap<string, Tireur>;
    /** Indice du tour choisi dans `structure.tours`. */
    tour: number;
    choisi: string | null;
    choisir: (id: string) => void;
    /** Aide « Cliquez un match… » : seulement là où l'on peut saisir. */
    modifiable: boolean;
  }

  let { structure, tireurs, tour, choisi, choisir, modifiable }: Proprietes = $props();

  const t = textes.tableau;
  const COLONNES_MAX = 4;
  const colonnes = $derived(structure.tours.slice(tour, tour + COLONNES_MAX));
  /** Hauteur d'une colonne : 90 px par match de la première colonne affichée. */
  const hauteur = $derived(Math.max(1, colonnes[0]?.matchs.length ?? 1) * 90);
  const titre = $derived(
    colonnes.length > 1
      ? t.arbreTitre(t.nomDuTour(colonnes[0]!.taille), t.nomDuTour(colonnes.at(-1)!.taille))
      : t.nomDuTour(colonnes[0]?.taille ?? 2),
  );

  const paires = (matchs: MatchTableau[]) =>
    Array.from({ length: Math.ceil(matchs.length / 2) }, (_, i) => matchs.slice(2 * i, 2 * i + 2));

  const nomDe = (id: string | null) => {
    const tireur = id ? tireurs.get(id) : undefined;
    return tireur ? `${tireur.nom.toUpperCase()} ${tireur.prenom}` : '';
  };
  /** « Vainqueur du match 4 », « Vainqueur du quart 1 », « Perdant de la demie 2 ». */
  const libellePlace = (place: PlaceTableau, troisieme: boolean) => {
    if (place.tireurId) return nomDe(place.tireurId);
    if (!place.provenance) return '';
    const [taille, numero] = place.provenance.split('-').map(Number) as [number, number];
    return t.provenance(taille, numero, troisieme);
  };
  const etatDe = (match: MatchTableau) => t.etatMatch(match);
  const classeEtat = (match: MatchTableau) =>
    match.etat === 'regle' || match.etat === 'exempt'
      ? 'fini'
      : match.etat === 'attente' || match.etat === 'nonTire'
        ? 'attente'
        : match.enPiste
          ? 'piste'
          : 'tirer';
</script>

{#snippet ligne(place: PlaceTableau, score: number | undefined, match: MatchTableau, bas: boolean)}
  {@const gagne = match.vainqueur !== null && match.vainqueur === place.tireurId && match.etat === 'regle'}
  {@const perd = match.etat === 'regle' && !gagne}
  <span class="ligne" class:bas class:gagne class:perd class:inconnu={!place.tireurId}>
    <span class="rang">{place.rang ? `(${place.rang})` : ''}</span>
    <span class="nom">{libellePlace(place, match.tour === 0)}</span>
    <span class="score">
      {#if match.retrait?.tireurId === place.tireurId && place.tireurId}{t.motifCourt(
          match.retrait.motif,
        )}{:else if !match.retrait}{score ?? ''}{/if}
    </span>
  </span>
{/snippet}

{#snippet carte(match: MatchTableau)}
  {@const { places, touches } = placesAffichees(match)}
  {@const nomA = libellePlace(places[0], match.tour === 0)}
  {@const nomB = libellePlace(places[1], match.tour === 0)}
  <button
    type="button"
    class="match"
    class:choisi={choisi === match.id}
    aria-pressed={choisi === match.id}
    aria-label={match.etat === 'exempt'
      ? `${nomDe(match.vainqueur)}, ${etatDe(match)}`
      : `${nomA} contre ${nomB}, ${etatDe(match)}`}
    disabled={match.etat === 'exempt'}
    onclick={() => choisir(match.id)}
  >
    {#if match.etat === 'exempt'}
      {@render ligne(match.haut.tireurId ? match.haut : match.bas, undefined, match, false)}
    {:else}
      {@render ligne(places[0], touches?.[0], match, false)}
      {@render ligne(places[1], touches?.[1], match, true)}
    {/if}
    <span class="etat {classeEtat(match)}">{etatDe(match)}</span>
  </button>
{/snippet}

<section class="arbre" aria-labelledby="titre-arbre">
  <header>
    <h3 id="titre-arbre"><Icone nom="arbre" />{titre}</h3>
    {#if modifiable}<span class="discret">{t.cliquezUnMatch}</span>{/if}
  </header>
  <div class="defile">
    <div class="colonnes" style:--colonnes={colonnes.length}>
      {#each colonnes as colonne, c (colonne.taille)}
        <div class="colonne">
          <h4>{t.nomDuTour(colonne.taille)}</h4>
          <div class="matchs" style:height="{hauteur}px">
            {#each paires(colonne.matchs) as paire, p (p)}
              <div class="paire" class:relie={c < colonnes.length - 1 && paire.length === 2}>
                {#each paire as match (match.id)}
                  {@render carte(match)}
                {/each}
              </div>
            {/each}
          </div>
          {#if colonne.taille === 2 && structure.troisieme}
            <!-- US-114 CA-2 : le match pour la 3e place, sous la finale. -->
            <div class="troisieme">
              <h4>{t.titreMatch(0, 1)}</h4>
              {@render carte(structure.troisieme)}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
  <p class="pied">{t.legende}</p>
</section>

<style>
  .arbre {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
    overflow: hidden;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 0.5rem;
    padding: 12px 16px;
    border-bottom: 1px solid var(--bordure);
  }

  h3 {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 1rem;
  }

  .discret {
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .defile {
    overflow-x: auto;
    padding: 16px;
  }

  .colonnes {
    display: grid;
    grid-template-columns: repeat(var(--colonnes), minmax(220px, 1fr));
    column-gap: 28px;
    min-width: calc(var(--colonnes) * 245px);
  }

  .colonne {
    display: flex;
    flex-direction: column;
  }

  h4 {
    margin: 0 0 8px;
    color: var(--texte-discret);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .matchs {
    display: flex;
    flex-direction: column;
  }

  .troisieme {
    display: flex;
    flex-direction: column;
    margin-top: 16px;
  }

  .paire {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
  }

  /* L'accolade qui relie deux matchs au match qu'ils alimentent. */
  .paire.relie::after {
    content: '';
    position: absolute;
    top: 25%;
    bottom: 25%;
    right: -15px;
    width: 13px;
    border: 2px solid var(--accent-teinte-bordure);
    border-left: none;
    border-radius: 0 8px 8px 0;
  }

  .match {
    display: flex;
    flex-direction: column;
    padding: 0;
    border: 1px solid var(--bordure);
    border-radius: 10px;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    text-align: left;
    overflow: hidden;
    cursor: pointer;
  }

  .match:disabled {
    cursor: default;
  }

  .match.choisi {
    border: 2px solid var(--accent);
  }

  .ligne {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding: 0 10px;
    font-size: 0.875rem;
  }

  .ligne.bas {
    border-top: 1px solid var(--bordure);
  }

  .ligne.gagne {
    font-weight: 600;
  }

  .ligne.perd,
  .ligne.inconnu {
    color: var(--texte-discret);
  }

  .rang {
    min-width: 22px;
    color: var(--texte-discret);
    font-size: 0.8rem;
    font-weight: 400;
  }

  .nom {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .score {
    font-variant-numeric: tabular-nums;
  }

  .etat {
    display: flex;
    align-items: center;
    min-height: 24px;
    padding: 0 10px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .etat.fini {
    background: var(--fond);
    color: var(--texte-discret);
  }

  .etat.piste {
    background: var(--etat-ok-fond);
    color: var(--sur-etat-ok-fond);
  }

  .etat.tirer {
    background: var(--surface-2);
    color: var(--texte);
  }

  .etat.attente {
    color: var(--texte-discret);
  }

  .match.choisi .etat {
    background: var(--accent-teinte);
    color: var(--accent);
  }

  .pied {
    margin: 0;
    padding: 10px 16px;
    border-top: 1px solid var(--bordure);
    color: var(--texte-discret);
    font-size: 0.875rem;
  }
</style>
