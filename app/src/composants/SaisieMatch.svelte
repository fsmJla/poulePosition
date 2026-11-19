<script lang="ts">
  // Saisie d'un match de poule sur smartphone (US-099, planche 14) : une colonne par tireur (gauche en rouge, droite en
  // vert, et dit en toutes lettres), boutons 0 à N−1 puis « V ». Le score s'envoie à la table, qui l'enregistre ou le
  // refuse avec un motif. La feuille de la poule reste visible sous la saisie, la case du match encadrée.
  import {
    boutonsDuScore,
    scoreDesBoutons,
    type ChoixScore,
    type MatchDeLaPiste,
    type PouleVue,
    type TireurVue,
    type VueSaisie,
  } from '@poule-position/domaine';
  import type { Accuse } from '@poule-position/protocole';
  import { textes } from '../lib/textes';
  import Icone from './Icone.svelte';

  interface Proprietes {
    vue: VueSaisie;
    match: MatchDeLaPiste;
    piste: number;
    table: boolean;
    /** Accusé de la saisie envoyée, s'il est arrivé. */
    accuse: Accuse | null;
    /** Envoie le score ; renvoie l'identifiant de la saisie, ou null si rien n'est parti. */
    envoyer: (score: { touchesA: number; touchesB: number; auTemps: boolean }) => string | null;
    /** US-101 : correction d'un match terminé (les boutons de son score sont marqués). */
    correction?: boolean;
    retour: () => void;
    /** Le match suivant à saisir, s'il y en a un. */
    suivant: MatchDeLaPiste | null;
    ouvrirSuivant: () => void;
  }

  let {
    vue,
    match,
    piste,
    table,
    accuse,
    envoyer,
    retour,
    suivant,
    ouvrirSuivant,
    correction = false,
  }: Proprietes = $props();

  const t = textes.saisie.match;

  // US-101 CA-1 : en correction, les boutons du score actuel sont marqués.
  // svelte-ignore state_referenced_locally
  const depart = correction && match.touches ? boutonsDuScore(match.touches[0], match.touches[1], vue.touches) : null;
  let choixA = $state<ChoixScore | null>(depart?.[0] ?? null);
  let choixB = $state<ChoixScore | null>(depart?.[1] ?? null);
  let envoyee = $state<string | null>(null);
  let heure = $state('');

  const poule = $derived(vue.poules.find(({ numero }) => numero === match.poule) as PouleVue);
  const tireurs = $derived(new Map<string, TireurVue>(poule.tireurs.map((x) => [x.id, x])));
  const touches = $derived(vue.touches);
  const boutons = $derived([...Array.from({ length: touches }, (_, i) => i), 'V'] as ChoixScore[]);
  const score = $derived(choixA !== null && choixB !== null ? scoreDesBoutons(choixA, choixB, touches) : null);
  const nomDe = (id: string) => tireurs.get(id)?.nom ?? '';
  const message = $derived.by(() => {
    if (!score) return '';
    if (!score.ok) return score.raison === 'DEUX_VAINQUEURS' ? t.unSeulVainqueur : t.pasDEgalite;
    const gagneA = score.touchesA > score.touchesB;
    const nom = nomDe(gagneA ? match.tireurA : match.tireurB);
    const [haut, bas] = gagneA ? [score.touchesA, score.touchesB] : [score.touchesB, score.touchesA];
    return score.auTemps ? t.victoireAuTemps(nom, haut, bas) : t.victoire(nom, haut, bas);
  });
  const etape = $derived(
    !envoyee
      ? 'saisie'
      : !accuse
        ? 'attente'
        : accuse.decision === 'accepte' || accuse.decision === 'doublon'
          ? 'acceptee'
          : accuse.decision,
  );

  $effect(() => {
    if (etape === 'acceptee' && !heure) {
      const maintenant = new Date();
      heure = `${maintenant.getHours()} h ${String(maintenant.getMinutes()).padStart(2, '0')}`;
    }
  });

  /** US-101 CA-5 : une correction identique au score actuel ne part pas. */
  const inchange = $derived(
    correction && score?.ok && match.touches?.[0] === score.touchesA && match.touches?.[1] === score.touchesB,
  );

  function envoyerScore() {
    if (!score?.ok || inchange) return;
    envoyee = envoyer({ touchesA: score.touchesA, touchesB: score.touchesB, auTemps: score.auTemps });
  }

  const cotes = $derived([
    { id: match.tireurA, choix: choixA, cote: t.gauche, classe: 'gauche', choisir: (c: ChoixScore) => (choixA = c) },
    { id: match.tireurB, choix: choixB, cote: t.droite, classe: 'droite', choisir: (c: ChoixScore) => (choixB = c) },
  ]);

  /** Cases de la feuille : le score de chaque match, et celui en cours de saisie pour le match encadré. */
  function caseDe(ligne: string, colonne: string): { texte: string; encadree: boolean; victoire: boolean } {
    const courant =
      (match.tireurA === ligne && match.tireurB === colonne) || (match.tireurB === ligne && match.tireurA === colonne);
    if (courant && score?.ok) {
      const mienne = ligne === match.tireurA ? score.touchesA : score.touchesB;
      const autre = ligne === match.tireurA ? score.touchesB : score.touchesA;
      return {
        texte: mienne > autre ? `V${mienne === touches ? '' : mienne}` : String(mienne),
        encadree: true,
        victoire: mienne > autre,
      };
    }
    const m = poule.matchs.find(
      ({ tireurA, tireurB }) =>
        (tireurA === ligne && tireurB === colonne) || (tireurB === ligne && tireurA === colonne),
    );
    if (!m?.touches) return { texte: '', encadree: courant, victoire: false };
    const mienne = m.tireurA === ligne ? m.touches[0] : m.touches[1];
    const autre = m.tireurA === ligne ? m.touches[1] : m.touches[0];
    return {
      texte: mienne > autre ? (mienne === touches ? 'V' : `V${mienne}`) : String(mienne),
      encadree: courant,
      victoire: mienne > autre,
    };
  }
  const classementDe = (id: string) => poule.classement.find(({ tireurId }) => tireurId === id);
  const paireSuivante = $derived(suivant ? `${nomDe(suivant.tireurA)} – ${nomDe(suivant.tireurB)}` : '');
