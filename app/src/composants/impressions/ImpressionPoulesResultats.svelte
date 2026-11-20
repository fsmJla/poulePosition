<script lang="ts">
  // Feuilles de poule avec résultats (US-123, planche 25) : une page par poule, à afficher : la grille remplie comme sur
  // le PC (V5 pour la victoire, les touches pour la défaite, US-088), V, V/M, TD, TR, indice et rang, la mention
  // « Provisoire » ou « Terminée », l'ordre des matchs avec leurs scores, et le motif d'un tireur retiré.
  import {
    matchsDePoule,
    resultatsPoule,
    type EtatPoules,
    type MatchPoule,
    type Poule,
    type Tireur,
  } from '@poule-position/domaine';
  import { textes } from '../../lib/textes';
  import FeuilleImprimee from '../FeuilleImprimee.svelte';

  interface Proprietes {
    etat: EtatPoules;
    poules: readonly Poule[];
    tireurs: ReadonlyMap<string, Tireur>;
    touches: number;
    contexte: string;
    imprimeLe: Date;
  }

  let { etat, poules, tireurs, touches, contexte, imprimeLe }: Proprietes = $props();

  const t = textes.impressions.feuillePoule;
  const tp = textes.poules;
  const nom = (id: string) => tireurs.get(id)?.nom.toUpperCase() ?? '';
  const ratio = (valeur: number) =>
    valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const signe = (valeur: number) => (valeur > 0 ? `+${valeur}` : valeur < 0 ? `−${-valeur}` : '0');

  /** La case de la ligne `a` contre la colonne `b`, du point de vue du tireur de la ligne (comme US-088). */
  function caseDe(matchs: MatchPoule[], a: string, b: string): string {
    const m = matchs.find((x) => (x.tireurA === a && x.tireurB === b) || (x.tireurA === b && x.tireurB === a));
    if (!m?.touches) return '';
    if (m.forfait && m.vainqueur === null) return '0';
    const mes = m.tireurA === a ? m.touches[0] : m.touches[1];
    return m.vainqueur === a ? `V${mes}` : String(mes);
  }
</script>

{#each poules as poule, i (poule.numero)}
  {@const matchs = matchsDePoule(etat, poule, touches)}
  {@const resultats = resultatsPoule(etat, poule, touches)}
  {@const regles = matchs.filter((m) => m.touches !== null).length}
  {@const lignes = Math.ceil(matchs.length / 3)}
  <FeuilleImprimee
    {contexte}
    titre={t.titre(poule.numero, poule.piste)}
    numero={i + 1}
    total={poules.length}
    pagination={t.pagination(poule.numero, etat.poules.length)}
    {imprimeLe}
    pied={t.piedResultats}
  >
    {#snippet aDroite()}
      <p class="etat" class:terminee={regles === matchs.length}>
        {regles === matchs.length ? t.terminee : t.provisoire(regles, matchs.length)}
      </p>
    {/snippet}
    <table class="grille">
      <thead>
        <tr>
          <th scope="col" class="gauche">{t.tireur}</th>
          <th scope="col"><span class="invisible">N°</span></th>
          {#each poule.tireurIds as id, j (id)}<th scope="col" class="case">{j + 1}</th>{/each}
          {#each t.colonnes as colonne (colonne)}<th scope="col" class="case">{colonne}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each poule.tireurIds as id, ligne (id)}
          {@const r = resultats[ligne]!}
          <tr>
            <th scope="row" class="gauche nom"
              ><strong>{nom(id)}</strong>
              {tireurs.get(id)?.prenom}{#if r.retrait}<span class="motif">{tp.motifs[r.retrait]}</span>{/if}<br /><span
                class="club">{tireurs.get(id)?.club}</span
              ></th
            >
            <td class="numero">{ligne + 1}</td>
            {#each poule.tireurIds as autre, colonne (autre)}
              {@const texte = ligne === colonne ? '' : caseDe(matchs, id, autre)}
              <td class="case" class:diagonale={ligne === colonne} class:victoire={texte.startsWith('V')}>{texte}</td>
            {/each}
            <td class="case">{r.victoires}</td>
            <td class="case">{ratio(r.ratio)}</td>
            <td class="case">{r.touchesDonnees}</td>
            <td class="case">{r.touchesRecues}</td>
            <td class="case">{signe(r.indice)}</td>
            <td class="case fort">{r.rang}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    <section aria-label={t.ordreSimple}>
      <h2>{t.ordreSimple}</h2>
      <ol style:grid-template-rows="repeat({lignes}, auto)">
        {#each matchs as m (m.numero)}
          <li>
            <span class="rang">{m.numero}.</span>
            <span>{nom(m.tireurA)} – {nom(m.tireurB)}</span>
            <strong>{m.touches ? `${m.touches[0]}–${m.touches[1]}` : ''}</strong>
          </li>
        {/each}
      </ol>
    </section>
    <p class="legende">{t.legende}</p>
  </FeuilleImprimee>
{/each}

<style>
  .etat {
    margin: 0;
    padding: 1mm 3mm;
    border: 2px solid #8a560c;
    color: #8a560c;
    font-weight: 700;
  }

  .etat.terminee {
    border-color: #14573a;
    color: #14573a;
  }

  .grille {
    border-collapse: collapse;
    font-size: 11pt;
  }

  .grille th,
  .grille td {
    padding: 1mm 1.5mm;
    border: 1px solid #555555;
    text-align: center;
  }

  .grille thead th {
    border: none;
    font-size: 9.5pt;
  }

  .grille tbody tr {
    height: 13mm;
  }

  .gauche {
    text-align: left !important;
  }

  .nom {
    font-weight: 400;
    line-height: 1.2;
    white-space: nowrap;
  }

  .club {
    color: #444444;
    font-size: 8.5pt;
  }

  .motif {
    margin-left: 2mm;
    padding: 0 2mm;
    border: 1px solid #8a560c;
    color: #8a560c;
    font-size: 8pt;
  }

  .numero,
  .fort,
  .victoire {
    font-weight: 700;
  }

  .case {
    width: 11mm;
  }

  .diagonale {
    background: #2f4b4a;
    print-color-adjust: exact;
  }

  h2 {
    margin: 0 0 2mm;
    font-size: 11pt;
  }

  ol {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-flow: column;
    gap: 1mm 5mm;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: 6mm minmax(0, 1fr) auto;
    gap: 1.5mm;
    padding: 1.2mm 0;
    border-bottom: 1px solid #cccccc;
  }

  .rang {
    color: #444444;
  }

  .legende {
    margin: 0;
    font-size: 9pt;
  }

  .invisible {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
