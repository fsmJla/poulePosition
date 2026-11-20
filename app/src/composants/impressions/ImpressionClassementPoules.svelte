<script lang="ts">
  // Classement après les poules (US-125, planche 27) : le classement d'US-092 (rang et « = », tireur, club, poule, V, M,
  // V/M, indice, TD, TR, état), « Provisoire · n matchs sur N » ou « Définitif » ; 34 lignes par page, retirés en fin.
  import {
    avancementPoules,
    classementDesPoules,
    decouperEnPages,
    type EtatPoules,
    type Tireur,
  } from '@poule-position/domaine';
  import { textes } from '../../lib/textes';
  import FeuilleImprimee from '../FeuilleImprimee.svelte';

  interface Proprietes {
    etat: EtatPoules;
    tireurs: ReadonlyMap<string, Tireur>;
    touches: number;
    contexte: string;
    imprimeLe: Date;
  }

  let { etat, tireurs, touches, contexte, imprimeLe }: Proprietes = $props();

  const t = textes.poules;
  const ti = textes.impressions.classementPoules;
  const lignes = $derived(classementDesPoules(etat, touches));
  const pages = $derived(decouperEnPages(lignes, 34));
  const avancement = $derived(avancementPoules(etat, touches));
  const definitif = $derived(avancement.total > 0 && avancement.regles === avancement.total);
  const ratio = (valeur: number) =>
    valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const signe = (valeur: number) => (valeur > 0 ? `+${valeur}` : valeur < 0 ? `−${-valeur}` : '0');
</script>

{#each pages as groupe, i (i)}
  <FeuilleImprimee {contexte} titre={ti.titre} numero={i + 1} total={pages.length} {imprimeLe}>
    {#snippet aDroite()}
      <p class="etat" class:definitif>
        {definitif ? ti.definitif(avancement.total) : t.classementProvisoireEntete(avancement.regles, avancement.total)}
      </p>
    {/snippet}
    <table>
      <thead>
        <tr>
          <th scope="col" class="droite">{t.colonnes.rang}</th>
          <th scope="col" class="gauche">{t.tireur}</th>
          <th scope="col" class="gauche">{t.club}</th>
          <th scope="col">{t.poulesColonne}</th>
          <th scope="col">{t.colonnes.victoires}</th>
          <th scope="col">M</th>
          <th scope="col">{t.colonnes.ratio}</th>
          <th scope="col">{t.colonnes.indice}</th>
          <th scope="col">{t.colonnes.td}</th>
          <th scope="col">{t.colonnes.tr}</th>
          <th scope="col" class="gauche">{t.etatColonne}</th>
        </tr>
      </thead>
      <tbody>
        {#each groupe as ligne (ligne.tireurId)}
          {@const tireur = tireurs.get(ligne.tireurId)}
          <tr>
            <td class="droite fort">{ligne.rangGeneral ?? '—'}{ligne.exaequo ? '=' : ''}</td>
            <th scope="row" class="gauche"><strong>{tireur?.nom.toUpperCase()}</strong> {tireur?.prenom}</th>
            <td class="gauche">{tireur?.club}</td>
            <td>{ligne.poule}</td>
            <td>{ligne.victoires}</td>
            <td>{ligne.matchs}</td>
            <td>{ratio(ligne.ratio)}</td>
            <td>{signe(ligne.indice)}</td>
            <td>{ligne.touchesDonnees}</td>
            <td>{ligne.touchesRecues}</td>
            <td class="gauche">
              {ligne.retrait
                ? t.motifs[ligne.retrait]
                : ligne.aTirer === 0
                  ? t.pouleTerminee
                  : t.matchsATirer(ligne.aTirer)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if i === pages.length - 1}<p class="note">{t.classementLegende}</p>{/if}
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

  .etat.definitif {
    border-color: #14573a;
    color: #14573a;
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
    border: 1px solid #999999;
    text-align: right;
    font-weight: 400;
  }

  thead th {
    background: #eef2f1;
    font-weight: 700;
    print-color-adjust: exact;
  }

  .gauche {
    text-align: left;
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
