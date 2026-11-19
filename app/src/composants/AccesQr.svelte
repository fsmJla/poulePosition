<script lang="ts">
  // Accès par QR code (US-096, planche 21) : section de la page « Paramètres ». Deux QR codes (arbitres, tireurs), leur
  // lien, « Copier le lien », « Régénérer… » (pilote en ligne) et l'action principale « Imprimer les QR codes ».
  // Hors ligne, les QR gardés sur ce PC restent affichés et imprimables.
  import { onMount } from 'svelte';
  import { accesQrOuvert, lienQr, ROLES_QR, type Epreuve, type RoleQr } from '@poule-position/domaine';
  import type { AccesQrClient, ErreurAccesQr, JetonsQr } from '../lib/acces-qr';
  import type { Contexte } from '../lib/inscriptions';
  import { cheminImpressionAcces } from '../lib/routes';
  import { textes } from '../lib/textes';
  import CodeQr from './CodeQr.svelte';
  import Icone from './Icone.svelte';

  interface Proprietes {
    epreuve: Epreuve;
    acces: AccesQrClient;
    /** Ce PC est le pilote et détient l'écriture : il peut créer et régénérer les jetons. */
    pilote: boolean;
    contexte: Contexte;
    /** Après l'écriture de `JetonQrDefini` : l'envoyer au serveur. */
    apresEcriture: () => void;
    naviguer: (chemin: string) => void;
    origine?: string;
  }

  let { epreuve, acces, pilote, contexte, apresEcriture, naviguer, origine = location.origin }: Proprietes = $props();

  const t = textes.epreuves.accesQr;

  let jetons = $state<JetonsQr>({ arbitre: null, tireur: null });
  let charge = $state(false);
  let enLigne = $state(navigator.onLine);
  let aConfirmer = $state<RoleQr | null>(null);
  let enCours = $state(false);
  let erreur = $state<ErreurAccesQr | null>(null);
  let copie = $state<RoleQr | null>(null);

  const ouvert = $derived(accesQrOuvert(epreuve.statut));
  const aucun = $derived(!jetons.arbitre && !jetons.tireur);
  const tireursSansSaisie = $derived(!epreuve.parametres.tireurSaisitPoule && !epreuve.parametres.tireurSaisitTableau);

  async function charger() {
    const lus = await acces.lire(epreuve.id);
    jetons = lus;
    if (pilote && ouvert && navigator.onLine && (!lus.arbitre || !lus.tireur)) {
      jetons = await acces.assurer(epreuve.id, lus, contexte);
      apresEcriture();
    }
    charge = true;
  }

  onMount(() => {
    const surReseau = () => {
      enLigne = navigator.onLine;
      if (enLigne && (!jetons.arbitre || !jetons.tireur)) void charger();
    };
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    void charger();
    return () => {
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
    };
  });

  async function regenerer(role: RoleQr) {
    if (enCours) return;
    enCours = true;
    erreur = null;
    try {
      const resultat = await acces.regenerer(epreuve.id, role, contexte);
      if (resultat.ok) {
        jetons = { ...jetons, [role]: resultat.jeton };
        aConfirmer = null;
        apresEcriture();
      } else erreur = resultat.erreur;
    } finally {
      enCours = false;
    }
  }

  async function copier(role: RoleQr, lien: string) {
    try {
      await navigator.clipboard.writeText(lien);
      copie = role;
      setTimeout(() => (copie = copie === role ? null : copie), 2000);
    } catch {
      // Presse-papiers refusé : le lien reste lisible et sélectionnable sous le QR.
    }
  }
</script>

