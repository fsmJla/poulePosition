<script lang="ts">
  // « Mes matchs » du tireur (US-104, planches 18 et 18 bis) : « C'est à vous » (ou son prochain match), le classement
  // provisoire de sa poule, ses matchs terminés et les autres matchs de sa poule à tirer, qu'il peut saisir si les
  // Paramètres le permettent. Tout vient de la vue de saisie de la table.
  import { matchsDuTireur, tireurDeLaVue, type MatchDeLaPiste, type VueSaisie } from '@poule-position/domaine';
  import { textes } from '../lib/textes';

  interface Proprietes {
    vue: VueSaisie | null;
    tireurId: string;
    oublier: () => void;
    saisir: (match: MatchDeLaPiste) => void;
    /** US-102 : saisie suspendue (table déconnectée). */
    suspendue: boolean;
  }

  let { vue, tireurId, oublier, saisir, suspendue }: Proprietes = $props();

  const t = textes.saisie.tireur;

  const moi = $derived(tireurDeLaVue(vue, tireurId));
  const matchs = $derived(matchsDuTireur(vue, tireurId));
  const noms = $derived(new Map((matchs?.poule.tireurs ?? []).map((x) => [x.id, x])));
  const peutSaisir = $derived(vue?.droits.tireurSaisitPoule ?? false);
  const dames = $derived(vue?.sexe === 'dames');
  const adversaire = (m: MatchDeLaPiste) => noms.get(m.tireurA === tireurId ? m.tireurB : m.tireurA);
  const paire = (m: MatchDeLaPiste) => `${noms.get(m.tireurA)?.nom ?? ''} – ${noms.get(m.tireurB)?.nom ?? ''}`;
  const indice = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
</script>

