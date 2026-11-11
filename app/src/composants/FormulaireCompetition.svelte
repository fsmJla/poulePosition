<script lang="ts">
  // Formulaire d'une compétition (US-024, US-056 CA-7) : création ou modification, sur la page de sa manifestation.
  // Les données du club sont stockées par le serveur : hors ligne, l'enregistrement est grisé. L'enregistrement
  // prévient la page (`enregistre`), qui relit ses listes et ramène à l'onglet « Compétitions ».
  import FichiersJoints from './FichiersJoints.svelte';
  import { ARMES, type ErreursCompetition } from '@poule-position/domaine';
  import type { Competition, Manifestation } from '@poule-position/protocole';
  import { saisieDe, saisieVide, type ClientCompetitions, type SaisieCompetition } from '../lib/competitions';
  import type { ClientFichiers } from '../lib/fichiers';
  import { textes } from '../lib/textes';

  interface Proprietes {
    manifestation: Manifestation;
    /** Compétition à modifier ; null pour une nouvelle compétition. */
    competition: Competition | null;
    client: ClientCompetitions;
    /** US-030 : affiche et feuille de route de la compétition, reprises de la manifestation à défaut. */
    fichiers: ClientFichiers;
    horsLigne: boolean;
    enregistre: () => Promise<void>;
    annule: () => void;
    /** « Recharger » après une modification concurrente : la page relit la compétition, le formulaire repart d'elle. */
    recharger: () => Promise<void>;
  }

  let { manifestation, competition, client, fichiers, horsLigne, enregistre, annule, recharger }: Proprietes = $props();

  const t = textes.competitions;
  const armes = textes.epreuves.armes;
  const idChamp = (champ: string) => `competition-${champ}-${manifestation.id}`;

  // svelte-ignore state_referenced_locally
  let saisie: SaisieCompetition = $state(competition ? saisieDe(competition) : saisieVide());
  let erreurs: ErreursCompetition = $state({});
  /** Message global (modification concurrente, réseau, manifestation disparue…). */
  let message: string | null = $state(null);
  /** Vrai si le message annonce une modification concurrente : « Recharger » l'accompagne. */
  let concurrente = $state(false);
  let enCours = $state(false);

  async function soumettre(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (enCours) return;
    enCours = true;
    message = null;
    concurrente = false;
    try {
      const donnees = $state.snapshot(saisie);
      const resultat = competition
        ? await client.modifier(competition, donnees)
        : await client.creer(manifestation.id, donnees);
      if (resultat.ok) {
        await enregistre();
      } else if ('erreurs' in resultat) {
        erreurs = resultat.erreurs;
      } else {
        erreurs = {};
        if (resultat.erreur === 'MODIFIEE_ENTRE_TEMPS') {
          message = t.modifieeEntreTemps(resultat.competition.modifieePar);
          concurrente = true;
        } else {
          message = t.erreurs[resultat.erreur];
        }
      }
    } finally {
      enCours = false;
    }
  }

  const invalide = (champ: keyof ErreursCompetition) => ({
    'aria-invalid': erreurs[champ] ? ('true' as const) : undefined,
    'aria-describedby': erreurs[champ] ? idChamp(`erreur-${champ}`) : undefined,
  });
</script>

{#snippet erreurChamp(champ: keyof ErreursCompetition)}
  {@const code = erreurs[champ]}
  {#if code}<span class="erreur" id={idChamp(`erreur-${champ}`)}>{t.champs[code]}</span>{/if}
{/snippet}

<form onsubmit={soumettre} novalidate>
  <h2>{competition ? t.titreModification(competition.nom) : t.nouvelle}</h2>
  <div class="champ">
    <label for={idChamp('nom')}>{t.nom}</label>
    <input
      id={idChamp('nom')}
      type="text"
      placeholder={t.exempleNom}
      bind:value={saisie.nom}
      disabled={enCours}
      {...invalide('nom')}
    />
    {@render erreurChamp('nom')}
  </div>
  <div class="champ">
    <label for={idChamp('arme')}>{t.arme} <small>({t.facultatif})</small></label>
    <select id={idChamp('arme')} bind:value={saisie.arme} disabled={enCours} {...invalide('arme')}>
      <option value="">{t.aucuneArme}</option>
      {#each ARMES as arme (arme)}<option value={arme}>{armes[arme]}</option>{/each}
    </select>
    {@render erreurChamp('arme')}
  </div>
  <div class="champ">
    <label for={idChamp('commentaire')}>{t.commentaire} <small>({t.facultatif})</small></label>
    <textarea
      id={idChamp('commentaire')}
      rows="2"
      bind:value={saisie.commentaire}
      disabled={enCours}
      {...invalide('commentaire')}></textarea>
    {@render erreurChamp('commentaire')}
  </div>

  {#if competition}
    <FichiersJoints
      client={fichiers}
      chaine={[
        { proprietaire: 'competition', id: competition.id },
        { proprietaire: 'manifestation', id: manifestation.id },
      ]}
    />
  {/if}

  {#if message}
    <p class="message" role="alert">
      {message}
      {#if concurrente}
        <button type="button" class="lien" onclick={recharger}>{t.recharger}</button>
      {/if}
    </p>
  {/if}
  {#if horsLigne}<p class="avertissement" role="status">{t.horsLigne}</p>{/if}
  <div class="boutons">
    <button type="submit" disabled={enCours || horsLigne}>
      {enCours ? t.enCours : competition ? t.enregistrer : t.creer}
    </button>
    <button type="button" class="secondaire" onclick={annule} disabled={enCours}>{t.annuler}</button>
  </div>
</form>

<style>
  form {
    display: grid;
    gap: 0.8rem;
    padding: 1rem;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--surface);
  }

  h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  .champ {
    display: grid;
    align-content: start;
    gap: 0.3rem;
  }

  label {
    font-weight: 600;
  }

  small {
    color: var(--texte-discret);
    font-weight: 400;
  }

  input,
  select,
  textarea {
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte);
    font: inherit;
  }

  textarea {
    resize: vertical;
  }

  [aria-invalid='true'] {
    border-color: var(--etat-erreur);
  }

  .erreur {
    color: var(--etat-erreur);
    font-size: 0.85rem;
  }

  button {
    display: grid;
    padding: 0.55rem 0.9rem;
    border: none;
    border-radius: var(--rayon);
    background: var(--accent-fond);
    color: var(--sur-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button.secondaire {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
  }

  button.lien {
    display: inline;
    padding: 0;
    background: none;
    color: var(--accent);
    text-decoration: underline;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  .avertissement,
  .message {
    margin: 0;
    padding: 0.5rem 0.7rem;
    background: var(--surface-2);
  }

  .avertissement {
    border-left: 4px solid var(--etat-attente);
  }

  .message {
    border-left: 4px solid var(--etat-erreur);
  }
</style>
