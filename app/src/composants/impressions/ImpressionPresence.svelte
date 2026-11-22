<script lang="ts">
  // Feuille de présence (US-121, planche 23) : les inscrits par ordre alphabétique, case « Présent » (cochée s'il est
  // pointé à l'émargement, US-084) et case de signature ; 28 lignes par page, l'en-tête du tableau répété. US-154 CA-1 :
  // par équipes, les tireurs sont groupés par équipe (dans l'ordre de leur rang), avec la colonne « Équipe ».
  import { decouperEnPages, lignesPresence, type Tireur } from '@poule-position/domaine';
  import { textes } from '../../lib/textes';
  import FeuilleImprimee from '../FeuilleImprimee.svelte';

  interface Proprietes {
    tireurs: readonly Tireur[];
    contexte: string;
    imprimeLe: Date;
    /** US-154 : par équipes, les équipes rangées et leurs membres (titulaires, puis remplaçant). */
    equipes?: readonly { nom: string; membres: readonly string[] }[];
  }

  let { tireurs, contexte, imprimeLe, equipes }: Proprietes = $props();
  const equipeDe = $derived(
    new Map(
      (equipes ?? []).flatMap(({ nom, membres }, rang) => membres.map((id, i) => [id, { nom, rang, i }] as const)),
    ),
  );
  /** Par équipes : l'ordre des équipes, puis celui des membres ; les tireurs sans équipe à la fin. */
  const ordonnes = $derived.by(() => {
    const lignes = lignesPresence(tireurs);
    if (!equipes) return lignes;
    const cle = (id: string) => {
      const e = equipeDe.get(id);
      return e ? e.rang * 10 + e.i : Number.MAX_SAFE_INTEGER;
    };
    return [...lignes].sort((a, b) => cle(a.id) - cle(b.id)).map((l, i) => ({ ...l, numero: i + 1 }));
  });

  const t = textes.impressions.presence;
  const c = t.colonnes;
  const pages = $derived(decouperEnPages(ordonnes, 28));
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
          {#if equipes}<th scope="col">{c.equipe}</th>{/if}
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
            {#if equipes}<td>{equipeDe.get(ligne.id)?.nom ?? ''}</td>{/if}
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