<main class="mes-matchs">
  <div class="tete">
    <div class="titre">
      <h1>{moi ? `${moi.prenom} ${moi.nom}` : ''}</h1>
      {#if moi}<span class="discret">{t.resume(moi.poule, moi.piste, moi.club)}</span>{/if}
    </div>
    <button type="button" class="lien" onclick={oublier}>{t.cePasMoi}</button>
  </div>

  {#if matchs?.retrait}
    <p class="carte" role="status">{t.retire(dames, textes.saisie.tireur.motifs[matchs.retrait])}</p>
  {:else if matchs?.prochain}
    {@const prochain = matchs.prochain}
    {@const lui = adversaire(prochain)}
    <section class="carte" class:active={matchs.aVous} aria-labelledby="titre-prochain">
      <h2 id="titre-prochain" class="accent">
        {matchs.aVous ? t.aVous(prochain.numero) : t.prochain(prochain.numero)}
      </h2>
      <div class="contre">
        {t.contre} <strong>{lui?.nom}</strong>
        {lui?.prenom} <span class="discret">· {lui?.club}</span>
      </div>
      {#if !matchs.aVous}
        <span class="discret">{t.dansEnviron(matchs.avant)}</span>
      {:else if !peutSaisir}
        <span class="discret">{t.parLArbitre}</span>
      {:else}
        <button type="button" class="principal" disabled={suspendue} onclick={() => saisir(prochain)}
          >{suspendue ? textes.saisie.arbitre.suspendue : textes.saisie.arbitre.saisirScore}</button
        >
      {/if}
      {#if matchs.aVous && matchs.ensuite}
        {@const suivant = adversaire(matchs.ensuite)}
        <span class="discret"
          >{t.ensuite(matchs.ensuite.numero, `${suivant?.nom} ${suivant?.prenom}`, matchs.avantEnsuite)}</span
        >
      {/if}
    </section>
  {:else if matchs}
    <p class="carte" role="status">{t.pouleTerminee}</p>
  {/if}

  {#if matchs}
    <section aria-labelledby="titre-poule">
      <h2 id="titre-poule" class="intertitre">{t.classement}</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Rg</th>
            <th scope="col">{dames ? t.tireuse : t.tireurColonne}</th>
            <th scope="col" title="Victoires sur matchs">V/M</th>
            <th scope="col" title="Indice">Ind</th>
          </tr>
        </thead>
        <tbody>
          {#each matchs.poule.classement as ligne (ligne.tireurId)}
            {@const x = noms.get(ligne.tireurId)}
            <tr class:moi={ligne.tireurId === tireurId}>
              <td class="discret">{ligne.retrait ? '' : ligne.rang}</td>
              <td>{x?.nom} {x?.prenom}</td>
              <td class="nombre">{ligne.victoires}/{ligne.matchs}</td>
              <td class="nombre">{indice(ligne.indice)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </section>

    <section aria-labelledby="titre-mes">
      <h2 id="titre-mes" class="intertitre">{t.mesTermines}</h2>
      {#if matchs.termines.length === 0}
        <p class="discret">{textes.saisie.arbitre.aucunTermine}</p>
      {:else}
        <ul>
          {#each matchs.termines as m (m.numero)}
            <li>
              <span class="pastille" class:defaite={!m.victoire}>{m.victoire ? 'V' : 'D'}</span>
              <span class="flex">{t.contre} {m.adversaire}</span>
              <span class="score">{m.forfait ? textes.saisie.arbitre.forfait : `${m.score[0]}–${m.score[1]}`}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if peutSaisir && !matchs.retrait && matchs.autres.length > 0}
      <!-- Planche 18 bis : les autres matchs de sa poule, qu'il peut saisir sans arbitre équipé. -->
      <section aria-labelledby="titre-autres">
        <h2 id="titre-autres" class="intertitre">{t.autres}</h2>
        <p class="discret">{t.autresExplication(dames)}</p>
        <ul>
          {#each matchs.autres as m (m.numero)}
            <li>
              <button
                type="button"
                class="ligne"
                aria-label={t.saisirMatch(m.numero, paire(m))}
                disabled={suspendue}
                onclick={() => saisir(m)}
              >
                <span class="numero">{m.numero}</span>
                <span class="flex">{paire(m)}</span>
                <span class="accent">{t.saisir}</span>
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}
</main>

<style>
  .mes-matchs {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }

  .tete {
    display: flex;
    align-items: flex-end;
    gap: 12px;
  }

  .titre {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    line-height: 1.2;
  }

  h2 {
    margin: 0;
    font-family: var(--police-texte);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .intertitre {
    margin-bottom: 6px;
    color: var(--texte-discret);
  }

  p {
    margin: 0;
  }

  .discret {
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .accent {
    color: var(--accent);
    font-weight: 600;
  }

  .carte {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
  }

  .carte.active {
    border: 2px solid var(--accent);
  }

  .contre {
    font-size: 1.0625rem;
  }

  .contre strong {
    font-weight: 600;
  }

  .principal {
    height: 52px;
    border: none;
    border-radius: var(--rayon);
    background: var(--palette-tiffany);
    color: var(--sur-tiffany);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .principal:disabled {
    background: var(--surface-2);
    color: var(--texte-discret);
    cursor: not-allowed;
  }

  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    border: 1px solid var(--bordure);
    border-radius: 12px;
    background: var(--surface);
    font-size: 0.9375rem;
    overflow: hidden;
  }

  th {
    padding: 6px 4px;
    color: var(--texte-discret);
    font-size: 0.8125rem;
    font-weight: 600;
    text-align: left;
  }

  th:first-child,
  td:first-child {
    width: 28px;
    padding-left: 12px;
  }

  td {
    padding: 6px 4px;
    border-top: 1px solid var(--bordure);
  }

  th:last-child,
  td:last-child {
    padding-right: 12px;
  }

  .nombre {
    text-align: right;
  }

  tr.moi td {
    background: var(--accent-teinte);
    font-weight: 600;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--bordure);
    border-radius: 12px;
    background: var(--surface);
  }

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 0 14px;
    font-size: 0.9375rem;
  }

  li + li {
    border-top: 1px solid var(--bordure);
  }

  li:has(.ligne) {
    padding: 0;
  }

  .ligne {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
    padding: 0 14px;
    border: none;
    background: transparent;
    color: var(--texte);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .ligne:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .numero {
    width: 22px;
    color: var(--texte-discret);
  }

  .flex {
    flex: 1;
  }

  .score {
    font-weight: 600;
  }

  .pastille {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    background: var(--etat-ok-fond);
    color: var(--sur-etat-ok-fond);
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .pastille.defaite {
    background: var(--surface-2);
    color: var(--texte-discret);
  }

  .lien {
    min-height: 44px;
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    font-size: 0.9375rem;
    font-weight: 600;
    text-decoration: underline;
    cursor: pointer;
  }
</style>
