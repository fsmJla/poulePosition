<script lang="ts">
  // Matchs du tableau sur le smartphone (US-106 CA-1) : ceux de la piste de l'arbitre, ou ceux du tireur, sous la liste
  // des matchs de poule. Un match à tirer s'ouvre en saisie ; un match terminé se corrige au crayon (arbitre, US-101).
  import { placesAffichees, type MatchTableauVue, type TireurVue } from '@poule-position/domaine';
  import { textes } from '../lib/textes';
  import Icone from './Icone.svelte';

  interface Proprietes {
    matchs: MatchTableauVue[];
    tireurs: ReadonlyMap<string, TireurVue>;
    saisir?: (match: MatchTableauVue) => void;
    corriger?: (match: MatchTableauVue) => void;
    suspendue?: boolean;
  }

  let { matchs, tireurs, saisir, corriger, suspendue = false }: Proprietes = $props();

  const t = textes.saisie.tableau;
  const tt = textes.tableau;
  const titre = (m: MatchTableauVue) => (m.tour === 0 ? t.troisieme : t.titre(m.numero, tt.nomDuTour(m.tour)));
  const ordre = (m: MatchTableauVue) => placesAffichees(m);
  const nom = (id: string | null) => (id ? (tireurs.get(id)?.nom ?? '') : '');
  const libelle = (m: MatchTableauVue, i: 0 | 1) => {
    const place = ordre(m).places[i];
    if (place.tireurId) return nom(place.tireurId);
    if (!place.provenance) return '';
    const [taille, numero] = place.provenance.split('-').map(Number) as [number, number];
    return tt.provenance(taille, numero, m.tour === 0);
  };
  const paire = (m: MatchTableauVue) => `${libelle(m, 0)} – ${libelle(m, 1)}`;
  const score = (m: MatchTableauVue) => {
    const touches = ordre(m).touches;
    return touches ? `${touches[0]}–${touches[1]}` : '';
  };
</script>

<section class="tableau" aria-labelledby="titre-tableau">
  <h2 id="titre-tableau" class="intertitre"><Icone nom="arbre" />{t.titreListe}</h2>
  {#if matchs.length === 0}
    <p class="discret">{t.aucun}</p>
  {:else}
    <ul>
      {#each matchs as match (match.id)}
        <li class:regle={match.etat === 'regle'}>
          <div class="texte">
            <span class="titre">{titre(match)}</span>
            <span class="paire">{paire(match)}</span>
            <span class="discret">{t.ligne(match.piste, tt.etatMatch(match))}</span>
          </div>
          {#if match.etat === 'regle'}
            <span class="score">{score(match)}</span>
            {#if corriger}
              <button
                type="button"
                class="crayon"
                aria-label={t.corriger(paire(match))}
                title={t.corriger(paire(match))}
                disabled={suspendue}
                onclick={() => corriger?.(match)}><Icone nom="crayon" /></button
              >
            {/if}
          {:else if match.etat === 'aTirer' && saisir}
            <button
              type="button"
              class="principal"
              disabled={suspendue}
              aria-label={`${t.saisir} : ${paire(match)}`}
              onclick={() => saisir?.(match)}>{t.saisir}</button
            >
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .tableau {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 16px 16px;
  }

  .intertitre {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 8px 0 0;
    font-family: var(--police-texte);
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--texte-discret);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--bordure);
    border-radius: 12px;
    background: var(--surface);
  }

  .texte {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .titre {
    font-weight: 600;
  }

  .paire {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .discret {
    margin: 0;
    color: var(--texte-discret);
    font-size: 0.8125rem;
  }

  .score {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .principal {
    min-height: 44px;
    padding: 0 14px;
    border: none;
    border-radius: 999px;
    background: var(--palette-tiffany);
    color: var(--sur-tiffany);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .crayon {
    width: 44px;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--bordure-champ);
    border-radius: 10px;
    background: var(--surface);
    color: var(--texte);
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
