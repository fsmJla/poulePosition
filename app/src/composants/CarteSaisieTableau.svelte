<script lang="ts">
  // Carte de saisie d'un match du tableau sur le PC (US-111, planche 11 ; US-117, variante « 1 bis » du canevas) : en
  // tête le match, sa piste et l'appel sur une piste ; au centre l'afficheur et le pavé de score à la demande ; en pied
  // « Abandon, forfait, exclusion… » et l'état de la saisie. Deux choix enregistrent le score ; une égalité demande le
  // vainqueur par priorité, dont le choix enregistre. Le contrôle est celui du domaine.
  import {
    boutonsDuScore,
    choisirSurPave,
    controleScoreTableau,
    matchsSuivants,
    ouvrirCotePave,
    paveDuScore,
    paveVierge,
    placesAffichees,
    scoreTableauDesBoutons,
    type ChoixScore,
    type DonneesScoreTableau,
    type EtatPave,
    type MatchTableau,
    type StructureTableau,
    type Tireur,
  } from '@poule-position/domaine';
  import type { Snippet } from 'svelte';
  import { textes } from '../lib/textes';
  import PaveScore, { coteDePiste, ordreDePiste } from './PaveScore.svelte';

  interface Proprietes {
    match: MatchTableau;
    structure: StructureTableau;
    tireurs: ReadonlyMap<string, Tireur>;
    /** Touches du tableau, d'après la formule en vigueur (US-028). */
    touches: number;
    modifiable: boolean;
    /** Écrit le score ; vrai s'il est enregistré. */
    saisir: (donnees: DonneesScoreTableau) => Promise<boolean>;
    choisir: (id: string) => void;
    /** Actions secondaires de la carte, en pied (retrait : US-113). */
    actions?: Snippet;
    /** US-112, US-117 : l'appel du match sur une piste, en tête. */
    appel?: Snippet;
  }

  let { match, structure, tireurs, touches, modifiable, saisir, choisir, actions, appel }: Proprietes = $props();

  const t = textes.tableau;
  const tp = textes.pave;
  const places = $derived(placesAffichees(match));
  const [haut, bas] = $derived(places.places);
  const nom = (id: string | null) => {
    const tireur = id ? tireurs.get(id) : undefined;
    return tireur ? `${tireur.nom.toUpperCase()} ${tireur.prenom}` : '';
  };
  const nomCourt = (id: string | null) => (id ? (tireurs.get(id)?.nom.toUpperCase() ?? '') : '');

  let pave = $state<EtatPave>(paveVierge());
  /** US-159 : le tireur du haut, appelé en premier, à droite de l'arbitre (FIE t.22.1), sauf inversion (un gaucher). */
  let inverse = $state(false);
  const idMatch = $derived(match.id);
  $effect(() => {
    void idMatch;
    inverse = false;
  });
  let erreur = $state<string | null>(null);
  let envoi = $state(false);
  let matchAffiche = '';

  // Le match change (choix dans l'arbre, ou score reçu) : un match à tirer part de rien, un match terminé reprend son
  // score, pavé fermé.
  $effect(() => {
    const cle = `${match.id}|${match.touches?.join('-') ?? ''}|${match.vainqueur ?? ''}`;
    if (cle === matchAffiche) return;
    matchAffiche = cle;
    pave = places.touches
      ? paveDuScore(...boutonsDuScore(places.touches[0], places.touches[1], touches))
      : paveVierge();
    erreur = null;
  });

  /** CA-7 : un match réglé dont le match suivant est réglé ne se corrige plus. */
  const suivantRegle = $derived(
    match.etat === 'regle' ? (matchsSuivants(structure, match.id).find((m) => m.etat === 'regle') ?? null) : null,
  );
  const saisissable = $derived(
    modifiable && (match.etat === 'aTirer' || (match.etat === 'regle' && !match.retrait && !suivantRegle)),
  );
  const piste = $derived(
    match.piste === null
      ? t.pisteAAttribuer
      : match.enPiste || match.etat === 'regle'
        ? t.appele(match.piste, match.appeleA ?? 0)
        : t.enFile(match.piste),
  );

  /** Le score complet des deux choix de cette saisie, à égalité : le vainqueur reste à désigner par la priorité. */
  const egaliteADepartager = $derived.by(() => {
    const [a, b] = pave.valeurs;
    if (pave.actif !== null || !pave.vus[0] || !pave.vus[1] || a === null || b === null) return false;
    const brut = scoreTableauDesBoutons(a, b, touches);
    return brut.ok && brut.touchesA === brut.touchesB;
  });

  async function enregistrer(touchesA: number, touchesB: number, priorite: 'A' | 'B' | null) {
    const controle = controleScoreTableau(touchesA, touchesB, touches, priorite);
    if (!controle.ok || !haut.tireurId || !bas.tireurId || envoi) return;
    envoi = true;
    const vainqueur = controle.vainqueur === 'A' ? haut.tireurId : bas.tireurId;
    await saisir({
      match: match.id,
      tireurA: haut.tireurId,
      tireurB: bas.tireurId,
      touchesA,
      touchesB,
      ...(touchesA === touchesB ? { parPriorite: vainqueur } : {}),
    });
    envoi = false;
  }

  /** US-117 : deux choix enregistrent ; deux « V » font recommencer ; une égalité attend la priorité. */
  function choisirValeur(valeur: ChoixScore) {
    if (!saisissable || envoi) return;
    const r = choisirSurPave(pave, valeur);
    pave = r.etat;
    erreur = null;
    if (!r.complet) return;
    const brut = scoreTableauDesBoutons(r.etat.valeurs[0]!, r.etat.valeurs[1]!, touches);
    if (!brut.ok) {
      erreur = textes.poules.unSeulVainqueur;
      pave = paveVierge();
      return;
    }
    if (brut.touchesA !== brut.touchesB) void enregistrer(brut.touchesA, brut.touchesB, null);
  }

  function choisirPriorite(cote: 'A' | 'B') {
    const brut = scoreTableauDesBoutons(pave.valeurs[0]!, pave.valeurs[1]!, touches);
    if (brut.ok) void enregistrer(brut.touchesA, brut.touchesB, cote);
  }

  const tireurPave = (place: typeof haut) => ({
    nom: nomCourt(place.tireurId),
    prenom: tireurs.get(place.tireurId ?? '')?.prenom ?? '',
    rang: place.rang,
  });
