<script lang="ts">
  // Formulaire de modification d'une manifestation (US-023, US-056 CA-7), sur sa page. La création passe par l'assistant
  // (US-047). Données du club stockées par le serveur : hors ligne, l'enregistrement est grisé. Une modification
  // concurrente propose « Recharger » ; des épreuves hors des nouvelles dates sont refusées avec leur liste.
  import type { ErreursManifestation } from '@poule-position/domaine';
  import type { Manifestation } from '@poule-position/protocole';
  import ChampLieu from './ChampLieu.svelte';
  import { saisieDe, type ClientManifestations, type SaisieManifestation } from '../lib/manifestations';
  import { textes } from '../lib/textes';

  interface Proprietes {
    manifestation: Manifestation;
    client: ClientManifestations;
    horsLigne: boolean;
    enregistre: () => Promise<void>;
    annule: () => void;
    /** « Recharger » après une modification concurrente : la page relit la manifestation, le formulaire repart d'elle. */
    recharger: () => Promise<void>;
  }

  let { manifestation, client, horsLigne, enregistre, annule, recharger }: Proprietes = $props();

  const t = textes.manifestations;

  // svelte-ignore state_referenced_locally
  let saisie: SaisieManifestation = $state(saisieDe(manifestation));
  let erreurs: ErreursManifestation = $state({});
  let message: string | null = $state(null);
  let concurrente = $state(false);
  let enCours = $state(false);

  async function soumettre(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (enCours) return;
    enCours = true;
    message = null;
    concurrente = false;
    try {
      const resultat = await client.modifier(manifestation, $state.snapshot(saisie));
      if (resultat.ok) {
        await enregistre();
      } else if ('erreurs' in resultat) {
        erreurs = resultat.erreurs;
      } else {
        erreurs = {};
        if (resultat.erreur === 'EPREUVES_HORS_DATES') {
          message = t.horsDates(resultat.epreuves.map(({ nom }) => nom));
        } else if (resultat.erreur === 'MODIFIEE_ENTRE_TEMPS') {
          message = t.modifieeEntreTemps(resultat.manifestation.modifieePar);
          concurrente = true;
        } else {
          message = t.erreurs[resultat.erreur];
        }
      }
    } finally {
      enCours = false;
    }
  }

  const invalide = (champ: keyof ErreursManifestation) => ({
    'aria-invalid': erreurs[champ] ? ('true' as const) : undefined,
    'aria-describedby': erreurs[champ] ? `erreur-${champ}` : undefined,
  });
</script>

{#snippet erreurChamp(champ: keyof ErreursManifestation)}
  {@const code = erreurs[champ]}
  {#if code}<span class="erreur" id="erreur-{champ}">{t.champs[code]}</span>{/if}
{/snippet}

<form onsubmit={soumettre} novalidate>
  <h2>{t.titreModification(manifestation.nom)}</h2>
  <div class="champ">
    <label for="nom">{t.nom}</label>
    <input
      id="nom"
      type="text"
      placeholder={t.exempleNom}
      bind:value={saisie.nom}
      disabled={enCours}
      {...invalide('nom')}
    />
    {@render erreurChamp('nom')}
  </div>
  <div class="ligne">
    <div class="champ">
      <label for="debut">{t.debut}</label>
      <input id="debut" type="date" bind:value={saisie.debut} disabled={enCours} {...invalide('debut')} />
      {@render erreurChamp('debut')}
    </div>
    <div class="champ">
      <label for="fin">{t.fin}</label>
      <input id="fin" type="date" bind:value={saisie.fin} disabled={enCours} {...invalide('fin')} />
      {@render erreurChamp('fin')}
    </div>
  </div>
  <div class="champ">
    <label for="lieu">{t.lieu} <small>({t.facultatif})</small></label>
    <ChampLieu
      bind:lieu={saisie.lieu}
      bind:coordonnees={saisie.coordonnees}
      disabled={enCours}
      invalide={Boolean(erreurs.lieu)}
      decritPar={erreurs.lieu ? 'erreur-lieu' : undefined}
    />
    {@render erreurChamp('lieu')}
  </div>
  <div class="champ">
    <label for="commentaire">{t.commentaire} <small>({t.facultatif})</small></label>
    <textarea id="commentaire" rows="3" bind:value={saisie.commentaire} disabled={enCours} {...invalide('commentaire')}
    ></textarea>
    {@render erreurChamp('commentaire')}
  </div>

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
    <button type="submit" disabled={enCours || horsLigne}>{enCours ? t.enCours : t.enregistrer}</button>
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

  .ligne {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.8rem;
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
