<script lang="ts">
  // Feuilles de rencontre par équipes (US-153, planche 43) : une page A4 par rencontre à tirer (des poules choisies, ou
  // d'un tour du tableau) ; les deux équipes et leurs tireurs, une case pour le numéro de chacun (1 à 3, 4 à 6), l'ordre
  // officiel des relais avec le score cumulé à atteindre, deux cases de score par relais, le score final, le vainqueur
  // et les signatures. Seul le score final est saisi dans l'application : la feuille tient le détail à la piste.
  import { relaisDeRencontre, type Equipe, type RencontreImprimee, type Tireur } from '@poule-position/domaine';
  import { textes } from '../../lib/textes';
  import FeuilleImprimee from '../FeuilleImprimee.svelte';

  interface Proprietes {
    rencontres: readonly RencontreImprimee[];
    equipes: ReadonlyMap<string, Equipe>;
    tireurs: ReadonlyMap<string, Tireur>;
    /** 2 ou 3 titulaires. */
    taille: 2 | 3;
    /** Touches de la rencontre (relais complet, ou touches des rencontres de poule). */
    touches: number;
    contexte: string;
    imprimeLe: Date;
  }

  let { rencontres, equipes, tireurs, taille, touches, contexte, imprimeLe }: Proprietes = $props();

  const t = textes.impressions.feuillesRencontre;
  const tt = textes.tableau;
  const relais = $derived(relaisDeRencontre(taille, touches));
  const nomTireur = (id: string | null) => {
    const tireur = id ? tireurs.get(id) : undefined;
    return tireur ? `${tireur.nom.toUpperCase()} ${tireur.prenom}` : null;
  };
  const titre = (r: RencontreImprimee) =>
    'poule' in r.phase ? t.poule(r.phase.poule, r.phase.numero) : t.tour(tt.nomDuTour(r.phase.tour), r.phase.numero);
</script>

{#each rencontres as rencontre, i (i)}
  {@const [a, b] = rencontre.equipes.map((id) => equipes.get(id))}
  <FeuilleImprimee
    {contexte}
    titre={t.titre}
    numero={i + 1}
    total={rencontres.length}
    {imprimeLe}
    orientation="portrait"
  >
    {#snippet aDroite()}
      <div class="phase">
        <strong>{titre(rencontre)}</strong>
        <span>{t.piste(rencontre.piste)}</span>
      </div>
    {/snippet}
    <section class="rencontre" aria-label={titre(rencontre)}>
      <div class="equipes">
        {#each [a, b] as equipe, k (k)}
          <table class="equipe">
            <caption><strong>{equipe?.nom}</strong></caption>
            <thead>
              <tr
                ><th class="num">{t.numero}</th><th>{t.tireurs(k === 0 ? 1 : 4, k === 0 ? taille : taille + 3)}</th></tr
              >
            </thead>
            <tbody>
              {#each equipe?.titulaires ?? [] as id (id)}
                <tr><td class="num"></td><td>{nomTireur(id)}</td></tr>
              {/each}
              <tr
                ><td class="num"></td><td class="discret">{t.remplacant(nomTireur(equipe?.remplacant ?? null))}</td></tr
              >
            </tbody>
          </table>
        {/each}
      </div>

      <table class="relais">
        <thead>
          <tr>
            <th>{t.relais}</th>
            <th>{t.tireursRelais}</th>
            <th>{t.jusqua}</th>
            <th>{a?.nom}</th>
            <th>{b?.nom}</th>
            <th>{t.paraphe}</th>
          </tr>
        </thead>
        <tbody>
          {#each relais as r (r.numero)}
            <tr>
              <td>{r.numero}</td>
              <td class="fort">{r.tireurs[0]} – {r.tireurs[1]}</td>
              <td>{r.jusqua}</td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          {/each}
        </tbody>
      </table>

      <p class="explication">{t.explication(touches)}</p>

      <div class="final">
        <strong>{t.scoreFinal}</strong>
        <span>{a?.nom} <span class="ligne"></span> – <span class="ligne"></span> {b?.nom}</span>
        <span>{t.vainqueur} <span class="ligne longue"></span></span>
      </div>

      <div class="signatures">
        <div>{t.arbitre}</div>
        <div>{t.capitaine(a?.nom ?? '')}</div>
        <div>{t.capitaine(b?.nom ?? '')}</div>
      </div>
    </section>
  </FeuilleImprimee>
{/each}

<style>
  .phase {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-size: 11pt;
  }

  .rencontre {
    display: flex;
    flex-direction: column;
    gap: 5mm;
    font-size: 10pt;
  }

  .equipes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5mm;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  caption {
    padding-bottom: 1.5mm;
    font-size: 11pt;
    text-align: left;
  }

  th,
  td {
    height: 7mm;
    padding: 1mm 2mm;
    border: 1px solid var(--papier-encre);
  }

  th {
    font-weight: 700;
  }

  .equipe td,
  .equipe th {
    text-align: left;
  }

  .num {
    width: 12mm;
    text-align: center;
  }

  .relais td,
  .relais th {
    height: 8.5mm;
    text-align: center;
  }

  .fort {
    font-weight: 700;
  }

  .discret,
  .explication {
    color: var(--papier-encre-discrete);
  }

  .explication {
    margin: 0;
  }

  .final {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 4mm;
    padding: 3mm 4mm;
    border: 2px solid var(--papier-encre);
  }

  .ligne {
    display: inline-block;
    width: 15mm;
    border-bottom: 1px solid var(--papier-encre);
  }

  .ligne.longue {
    width: 40mm;
  }

  .signatures {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5mm;
    margin-top: 4mm;
  }

  .signatures div {
    padding-top: 1.5mm;
    border-top: 1px solid var(--papier-encre);
  }
</style>