</script>

<section class="carte" aria-label={t.carteSaisie}>
  <header class="entete">
    <div class="identite">
      <h3>{t.titreMatch(match.tour, match.numero)}</h3>
      <span class="discret">{piste}</span>
    </div>
    {#if modifiable && match.etat === 'aTirer'}{@render appel?.()}{/if}
  </header>

  {#if match.etat === 'attente'}
    <p class="discret attente">
      {t.enAttenteDe(
        haut.tireurId
          ? t.provenance(...(bas.provenance!.split('-').map(Number) as [number, number]), match.tour === 0)
          : t.provenance(...(haut.provenance!.split('-').map(Number) as [number, number]), match.tour === 0),
      )}
    </p>
  {:else if match.retrait}
    <p class="attente">{t.retraitConstat(t.motifCourt(match.retrait.motif), nom(match.retrait.tireurId))}</p>
    <footer class="pied">{@render actions?.()}</footer>
  {:else}
    <div class="corps">
      <PaveScore
        format="large"
        tireurs={[tireurPave(haut), tireurPave(bas)]}
        {touches}
        etat={pave}
        vEnChiffre
        desactive={!saisissable || envoi}
        {inverse}
        inverser={() => (inverse = !inverse)}
        choisir={choisirValeur}
        ouvrir={(cote) => {
          pave = ouvrirCotePave(pave, cote);
          erreur = null;
        }}
      >
        {#snippet ferme()}
          {#if saisissable && egaliteADepartager}
            <p class="egalite">{tp.priorite}</p>
            <div class="priorite" role="group" aria-label={tp.prioriteGroupe}>
              {#each ordreDePiste(inverse) as k (k)}
                <button
                  type="button"
                  class="pour {coteDePiste(k, inverse)}"
                  disabled={envoi}
                  onclick={() => choisirPriorite(k === 0 ? 'A' : 'B')}>{nom((k === 0 ? haut : bas).tireurId)}</button
                >
              {/each}
            </div>
          {:else if suivantRegle}
            <p class="discret">
              {t.corrigerDabord(t.titreMatch(suivantRegle.tour, suivantRegle.numero).toLowerCase())}
            </p>
            <button type="button" class="secondaire" onclick={() => choisir(suivantRegle.id)}
              >{t.titreMatch(suivantRegle.tour, suivantRegle.numero)}</button
            >
          {:else if match.parPriorite && !egaliteADepartager}
            <p class="discret">{t.prioriteMention} : {nomCourt(match.vainqueur)}</p>
          {:else if saisissable}
            <p class="discret">{tp.corriger}</p>
          {/if}
        {/snippet}
      </PaveScore>
    </div>
    <footer class="pied">
      <div class="actions">{@render actions?.()}</div>
      {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
    </footer>
  {/if}
</section>

<style>
  .carte {
    /* US-117 : des touchers rapprochés ne sont pas un double-toucher de zoom. */
    touch-action: manipulation;
    border: 2px solid var(--accent);
    border-radius: 14px;
    background: var(--surface);
    overflow: hidden;
  }

  .entete {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--bordure);
  }

  .identite {
    display: flex;
    flex-direction: column;
  }

  h3 {
    margin: 0;
    font-family: var(--police-titre, inherit);
    font-size: 1.15rem;
  }

  .discret {
    margin: 0;
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .attente {
    margin: 0;
    padding: 16px;
  }

  .corps {
    padding: 20px 16px 8px;
  }

  .pied {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    min-height: 44px;
    padding: 12px 16px;
    border-top: 1px solid var(--bordure);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .erreur {
    margin: 0;
    color: var(--etat-erreur);
    font-weight: 600;
  }

  .egalite {
    margin: 0;
    color: var(--sur-etat-attente-fond);
    font-weight: 600;
  }

  .priorite {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }

  .pour {
    min-height: 44px;
    padding: 0 18px;
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

  .secondaire {
    min-height: 44px;
    padding: 0 16px;
    border: 1px solid var(--bordure-champ);
    border-radius: 10px;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
</style>