</script>

<header class="entete">
  <button type="button" class="retour" aria-label={t.retourAuxMatchs} title={t.retour} onclick={retour}>
    <Icone nom="flecheGauche" />
  </button>
  <div class="titres">
    <span class="titre">{correction ? t.titreCorrection(match.numero) : t.titre(match.numero, match.poule)}</span>
    <span class="sous-titre">{t.sousTitre(piste, vue.nom, touches)}</span>
  </div>
  <span
    class="point"
    class:connectee={table}
    role="status"
    aria-label={table ? textes.saisie.tableConnectee : textes.saisie.tableDeconnectee}
    title={table ? textes.saisie.tableConnectee : textes.saisie.tableDeconnectee}
  ></span>
</header>

<main class="saisie">
  <div class="colonnes">
    {#each cotes as cote (cote.classe)}
      {@const tireur = tireurs.get(cote.id)}
      <div
        class={`colonne ${cote.classe}`}
        role="group"
        aria-label={t.score(`${tireur?.nom} ${tireur?.prenom}`, cote.cote)}
      >
        <div class="tireur">
          <span class="nom"><strong>{tireur?.nom}</strong> {tireur?.prenom}</span>
          <span class="club">{tireur?.club} · {cote.cote}</span>
        </div>
        {#each boutons as choix (choix)}
          <button
            type="button"
            class:choisi={cote.choix === choix}
            aria-pressed={cote.choix === choix}
            aria-label={t.bouton(String(choix), `${tireur?.nom} ${tireur?.prenom}`)}
            disabled={etape !== 'saisie'}
            onclick={() => cote.choisir(choix)}>{choix}</button
          >
        {/each}
      </div>
    {/each}
  </div>

  <p class="message" class:erreur={score !== null && !score.ok} role="status">{etape === 'saisie' ? message : ''}</p>

  {#if etape === 'saisie'}
    <div class="actions">
      <button type="button" class="neutre" onclick={retour}>{t.retour}</button>
      <button type="button" class="principal" disabled={!score?.ok || !table || inchange} onclick={envoyerScore}
        >{correction ? t.envoyerCorrection : t.envoyer}</button
      >
    </div>
    {#if !table}<p class="note">{t.suspendue}</p>{/if}
  {:else if etape === 'attente'}
    <div class="bandeau" role="status"><Icone nom="avion" /><span>{t.enAttente}</span></div>
  {:else if etape === 'acceptee'}
    <div class="bandeau ok" role="status"><Icone nom="coche" /><span>{t.enregistre(heure)}</span></div>
    <button type="button" class="principal" onclick={suivant ? ouvrirSuivant : retour}
      >{suivant ? t.matchSuivant(paireSuivante) : t.retourMatchs}</button
    >
  {:else}
    <div class="bandeau refus" role="alert">
      <Icone nom="alerte" />
      <span>{etape === 'refuse' && accuse?.motif ? t.motifs[accuse.motif] : t.suspendue}</span>
    </div>
    <button type="button" class="neutre" onclick={retour}>{t.retourMatchs}</button>
  {/if}

  <section class="feuille" aria-labelledby="titre-feuille">
    <h2 id="titre-feuille">{t.feuille(match.poule, match.numero)}</h2>
    <table>
      <thead>
        <tr>
          <th scope="col"><span class="invisible">Tireur</span></th>
          {#each poule.tireurs as tireur, i (tireur.id)}<th scope="col">{i + 1}</th>{/each}
          <th scope="col" title="Victoires">V</th>
          <th scope="col" title="Indice">Ind</th>
          <th scope="col" title="Rang">Rg</th>
        </tr>
      </thead>
      <tbody>
        {#each poule.tireurs as ligne, i (ligne.id)}
          {@const c = classementDe(ligne.id)}
          <tr>
            <th scope="row"><span class="nom-court">{ligne.nom}</span> <span class="ordre">{i + 1}</span></th>
            {#each poule.tireurs as colonne (colonne.id)}
              {#if colonne.id === ligne.id}
                <td class="diagonale"></td>
              {:else}
                {@const cellule = caseDe(ligne.id, colonne.id)}
                <td class:encadree={cellule.encadree} class:victoire={cellule.victoire}>{cellule.texte}</td>
              {/if}
            {/each}
            <td>{c?.victoires ?? 0}</td>
            <td>{c ? (c.indice > 0 ? `+${c.indice}` : c.indice) : 0}</td>
            <td>{c?.rang ?? ''}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
</main>

<style>
  .entete {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px 6px 4px;
    background: var(--marque);
    color: var(--sur-marque);
  }

  .retour {
    width: 44px;
    height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--rayon);
    background: transparent;
    color: var(--sur-marque);
    cursor: pointer;
  }

  .titres {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .titre {
    font-weight: 600;
    font-size: 1.0625rem;
  }

  .sous-titre {
    font-size: 0.8125rem;
    opacity: 0.9;
  }

  .point {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: var(--etat-attente);
  }

  .point.connectee {
    background: var(--etat-ok);
  }

  .saisie {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px;
  }

  .colonnes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .colonne {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .gauche {
    --cote: var(--cote-gauche);
  }

  .droite {
    --cote: var(--cote-droit);
  }

  .tireur {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 40px;
    line-height: 1.25;
    text-align: center;
  }

  .tireur .nom {
    color: var(--cote);
    font-size: 1.0625rem;
  }

  .club {
    color: var(--texte-discret);
    font-size: 0.8125rem;
  }

  .colonne button {
    height: 46px;
    border: 2px solid var(--cote);
    border-radius: 999px;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-size: 1.25rem;
    font-weight: 600;
    cursor: pointer;
  }

  .colonne button.choisi {
    background: var(--cote);
    color: var(--surface);
  }

  .colonne button:disabled {
    cursor: default;
  }

  .message {
    margin: 0;
    min-height: 24px;
    text-align: center;
    color: var(--accent);
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .message.erreur {
    color: var(--etat-erreur);
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .principal,
  .neutre {
    height: 52px;
    border-radius: 999px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .principal {
    border: none;
    background: var(--palette-tiffany);
    color: var(--sur-tiffany);
  }

  .neutre {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
  }

  .principal:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .note {
    margin: 0;
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .bandeau {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 52px;
    padding: 4px 12px;
    border-radius: 12px;
    background: var(--surface-2);
  }

  .bandeau.ok {
    justify-content: flex-start;
    background: var(--etat-ok-fond);
    color: var(--sur-etat-ok-fond);
    font-weight: 600;
  }

  .bandeau.refus {
    justify-content: flex-start;
    border: 1px solid var(--etat-erreur);
    background: var(--surface);
    color: var(--texte);
  }

  .feuille {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .feuille h2 {
    margin: 0;
    font-family: var(--police-texte);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--texte-discret);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: var(--surface);
    font-size: 0.8125rem;
    line-height: 1.2;
    table-layout: fixed;
  }

  th,
  td {
    padding: 4px 0;
    border: 1px solid var(--bordure);
    text-align: center;
  }

  thead th {
    color: var(--texte-discret);
    font-weight: 600;
  }

  thead th:first-child {
    width: 74px;
  }

  tbody th {
    padding: 4px;
    text-align: left;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ordre {
    color: var(--texte-discret);
    font-weight: 400;
  }

  .diagonale {
    background: var(--marque);
  }

  .encadree {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
    background: var(--accent-teinte);
  }

  .victoire {
    font-weight: 600;
  }

  .invisible {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
</style>
