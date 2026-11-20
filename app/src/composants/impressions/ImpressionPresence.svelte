<script lang="ts">
  // Feuille de présence (US-121, planche 23) : les inscrits par ordre alphabétique, case « Présent » (cochée s'il est
  // pointé à l'émargement, US-084) et case de signature ; 28 lignes par page, l'en-tête du tableau répété.
  import { decouperEnPages, lignesPresence, type Tireur } from '@poule-position/domaine';
  import { textes } from '../../lib/textes';
  import FeuilleImprimee from '../FeuilleImprimee.svelte';

  interface Proprietes {
    tireurs: readonly Tireur[];
    contexte: string;
    imprimeLe: Date;
  }

  let { tireurs, contexte, imprimeLe }: Proprietes = $props();

  const t = textes.impressions.presence;
  const c = t.colonnes;
  const pages = $derived(decouperEnPages(lignesPresence(tireurs), 28));
  const presents = $derived(tireurs.filter(({ present }) => present).length);
</script>

{#each pages as lignes, i (i)}
  <FeuilleImprimee
    {contexte}
    titre={t.titre}
    numero={i + 1}
    total={pages.length}
    {imprimeLe}
    pied={t.pied(presents, tireurs.length)}
  >
    {#if i === 0}<p class="intro">{t.intro(tireurs.length)}</p>{/if}
    <table>
      <thead>
        <tr>
          <th scope="col" class="droite numero">{c.numero}</th>
          <th scope="col">{c.tireur}</th>
          <th scope="col">{c.club}</th>
          <th scope="col" class="droite classement">{c.classement}</th>
          <th scope="col" class="centre present">{c.present}</th>
          <th scope="col" class="signature">{c.signature}</th>
        </tr>
      </thead>
      <tbody>
        {#each lignes as ligne (ligne.id)}
          <tr>
            <td class="droite">{ligne.numero}</td>
            <th scope="row"><strong>{ligne.nom.toUpperCase()}</strong> {ligne.prenom}</th>
            <td>{ligne.club}</td>
            <td class="droite">{ligne.classement ?? ''}</td>
            <td class="centre"
              ><span class="case" role="img" aria-label={ligne.present ? t.pointe : c.present}
                >{ligne.present ? '✕' : ''}</span
              ></td
            >
            <td></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </FeuilleImprimee>
{/each}

<style>
  .intro {
    margin: 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  th,
  td {
    height: 7.6mm;
    padding: 0 1.5mm;
    border: 1px solid var(--papier-trait-clair);
    text-align: left;
    font-weight: 400;
  }

  thead th {
    background: var(--papier-entete);
    font-weight: 700;
  }

  .droite {
    text-align: right;
  }

  .centre {
    text-align: center;
  }

  .numero {
    width: 9mm;
  }

  .classement {
    width: 13mm;
  }

  .present {
    width: 17mm;
  }

  .signature {
    width: 45mm;
  }

  .case {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 4.2mm;
    height: 4.2mm;
    border: 1.5px solid var(--papier-encre);
    font-size: 8pt;
    font-weight: 700;
  }
</style>
