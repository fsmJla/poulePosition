<script lang="ts" module>
  export interface ScoreTableau {
    touchesA: number;
    touchesB: number;
    auTemps: boolean;
    /** À égalité : le vainqueur par priorité, `A` (à gauche) ou `B` (à droite). */
    priorite: 'A' | 'B' | null;
  }
</script>

<script lang="ts">
  // Saisie d'un match du tableau sur smartphone (US-106, planche 15 ; US-118) : l'afficheur et le pavé à la demande,
  // comme la poule (US-099), en 15 touches : un pavé 0 à N−1 et « V » en quatre colonnes. Une égalité ferme le pavé et
  // demande le vainqueur par priorité. Sous la saisie, l'extrait du tableau : ce match, son voisin et le match suivant,
  // où le vainqueur s'inscrit.
  import {
    boutonsDuScore,
    choisirSurPave,
    controleScoreTableau,
    ouvrirCotePave,
    paveDuScore,
    paveVierge,
    placesAffichees,
    scoreTableauDesBoutons,
    type ChoixScore,
    type EtatPave,
    type MatchTableauVue,
    type PlaceVue,
    type TireurVue,
    type VueSaisie,
  } from '@poule-position/domaine';
  import type { Accuse } from '@poule-position/protocole';
  import { textes } from '../lib/textes';
  import Icone from './Icone.svelte';
  import PaveScore from './PaveScore.svelte';

  interface Proprietes {
    vue: VueSaisie;
    match: MatchTableauVue;
    table: boolean;
    accuse: Accuse | null;
    /** Envoie le score ; renvoie l'identifiant de la saisie, ou null si rien n'est parti. */
    envoyer: (score: ScoreTableau) => string | null;
    retour: () => void;
    /** US-101 : correction d'un match terminé. */
    correction?: boolean;
  }

  let { vue, match, table, accuse, envoyer, retour, correction = false }: Proprietes = $props();

  const t = textes.saisie.tableau;
  const tm = textes.saisie.match;
  const tt = textes.tableau;
  const touches = $derived(vue.tableau?.touches ?? 15);
  const tireurs = $derived(
    new Map<string, TireurVue>(vue.poules.flatMap((poule) => poule.tireurs.map((x) => [x.id, x] as const))),
  );
  // svelte-ignore state_referenced_locally
  const { places, touches: depart } = placesAffichees(match);
  // US-101, US-118 CA-5 : en correction, les cases montrent le score actuel, pavé fermé.
  // svelte-ignore state_referenced_locally
  let pave = $state<EtatPave>(
    correction && depart
      ? paveDuScore(...boutonsDuScore(depart[0], depart[1], vue.tableau?.touches ?? 15))
      : paveVierge(),
  );
  let refus = $state<string | null>(null);
  let priorite = $state<'A' | 'B' | null>(null);
  let envoyee = $state<string | null>(null);
  let heure = $state('');

  const brut = $derived(
    pave.actif === null && pave.valeurs[0] !== null && pave.valeurs[1] !== null
      ? scoreTableauDesBoutons(pave.valeurs[0], pave.valeurs[1], touches)
      : null,
  );
  const scoreA = $derived(brut?.ok ? brut.touchesA : null);
  const scoreB = $derived(brut?.ok ? brut.touchesB : null);
  const egalite = $derived(scoreA !== null && scoreA === scoreB);
  const controle = $derived(
    scoreA === null || scoreB === null
      ? null
      : controleScoreTableau(scoreA, scoreB, touches, egalite ? priorite : null),
  );
  const nom = (place: PlaceVue) => (place.tireurId ? (tireurs.get(place.tireurId)?.nom ?? '') : '');
  const nomComplet = (place: PlaceVue) => {
    const tireur = place.tireurId ? tireurs.get(place.tireurId) : undefined;
    return tireur ? `${tireur.nom} ${tireur.prenom}` : '';
  };
  const message = $derived.by(() => {
    if (refus) return { texte: refus, erreur: true };
    if (scoreA === null || scoreB === null) return { texte: '', erreur: false };
    if (egalite && !priorite) return { texte: '', erreur: false };
    if (!controle?.ok) return { texte: tm.pasDEgalite, erreur: true };
    const gagne = controle.vainqueur === 'A' ? places[0] : places[1];
    const [haut, bas] = [Math.max(scoreA, scoreB), Math.min(scoreA, scoreB)];
    if (egalite) return { texte: t.victoirePriorite(nom(gagne), scoreA), erreur: false };
    return {
      texte: controle.auTemps ? t.victoireAuTemps(nom(gagne), haut, bas) : t.victoire(nom(gagne), haut, bas),
      erreur: false,
    };
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
  const inchange = $derived(correction && depart !== null && scoreA === depart[0] && scoreB === depart[1]);

  function envoyerScore() {
    if (!controle?.ok || inchange || scoreA === null || scoreB === null) return;
    envoyee = envoyer({
      touchesA: scoreA,
      touchesB: scoreB,
      auTemps: controle.auTemps,
      priorite: egalite ? priorite : null,
    });
  }

  /** US-118 CA-5 : deux choix complètent le score ; deux « V » font recommencer ; une égalité attend la priorité. */
  function choisir(valeur: ChoixScore) {
    const r = choisirSurPave(pave, valeur);
    pave = r.etat;
    refus = null;
    priorite = null;
    if (!r.complet) return;
    const essai = scoreTableauDesBoutons(r.etat.valeurs[0]!, r.etat.valeurs[1]!, touches);
    if (!essai.ok) {
      refus = tm.unSeulVainqueur;
      pave = paveVierge();
    }
  }
  const tireurPave = (place: PlaceVue, cote: string) => ({
    nom: nom(place),
    prenom: tireurs.get(place.tireurId ?? '')?.prenom ?? '',
    detail: t.tete(place.rang, cote),
  });
  /** L'extrait du tableau montre le score en cours de saisie. */
  const cotes = $derived([{ score: scoreA }, { score: scoreB }]);

  // L'extrait du tableau : ce match, son voisin (l'autre match qui alimente le match suivant) et le match suivant.
  const tous = $derived(vue.tableau?.matchs ?? []);
  const suivant = $derived(
    tous.find((m) => m.tour !== 0 && (m.haut.provenance === match.id || m.bas.provenance === match.id)) ?? null,
  );
  const voisin = $derived(
    suivant
      ? (tous.find((m) => m.id !== match.id && (m.id === suivant.haut.provenance || m.id === suivant.bas.provenance)) ??
          null)
      : null,
  );
  const libelle = (m: MatchTableauVue, place: PlaceVue) => {
    if (place.tireurId) return nomComplet(place);
    if (!place.provenance) return '';
    const [taille, numero] = place.provenance.split('-').map(Number) as [number, number];
    return tt.provenance(taille, numero, m.tour === 0);
  };
</script>

{#snippet extrait(m: MatchTableauVue, courant: boolean)}
  {@const { places: p, touches: s } = placesAffichees(m)}
  <div class="match-extrait" class:courant>
    {#each [0, 1] as i (i)}
      {@const place = p[i as 0 | 1]}
      <span class="ligne"
        ><span class="rang">{place.rang ?? ''}</span><span class="nom">{libelle(m, place)}</span><span class="score"
          >{s ? s[i] : courant && cotes[i]?.score !== null ? cotes[i]?.score : ''}</span
        ></span
      >
    {/each}
    <span class="etat"
      >{courant ? `${m.tour === 0 ? t.troisieme : `Match ${m.numero}`} · ${t.enSaisie}` : tt.etatMatch(m)}</span
    >
  </div>
{/snippet}

<header class="entete">
  <button type="button" class="retour" aria-label={tm.retourAuxMatchs} title={tm.retour} onclick={retour}>
    <Icone nom="flecheGauche" />
  </button>
  <div class="titres">
    <span class="titre"
      >{correction
        ? t.titreCorrection(match.numero, tt.nomDuTour(match.tour))
        : match.tour === 0
          ? t.troisieme
          : t.titre(match.numero, tt.nomDuTour(match.tour))}</span
    >
    <span class="sous-titre">{t.sousTitre(match.piste, vue.nom, touches)}</span>
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
  <PaveScore
    format="telephone"
    tireurs={[tireurPave(places[0], tm.gauche), tireurPave(places[1], tm.droite)]}
    {touches}
    etat={pave}
    vEnChiffre
    desactive={etape !== 'saisie'}
    {choisir}
    ouvrir={(cote) => {
      pave = ouvrirCotePave(pave, cote);
      refus = null;
      priorite = null;
    }}
  >
    {#snippet ferme()}
      {#if etape === 'saisie' && egalite}
        <p class="egalite">{textes.pave.priorite}</p>
        <div class="priorite" role="group" aria-label={t.priorite}>
          {#each [{ cote: 'A', place: places[0], classe: 'gauche' }, { cote: 'B', place: places[1], classe: 'droite' }] as const as p (p.cote)}
            <button
              type="button"
              class="pour {p.classe}"
              aria-pressed={priorite === p.cote}
              onclick={() => (priorite = p.cote)}>{nomComplet(p.place)}</button
            >
          {/each}
        </div>
      {:else if etape === 'saisie'}
        <p class="invite">{textes.pave.corriger}</p>
      {/if}
    {/snippet}
  </PaveScore>

  <p class="message" class:erreur={message.erreur} role="status">{etape === 'saisie' ? message.texte : ''}</p>

  {#if etape === 'saisie'}
    <div class="actions">
      <button type="button" class="neutre" onclick={retour}>{tm.retour}</button>
      <button type="button" class="principal" disabled={!controle?.ok || !table || inchange} onclick={envoyerScore}
        >{correction ? tm.envoyerCorrection : tm.envoyer}</button
      >
    </div>
    {#if !table}<p class="note">{tm.suspendue}</p>{/if}
  {:else if etape === 'attente'}
    <div class="bandeau" role="status"><Icone nom="avion" /><span>{tm.enAttente}</span></div>
  {:else if etape === 'acceptee'}
    <div class="bandeau ok" role="status"><Icone nom="coche" /><span>{tm.enregistre(heure)}</span></div>
    <button type="button" class="principal" onclick={retour}>{tm.retourMatchs}</button>
  {:else}
    <div class="bandeau refus" role="alert">
      <Icone nom="alerte" />
      <span>{etape === 'refuse' && accuse?.motif ? tm.motifs[accuse.motif] : tm.suspendue}</span>
    </div>
    <button type="button" class="neutre" onclick={retour}>{tm.retourMatchs}</button>
  {/if}

  <section class="extrait" aria-labelledby="titre-extrait">
    <h2 id="titre-extrait">{t.dansLeTableau}</h2>
    <div class="colonnes-extrait">
      <div class="colonne-extrait">
        <h3>{match.tour === 0 ? t.troisieme : tt.nomDuTour(match.tour)}</h3>
        {@render extrait(match, true)}
        {#if voisin}{@render extrait(voisin, false)}{/if}
      </div>
      {#if suivant}
        <div class="colonne-extrait">
          <h3>{tt.nomDuTour(suivant.tour)}</h3>
          {@render extrait(suivant, false)}
        </div>
      {/if}
    </div>
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

  .egalite {
    margin: 0;
    color: var(--sur-etat-attente-fond);
    font-weight: 600;
    text-align: center;
  }

  .invite {
    margin: 0;
    color: var(--texte-discret);
    font-size: 0.9375rem;
    text-align: center;
  }

  .priorite {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .pour {
    min-height: 52px;
    border: 2px solid var(--cote);
    border-radius: 999px;
    background: var(--surface);
    color: var(--cote);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .pour.gauche {
    --cote: var(--cote-gauche);
  }

  .pour.droite {
    --cote: var(--cote-droit);
  }

  .pour[aria-pressed='true'] {
    background: var(--cote);
    color: var(--sur-cote);
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
    color: var(--sur-etat-attente-fond);
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

  .extrait {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .extrait h2 {
    margin: 0;
    font-family: var(--police-texte);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--texte-discret);
  }

  .colonnes-extrait {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    align-items: center;
  }

  .colonne-extrait {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .colonne-extrait h3 {
    margin: 0;
    text-align: center;
    font-size: 0.8125rem;
    font-weight: 400;
  }

  .match-extrait {
    display: flex;
    flex-direction: column;
    padding: 4px 8px;
    border: 1px solid var(--bordure);
    border-radius: 10px;
    background: var(--surface);
    font-size: 0.8125rem;
  }

  .match-extrait.courant {
    border: 2px solid var(--accent);
  }

  .ligne {
    display: flex;
    gap: 6px;
  }

  .rang {
    min-width: 1rem;
    color: var(--texte-discret);
  }

  .nom {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .score {
    font-weight: 600;
  }

  .etat {
    color: var(--texte-discret);
    font-size: 0.75rem;
  }
</style>
