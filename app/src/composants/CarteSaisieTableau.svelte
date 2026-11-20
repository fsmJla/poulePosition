<script lang="ts">
  // Carte de saisie d'un match du tableau (US-111, planche 11 ; US-117) : le match choisi, sa piste, et pour chaque
  // tireur une colonne de boutons de score (0 à N−1 et « V », comme les poules, US-091), 0 présélectionné ; l'action
  // principale « Valider le score ». Une égalité demande le vainqueur par priorité ; un vainqueur qui n'atteint pas les
  // touches du tableau gagne au temps. Le contrôle est celui du domaine.
  import {
    boutonsDuScore,
    controleScoreTableau,
    scoreTableauDesBoutons,
    type ChoixScore,
    matchsSuivants,
    placesAffichees,
    type DonneesScoreTableau,
    type MatchTableau,
    type StructureTableau,
    type Tireur,
  } from '@poule-position/domaine';
  import type { Snippet } from 'svelte';
  import { textes } from '../lib/textes';

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
    /** Actions secondaires de la carte (appel sur une piste, retrait : US-112, US-113). */
    actions?: Snippet;
    /** US-112 : l'appel du match sur une piste, sous la piste. */
    appel?: Snippet;
  }

  let { match, structure, tireurs, touches, modifiable, saisir, choisir, actions, appel }: Proprietes = $props();

  const t = textes.tableau;
  const places = $derived(placesAffichees(match));
  const [haut, bas] = $derived(places.places);
  const nom = (id: string | null) => {
    const tireur = id ? tireurs.get(id) : undefined;
    return tireur ? `${tireur.nom.toUpperCase()} ${tireur.prenom}` : '';
  };
  const nomCourt = (id: string | null) => (id ? (tireurs.get(id)?.nom.toUpperCase() ?? '') : '');

  let choixHaut = $state<ChoixScore>(0);
  let choixBas = $state<ChoixScore>(0);
  let priorite = $state<'haut' | 'bas' | null>(null);
  let envoi = $state(false);
  let matchAffiche = '';

  // Le match change (choix dans l'arbre, ou score reçu) : les champs reprennent son score enregistré.
  $effect(() => {
    const cle = `${match.id}|${match.touches?.join('-') ?? ''}|${match.vainqueur ?? ''}`;
    if (cle === matchAffiche) return;
    matchAffiche = cle;
    // US-117 CA-3 : un match à tirer part de 0 à 0 ; un match terminé reprend son score.
    const [a, b] = places.touches ? boutonsDuScore(places.touches[0], places.touches[1], touches) : [0, 0];
    choixHaut = a;
    choixBas = b;
    priorite = match.parPriorite ? (match.vainqueur === haut.tireurId ? 'haut' : 'bas') : null;
  });

  const boutons = $derived<ChoixScore[]>([...Array.from({ length: touches }, (_, i) => i), 'V']);
  const brut = $derived(scoreTableauDesBoutons(choixHaut, choixBas, touches));
  const touchesHaut = $derived(brut.ok ? brut.touchesA : null);
  const touchesBas = $derived(brut.ok ? brut.touchesB : null);
  /** 0 à 0 : rien de saisi encore (pas d'égalité à départager). */
  const vierge = $derived(touchesHaut === 0 && touchesBas === 0);
  const egalite = $derived(brut.ok && !vierge && touchesHaut === touchesBas);
  const controle = $derived(
    brut.ok && !vierge
      ? controleScoreTableau(
          touchesHaut!,
          touchesBas!,
          touches,
          egalite ? (priorite === 'haut' ? 'A' : priorite === 'bas' ? 'B' : null) : null,
        )
      : null,
  );
  const auTemps = $derived(controle?.ok === true && controle.auTemps);
  const vainqueur = $derived(controle?.ok ? (controle.vainqueur === 'A' ? haut.tireurId : bas.tireurId) : null);
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

  async function valider(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (!controle?.ok || envoi || !haut.tireurId || !bas.tireurId || touchesHaut === null || touchesBas === null)
      return;
    envoi = true;
    const donnees: DonneesScoreTableau = {
      match: match.id,
      tireurA: haut.tireurId,
      tireurB: bas.tireurId,
      touchesA: touchesHaut,
      touchesB: touchesBas,
      ...(egalite && vainqueur ? { parPriorite: vainqueur } : {}),
    };
    await saisir(donnees);
    envoi = false;
  }
</script>

