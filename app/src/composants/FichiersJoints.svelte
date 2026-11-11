<script lang="ts">
  // Affiche et feuille de route d'un élément (US-030) : manifestation, compétition ou épreuve. L'élément géré est le
  // premier de `chaine` ; les suivants sont ses parents, dont il reprend les fichiers à défaut des siens (CA-4).
  // Joindre, remplacer et retirer demandent le réseau (boutons grisés) ; l'affichage se fait aussi hors ligne depuis la
  // copie gardée sur l'appareil (CA-6).
  import { onDestroy, onMount } from 'svelte';
  import type { ProprietaireFichier, SorteFichier } from '@poule-position/domaine';
  import type { FichierJoint } from '@poule-position/protocole';
  import { fichiersEffectifs, type ClientFichiers, type ErreurFichiers } from '../lib/fichiers';
  import { textes } from '../lib/textes';

  interface Proprietes {
    client: ClientFichiers;
    /** L'élément géré, puis ses parents (épreuve, compétition, manifestation) : un identifiant absent est ignoré. */
    chaine: { proprietaire: ProprietaireFichier; id: string | null | undefined }[];
    /** Faux pour une lecture seule : pas de boutons. */
    modifiable?: boolean;
    /** Vrai pour garder le contenu sur l'appareil, afin qu'il reste affichable et imprimable hors ligne (CA-6). */
    garder?: boolean;
  }

  let { client, chaine, modifiable = true, garder = false }: Proprietes = $props();

  const t = textes.fichiers;
  const SORTES: SorteFichier[] = ['affiche', 'feuilleDeRoute'];
  const ACCEPTE: Record<SorteFichier, string> = {
    affiche: 'image/png,image/jpeg,image/webp',
    feuilleDeRoute: 'application/pdf',
  };

  let liste: FichierJoint[] | null = $state(null);
  let copieLe: number | null = $state(null);
  let enLigne = $state(navigator.onLine);
  /** Sorte en cours d'envoi ou de retrait. */
  let occupee: SorteFichier | null = $state(null);
  let message: Partial<Record<SorteFichier, string>> = $state({});
  /** Adresse affichable de chaque fichier : le contenu gardé sur l'appareil, à défaut l'adresse du serveur. */
  let adresses: Record<string, string> = $state({});
  const urlsLocales: string[] = [];

  const proprietaire = $derived(chaine[0]!.proprietaire);
  const id = $derived(chaine[0]!.id ?? '');
  const effectifs = $derived(fichiersEffectifs<FichierJoint>(liste ?? [], chaine));

  async function preparerAdresses(fichiers: FichierJoint[]) {
    const prochaines: Record<string, string> = {};
    for (const { nom } of fichiers) {
      const local = await client.contenuLocal(nom);
      if (local) {
        const url = URL.createObjectURL(local);
        urlsLocales.push(url);
        prochaines[nom] = url;
      } else {
        const distante = client.adresse(nom);
        if (distante && enLigne) prochaines[nom] = distante;
      }
    }
    adresses = prochaines;
  }

  async function charger() {
    const reponse = await client.lister();
    if (reponse.ok) {
      liste = reponse.fichiers;
      copieLe = null;
    } else {
      liste = reponse.copie?.fichiers ?? [];
      copieLe = reponse.copie?.copieLe ?? null;
    }
    const montres = Object.values(fichiersEffectifs(liste, chaine)).filter((f): f is FichierJoint => f !== null);
    // CA-6 : les fichiers à montrer sont gardés sur l'appareil avant de préparer leur affichage.
    if (garder && reponse.ok) await client.garderHorsLigne(montres);
    await preparerAdresses(montres);
  }

  onMount(() => {
    void charger();
    const surReseau = () => {
      enLigne = navigator.onLine;
      if (enLigne) void charger();
    };
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    return () => {
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
    };
  });

  onDestroy(() => urlsLocales.forEach((url) => URL.revokeObjectURL(url)));

  function dire(sorte: SorteFichier, texte: string | undefined) {
    message = { ...message, [sorte]: texte };
  }

  function erreurDe(erreur: ErreurFichiers | 'REFUSE', raison?: keyof typeof t.raisons): string {
    return erreur === 'REFUSE' && raison
      ? t.raisons[raison]
      : t.erreurs[erreur === 'REFUSE' ? 'ERREUR_INATTENDUE' : erreur];
  }

  async function choisir(sorte: SorteFichier, evenement: Event) {
    const champ = evenement.currentTarget as HTMLInputElement;
    const choisi = champ.files?.[0];
    champ.value = '';
    if (!choisi || occupee) return;
    occupee = sorte;
    dire(sorte, undefined);
    const resultat = await client.joindre(proprietaire, id, sorte, choisi);
    occupee = null;
    if (resultat.ok) await charger();
    else dire(sorte, erreurDe(resultat.erreur, resultat.erreur === 'REFUSE' ? resultat.raison : undefined));
  }

  async function retirer(sorte: SorteFichier) {
    if (occupee) return;
    occupee = sorte;
    dire(sorte, undefined);
    const resultat = await client.retirer(proprietaire, id, sorte);
    occupee = null;
    if (resultat.ok || resultat.erreur === 'FICHIER_INCONNU') await charger();
    else dire(sorte, erreurDe(resultat.erreur));
  }

  const libelle = (sorte: SorteFichier) => (sorte === 'affiche' ? t.affiche : t.feuilleDeRoute);
  const sans = (sorte: SorteFichier) => (sorte === 'affiche' ? t.aucuneAffiche : t.aucuneFeuille);
  const joindre = (sorte: SorteFichier) => (sorte === 'affiche' ? t.joindreAffiche : t.joindreFeuille);