<section class="acces" aria-labelledby="titre-acces">
  <div class="tete">
    <div class="intro">
      <h3 id="titre-acces">{t.titre}</h3>
      <p>{t.explication}</p>
    </div>
    {#if ouvert && !aucun}
      <button type="button" class="principal" onclick={() => naviguer(cheminImpressionAcces(epreuve.id))}>
        <Icone nom="imprimante" />
        {t.imprimer}
      </button>
    {/if}
  </div>

  {#if !ouvert}
    <p class="note" role="status">{t.termine}</p>
  {:else if charge && aucun}
    <p class="note" role="status">{pilote ? t.sansJeton : t.sansJetonLecture}</p>
  {:else if charge}
    {#if tireursSansSaisie}<p class="note" role="note">{t.tireursSansSaisie}</p>{/if}
    {#if erreur}<p class="message" role="alert">{t.erreurs[erreur]}</p>{/if}
    <div class="cartes">
      {#each ROLES_QR as role (role)}
        {@const jeton = jetons[role]}
        {#if jeton}
          {@const lien = lienQr(origine, epreuve.id, jeton)}
          <article class="carte" aria-labelledby={`titre-qr-${role}`}>
            <div class="code">
              <CodeQr texte={lien} nom={t.qrDe(t.roles[role], epreuve.nom)} />
            </div>
            <div class="details">
              <h4 id={`titre-qr-${role}`}>{t.roles[role]}</h4>
              <p class="droits">{t.droits[role]}</p>
              <code aria-label={t.lienDe(t.roles[role])}>{lien}</code>
              {#if aConfirmer === role}
                <div class="confirmation" role="group" aria-label={t.confirmation.titre(t.roles[role])}>
                  <p><strong>{t.confirmation.titre(t.roles[role])}</strong> {t.confirmation.texte}</p>
                  <div class="actions">
                    <button type="button" class="neutre" disabled={enCours} onclick={() => regenerer(role)}
                      >{t.confirmation.confirmer}</button
                    >
                    <button type="button" class="neutre" onclick={() => (aConfirmer = null)}
                      >{t.confirmation.annuler}</button
                    >
                  </div>
                </div>
              {:else}
                <div class="actions">
                  <button type="button" class="neutre" onclick={() => copier(role, lien)}>
                    {copie === role ? t.copie : t.copier}
                  </button>
                  {#if pilote}
                    <button
                      type="button"
                      class="neutre"
                      disabled={!enLigne}
                      title={enLigne ? undefined : t.horsLigne}
                      onclick={() => (aConfirmer = role)}>{t.regenerer}</button
                    >
                    {#if !enLigne}<span class="hors-ligne">{t.horsLigne}</span>{/if}
                  {/if}
                </div>
              {/if}
            </div>
          </article>
        {/if}
      {/each}
    </div>
  {/if}
</section>

<style>
  .acces {
    display: grid;
    gap: 1rem;
    width: 100%;
    box-sizing: border-box;
    padding: 1.25rem;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
  }

  .tete {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0.75rem 1rem;
  }

  .intro {
    flex: 1 1 22rem;
    display: grid;
    gap: 0.25rem;
  }

  h3 {
    margin: 0;
    font-size: 1.25rem;
  }

  h4 {
    margin: 0;
    font-family: var(--police-texte);
    font-size: 1.0625rem;
    font-weight: 600;
  }

  p {
    margin: 0;
  }

  .intro p,
  .droits,
  .note,
  .hors-ligne {
    color: var(--texte-discret);
    font-size: 0.9375rem;
  }

  .cartes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(21rem, 1fr));
    gap: 1rem;
  }

  .carte {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    border: 1px solid var(--bordure);
    border-radius: 12px;
    background: var(--fond);
  }

  .code {
    flex: 0 0 auto;
  }

  .details {
    flex: 1;
    min-width: 0;
    display: grid;
    align-content: start;
    gap: 0.5rem;
  }

  code {
    display: block;
    overflow: hidden;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--bordure);
    border-radius: 8px;
    background: var(--surface);
    color: var(--texte);
    font-size: 0.8125rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 0.9rem;
    border-radius: var(--rayon);
    font: inherit;
    font-size: 0.9375rem;
    cursor: pointer;
  }

  .principal {
    padding: 0 1.1rem 0 0.9rem;
    border: none;
    background: var(--accent-fond);
    color: var(--sur-accent);
    font-weight: 600;
  }

  .neutre {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .confirmation {
    display: grid;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    border-left: 4px solid var(--etat-attente);
    background: var(--surface);
  }

  .message {
    padding: 0.6rem 0.75rem;
    border-left: 4px solid var(--etat-erreur);
    background: var(--surface);
  }

  @media (max-width: 40rem) {
    .carte {
      flex-direction: column;
    }
  }
</style>