<section class="carte" aria-label={t.carteSaisie}>
  <div class="identite">
    <h3>{t.titreMatch(match.tour, match.numero)}</h3>
    <span class="discret">{piste}</span>
    {#if modifiable && match.etat === 'aTirer'}{@render appel?.()}{/if}
  </div>

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
    <div class="actions">{@render actions?.()}</div>
  {:else}
    <form id="saisie-tableau" class="score" onsubmit={valider} novalidate>
      {#each [{ place: haut, choix: choixHaut, cote: 'gauche' }, { place: bas, choix: choixBas, cote: 'droite' }] as colonne (colonne.cote)}
        <div
          class="colonne {colonne.cote}"
          role="group"
          aria-label={textes.poules.boutonsDe(nom(colonne.place.tireurId))}
        >
          <p class="tireur">
            <span class="rang">({colonne.place.rang})</span>
            <strong>{nomCourt(colonne.place.tireurId)}</strong>
            {tireurs.get(colonne.place.tireurId ?? '')?.prenom}
            <span class="grand" class:fort={vainqueur !== null && vainqueur === colonne.place.tireurId}
              >{colonne.cote === 'gauche' ? (touchesHaut ?? '–') : (touchesBas ?? '–')}</span
            >
          </p>
          <div class="boutons" style:--colonnes={Math.ceil(boutons.length / 2)}>
            {#each boutons as valeur (valeur)}
              <button
                type="button"
                class="bouton-score"
                aria-pressed={colonne.choix === valeur}
                aria-label={textes.poules.boutonPour(String(valeur), nom(colonne.place.tireurId))}
                disabled={!saisissable || envoi}
                onclick={() => (colonne.cote === 'gauche' ? (choixHaut = valeur) : (choixBas = valeur))}
                >{valeur}</button
              >
            {/each}
          </div>
        </div>
      {/each}
      {#if saisissable && egalite}
        <fieldset class="priorite">
          <legend>{t.priorite}</legend>
          <label><input type="radio" name="priorite" value="haut" bind:group={priorite} />{nom(haut.tireurId)}</label>
          <label><input type="radio" name="priorite" value="bas" bind:group={priorite} />{nom(bas.tireurId)}</label>
        </fieldset>
      {:else if match.parPriorite && !saisissable}
        <span class="discret">{t.prioriteMention} : {nomCourt(match.vainqueur)}</span>
      {/if}
      {#if !brut.ok}<p class="erreur" role="alert">{textes.poules.unSeulVainqueur}</p>{/if}
      {#if auTemps && vainqueur}<p class="info" role="status">{t.victoireAuTemps(nomCourt(vainqueur))}</p>{/if}
    </form>
    <div class="actions">
      {#if saisissable}
        <button type="submit" form="saisie-tableau" class="principal" disabled={envoi || !controle?.ok}
          >{t.valider}</button
        >
      {/if}
      {#if suivantRegle}
        <p class="discret">
          {t.corrigerDabord(t.titreMatch(suivantRegle.tour, suivantRegle.numero).toLowerCase())}
          <button type="button" class="lien" onclick={() => choisir(suivantRegle.id)}
            >{t.titreMatch(suivantRegle.tour, suivantRegle.numero)}</button
          >
        </p>
      {/if}
      {@render actions?.()}
    </div>
  {/if}
</section>

<style>
  .carte {
    /* US-117 : des touchers rapprochés (boutons de score, puis « Valider ») ne sont pas un double-toucher de zoom. */
    touch-action: manipulation;
    display: grid;
    grid-template-columns: minmax(200px, 240px) minmax(0, 1fr);
    align-items: start;
    gap: 12px 24px;
    padding: 16px;
    border: 2px solid var(--accent);
    border-radius: 14px;
    background: var(--surface);
  }

  .identite {
    grid-row: span 2;
    display: flex;
    flex-direction: column;
  }

  h3 {
    margin: 0;
    font-size: 1rem;
  }

  .discret {
    margin: 0;
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .attente {
    margin: 0;
    align-self: center;
  }

  .score {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 20px;
    margin: 0;
  }

  .colonne {
    display: grid;
    gap: 6px;
    align-content: start;
  }

  .gauche {
    --cote: var(--cote-gauche);
  }

  .droite {
    --cote: var(--cote-droit);
  }

  .tireur {
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin: 0;
    font-size: 0.95rem;
  }

  .tireur strong {
    color: var(--cote);
  }

  .rang {
    color: var(--texte-discret);
  }

  .grand {
    margin-left: auto;
    font-family: var(--police-titre, inherit);
    font-size: 1.75rem;
    font-weight: 700;
    line-height: 1;
    color: var(--texte-discret);
  }

  .grand.fort {
    color: var(--cote);
  }

  .boutons {
    display: grid;
    grid-template-columns: repeat(var(--colonnes), minmax(0, 1fr));
    gap: 4px;
  }

  .bouton-score {
    min-height: 36px;
    padding: 0;
    border: 2px solid var(--cote);
    border-radius: 999px;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
  }

  .bouton-score[aria-pressed='true'] {
    background: var(--cote);
    color: var(--sur-cote);
  }

  .bouton-score:disabled:not([aria-pressed='true']) {
    opacity: 0.4;
    cursor: default;
  }

  .priorite,
  .info,
  .erreur {
    grid-column: 1 / -1;
  }

  .priorite {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 0;
    padding: 4px 12px 8px;
    border: 1px solid var(--etat-attente-bordure);
    border-radius: 10px;
  }

  .priorite label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
  }

  .info,
  .erreur {
    flex-basis: 100%;
    margin: 0;
    text-align: center;
    font-size: 0.9rem;
  }

  .erreur {
    color: var(--etat-erreur);
  }

  /* L'action principale en bas à droite, sous les boutons de score ; le lien de retrait à côté. */
  .actions {
    grid-column: 2;
    display: flex;
    flex-wrap: wrap;
    flex-direction: row-reverse;
    align-items: center;
    gap: 8px 16px;
  }

  /* Sur un écran étroit, une seule colonne. */
  @media (max-width: 40rem) {
    .carte {
      grid-template-columns: minmax(0, 1fr);
    }

    .identite {
      grid-row: auto;
    }

    .actions {
      grid-column: 1;
    }
  }

  .principal {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 18px;
    border: none;
    border-radius: 10px;
    background: var(--palette-tiffany);
    color: var(--sur-tiffany);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .principal:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .lien {
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }
</style>
