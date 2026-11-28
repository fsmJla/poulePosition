<script lang="ts">
  // Classement final (US-128, planche 30) : le podium (places 1 à 3, s'il est acquis), puis le classement d'US-115 :
  // place (« = »), tireur, club, tour d'élimination, rang après poules ; « Définitif » ou « Provisoire » ; retirés et
  // non qualifiés en fin, avec leur état. 32 lignes par page.
  import {
    type Qualifie,
    classementFinal,
    decouperEnPages,
    tousLesMatchs,
    type EtatPoules,
    type EtatTableau,
    type StructureTableau,
    type Tireur,
  } from '@poule-position/domaine';
  import { textes } from '../../lib/textes';
  import FeuilleImprimee from '../FeuilleImprimee.svelte';

  interface Proprietes {
    poules: EtatPoules;
    tableau: EtatTableau;
    structure: StructureTableau;
    touchesPoules: number;
    matchTroisieme: boolean;
    tireurs: ReadonlyMap<string, Tireur>;
    contexte: string;
    imprimeLe: Date;
    /** US-154 CA-3 : en tableau direct, les équipes rangées ; par équipes, les tireurs de chaque équipe. */
    direct?: readonly Qualifie[] | null;
    membres?: ReadonlyMap<string, string>;
  }

  let {
    poules,
    tableau,
    structure,
    touchesPoules,
    matchTroisieme,
    tireurs,
    contexte,
    imprimeLe,
    direct,
    membres,
  }: Proprietes = $props();

  const t = textes.tableau;
  const ti = textes.impressions.classementFinal;
  const lignes = $derived(classementFinal(poules, tableau, touchesPoules, matchTroisieme, direct ?? null));
  const pages = $derived(decouperEnPages(lignes, 32));
  const matchs = $derived(tousLesMatchs(structure).filter((m) => m.etat !== 'exempt'));
  const regles = $derived(matchs.filter((m) => m.etat === 'regle').length);
  /** US-158 CA-6 : une fin anticipée rend le classement définitif. */
  const finAnticipee = $derived(tableau.finAnticipee === true);
  const definitif = $derived(regles === matchs.length || finAnticipee);
  /** Le podium, s'il est acquis : les places 1, 2 et 3 (deux 3es sans match pour la 3e place). */
  const podium = $derived(lignes.filter((l) => l.place !== null && l.place <= 3));
  const podiumAcquis = $derived(podium.some((l) => l.place === 1) && podium.some((l) => l.place === 3));
</script>

{#each pages as groupe, i (i)}
  <FeuilleImprimee {contexte} titre={ti.titre} numero={i + 1} total={pages.length} {imprimeLe}>
    {#snippet aDroite()}
      <p class="etat" class:definitif>
        {definitif ? t.classementDefinitif : t.classementProvisoire(regles, matchs.length)}
      </p>
    {/snippet}
    {#if i === 0 && finAnticipee}<p class="mention">{t.finAnticipee}</p>{/if}
    {#if i === 0 && podiumAcquis}
      <div class="podium" role="list" aria-label={ti.podium}>
        {#each podium as ligne (ligne.tireurId)}
          {@const tireur = tireurs.get(ligne.tireurId)}
          <div class="marche" role="listitem">
            <p class="place">{ti.place(ligne.place!)}</p>
            <p class="nom"><strong>{tireur?.nom.toUpperCase()}</strong> {tireur?.prenom}</p>
            <p class="club">{tireur?.club}</p>
          </div>
        {/each}
      </div>
    {/if}
    <table>
      <thead>
        <tr>
          <th scope="col" class="droite">{t.colonnes.place}</th>
          <th scope="col">{t.colonnes.tireur}</th>
          <th scope="col">{t.colonnes.club}</th>
          <th scope="col">{t.colonnes.tour}</th>
          <th scope="col" class="droite">{t.colonnes.rang}</th>
          <th scope="col">{t.colonnes.etat}</th>
        </tr>
      </thead>
      <tbody>
        {#each groupe as ligne (ligne.tireurId)}
          {@const tireur = tireurs.get(ligne.tireurId)}
          <tr>
            <td class="droite fort">{ligne.place ?? '—'}{ligne.exaequo ? '=' : ''}</td>
            <th scope="row"
              ><strong>{tireur?.nom.toUpperCase()}</strong>
              {tireur?.prenom}{#if membres?.get(ligne.tireurId)}<span class="membres"
                  >{membres.get(ligne.tireurId)}</span
                >{/if}</th
            >
            <td>{tireur?.club}</td>
            <td>{t.tourElimination(ligne.elimineAu)}</td>
            <td class="droite">{ligne.rang ?? '—'}</td>
            <td
              >{ligne.retrait
                ? t.motifCourt(ligne.retrait)
                : ligne.etat === 'classe'
                  ? ''
                  : t.etatsClassement[ligne.etat]}</td
            >
          </tr>
        {/each}
      </tbody>
    </table>
    {#if i === pages.length - 1}<p class="note">{t.legendeClassement}</p>{/if}
  </FeuilleImprimee>
{/each}

<style>
  .mention {
    margin: 0 0 3mm;
    font-style: italic;
  }

  .membres {
    display: block;
    font-size: 8pt;
    font-weight: 400;
  }

  .etat {
    margin: 0;
    padding: 1mm 3mm;
    border: 2px solid var(--papier-provisoire);
    color: var(--papier-provisoire);
    font-weight: 700;
  }

  .etat.definitif {
    border-color: var(--papier-definitif);
    color: var(--papier-definitif);
  }

  .podium {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    gap: 3mm;
  }

  .marche {
    padding: 2.5mm 3mm;
    border: 2px solid var(--papier-marque);
    border-radius: 2mm;
    text-align: center;
  }

  .marche p {
    margin: 0;
  }

  .place {
    color: var(--papier-marque);
    font-family: var(--police-titre);
    font-size: 18pt;
  }

  .nom {
    font-size: 12pt;
  }

  .club {
    color: var(--papier-encre-discrete);
    font-size: 9.5pt;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  th,
  td {
    height: 6.6mm;
    padding: 0 1.5mm;
    border: 1px solid var(--papier-trait-clair);
    text-align: left;
    font-weight: 400;
  }

  thead th {
    background: var(--papier-entete);
    font-weight: 700;
    print-color-adjust: exact;
  }

  .droite {
    text-align: right;
  }

  .fort {
    font-weight: 700;
  }

  .note {
    margin: 0;
    font-size: 9pt;
  }
</style>