</script>

<section class="documents" aria-label={t.titre}>
  <h3>{t.titre}</h3>
  {#if liste === null}
    <p class="discret">{t.chargement}</p>
  {:else}
    {#if copieLe !== null}<p class="discret" role="status">{t.copieDu(copieLe)}</p>{/if}
    {#each SORTES as sorte (sorte)}
      {@const fichier = effectifs[sorte]}
      {@const propre = fichier?.proprietaire === proprietaire && fichier.proprietaireId === id}
      <div class="sorte" data-sorte={sorte}>
        <h4>{libelle(sorte)}</h4>
        {#if fichier}
          {@const adresse = adresses[fichier.nom]}
          {#if sorte === 'affiche'}
            {#if adresse}<img src={adresse} alt={t.affiche} />{/if}
          {:else if adresse}
            <a href={adresse} target="_blank" rel="noopener">{t.ouvrir}</a>
          {:else}
            <span class="discret">{t.feuilleDeRoute}</span>
          {/if}
          {#if !propre}<small class="discret"
              >{t.heritee[fichier.proprietaire as 'competition' | 'manifestation']}</small
            >{/if}
        {:else}
          <p class="discret">{sans(sorte)}</p>
        {/if}

        {#if modifiable}
          <div class="actions">
            <label class="bouton" class:inactif={!enLigne || occupee !== null}>
              {propre ? t.remplacer : joindre(sorte)}
              <input
                type="file"
                accept={ACCEPTE[sorte]}
                disabled={!enLigne || occupee !== null}
                onchange={(evenement) => choisir(sorte, evenement)}
                aria-label={propre ? `${t.remplacer} : ${libelle(sorte)}` : joindre(sorte)}
              />
            </label>
            {#if propre}
              <button
                type="button"
                class="secondaire"
                onclick={() => retirer(sorte)}
                disabled={!enLigne || occupee !== null}
                aria-label={`${t.retirer} : ${libelle(sorte)}`}>{t.retirer}</button
              >
            {/if}
          </div>
          <small class="discret">{t.aide[sorte]}</small>
          {#if !enLigne}<small class="discret" role="status">{t.horsLigne}</small>{/if}
        {/if}
        {#if occupee === sorte}<small role="status">{t.envoiEnCours}</small>{/if}
        {#if message[sorte]}<p class="message" role="alert">{message[sorte]}</p>{/if}
      </div>
    {/each}
  {/if}
</section>

<style>
  .documents {
    display: grid;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  h3,
  h4 {
    margin: 0;
  }

  h4 {
    font-size: 0.95rem;
  }

  .sorte {
    display: grid;
    gap: 0.4rem;
    justify-items: start;
  }

  img {
    max-width: min(100%, 220px);
    max-height: 160px;
    border-radius: 0.4rem;
    border: 1px solid var(--bordure);
    object-fit: contain;
    background: var(--surface);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  /* Le champ de fichier est caché : son libellé fait le bouton (reste atteignable au clavier). */
  .bouton {
    position: relative;
    display: inline-block;
    padding: 0.5rem 0.9rem;
    border-radius: 0.4rem;
    background: var(--accent-fond);
    color: var(--sur-accent);
    font-weight: 600;
    cursor: pointer;
  }

  .bouton.inactif {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .bouton input {
    position: absolute;
    inset: 0;
    width: 100%;
    opacity: 0;
    cursor: inherit;
  }

  .bouton:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .discret {
    color: var(--texte-discret);
    font-size: 0.85rem;
    margin: 0;
  }

  .message {
    margin: 0;
    color: var(--etat-erreur);
  }
</style>
