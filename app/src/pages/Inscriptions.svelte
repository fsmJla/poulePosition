<script lang="ts">
  // Inscriptions d'une épreuve (US-082, planche 7) : saisie rapide en ligne (Entrée enchaîne, club repris), alerte
  // d'homonyme, liste triée par classement et filtrable, modification au crayon et retrait par « ⋯ ». Les écritures
  // passent par le journal local du PC pilote (US-081), donc aussi hors ligne, puis partent au serveur (US-022).
  // US-146 : une épreuve par équipes a deux onglets, « Tireurs » et « Équipes » (planche 40).
  import { onMount, tick } from 'svelte';
  import {
    cleTexte,
    analyserImport,
    equipeDuTireur,
    equipesDe,
    comparerTireur,
    inscriptionsOuvertes,
    tireursDe,
    trierTireurs,
    validerTireur,
    type AnalyseImport,
    type Epreuve,
    type Tireur,
  } from '@poule-position/domaine';
  import ConfirmationArchivage from '../composants/ConfirmationArchivage.svelte';
  import GestionEquipes from '../composants/GestionEquipes.svelte';
  import AttenteEnvoi from '../composants/AttenteEnvoi.svelte';
  import GabaritEpreuve from '../composants/GabaritEpreuve.svelte';
  import Icone from '../composants/Icone.svelte';
  import MenuActions from '../composants/MenuActions.svelte';
  import type { Accueil } from '../lib/accueil';
  import {
    importerTireurs,
    inscrireTireur,
    modifierTireur,
    retirerTireur,
    type ResultatInscription,
  } from '../lib/inscriptions';
  import ApercuImportFfe from '../composants/ApercuImportFfe.svelte';
  import { lireFichierFfe } from '../lib/fichier-ffe';
  import { prendreEcriture, type Journal } from '../lib/journal';
  import type { SessionAppareil } from '../lib/stockage';
  import type { Synchronisation } from '../lib/synchronisation';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: SessionAppareil;
    epreuveId: string;
    journal: Journal;
    synchronisation: Synchronisation;
    accueil: Accueil;
    naviguer: (chemin: string) => void;
  }

  let { session, epreuveId, journal, synchronisation, accueil, naviguer }: Proprietes = $props();

  const t = textes.inscriptions;
  const te = textes.epreuves;
  const contexte = $derived({ clubId: session.compte.clubId, auteur: session.compte.email });

  let epreuve = $state<Epreuve | null>(null);
  let chargee = $state(false);
  let pilote = $state(false);
  let ecriture = $state(true);
  let enAttente = $state(0);
  /** CA-3 : clubs des tireurs des épreuves connues de l'appareil, le dernier saisi en tête. */
  let clubsConnus: string[] = $state([]);

  const saisie = $state({ nom: '', prenom: '', club: '', classement: '' });
  let erreurs: Partial<Record<'nom' | 'prenom' | 'classement' | 'general', string>> = $state({});
  let homonyme: Tireur | null = $state(null);
  let annonce = $state('');
  let enCours = $state(false);
  let champNom: HTMLInputElement | undefined = $state();
  let filtre = $state('');
  /** CA-6 : la ligne en édition et ses valeurs. */
  let edition: { id: string; nom: string; prenom: string; club: string; classement: string } | null = $state(null);
  let retraitDemande: Tireur | null = $state(null);
  /** US-146 CA-1 : onglet ouvert d'une épreuve par équipes. */
  let onglet: 'tireurs' | 'equipes' = $state('tireurs');
  const tq = textes.equipes;
  const parEquipes = $derived(epreuve !== null && epreuve.typeEpreuve !== 'individuelle');
  const nombreEquipes = $derived(epreuve ? equipesDe(epreuve).length : 0);
  const nombreSansEquipe = $derived(
    epreuve ? tireursDe(epreuve).filter((x) => !equipeDuTireur(equipesDe(epreuve!), x.id)).length : 0,
  );

  const tireurs = $derived(epreuve ? trierTireurs(tireursDe(epreuve)) : []);
  const visibles = $derived(
    filtre.trim()
      ? tireurs.filter((tireur) => cleTexte(`${tireur.nom} ${tireur.prenom} ${tireur.club}`).includes(cleTexte(filtre)))
      : tireurs,
  );
  const nombreClubs = $derived(new Set(tireurs.map(({ club }) => cleTexte(club)).filter(Boolean)).size);
  /** CA-8 : pourquoi l'écran est en lecture seule, ou null s'il est modifiable. */
  const motifLectureSeule = $derived(
    !epreuve
      ? null
      : !pilote || !ecriture
        ? t.lectureSeule
        : epreuve.statut === 'archivee'
          ? t.archivee
          : !inscriptionsOuvertes(epreuve.statut)
            ? t.closes
            : null,
  );
  const modifiable = $derived(epreuve !== null && motifLectureSeule === null);

  async function lireClubs() {
    const clubs: Record<string, string> = {};
    for (const { epreuveId: id } of await journal.epreuvesLocales()) {
      const { epreuve: lue } = await journal.lire(id);
      for (const { club } of lue ? tireursDe(lue) : []) if (club) clubs[cleTexte(club)] = club;
    }
    clubsConnus = Object.values(clubs).sort((a, b) => a.localeCompare(b));
  }

  async function recharger() {
    epreuve = (await journal.lire(epreuveId)).epreuve;
    enAttente = pilote ? await synchronisation.enAttente(epreuveId) : 0;
  }

  onMount(() => {
    let liberer: (() => void) | null = null;
    let demonte = false;
    const surEnLigne = () => void synchronisation.envoyer(epreuveId).then(() => recharger());
    const arreterPerte = synchronisation.surPerte(({ epreuveId: id }) => {
      if (id !== epreuveId) return;
      pilote = false;
      liberer?.();
      void recharger();
    });
    void (async () => {
      await synchronisation.telechargerCopie(epreuveId);
      pilote = (await journal.etat(epreuveId))?.pilote ?? false;
      if (pilote) {
        liberer = await prendreEcriture(epreuveId);
        if (demonte) liberer?.();
        ecriture = liberer !== null;
        window.addEventListener('online', surEnLigne);
      }
      await recharger();
      await lireClubs();
      chargee = true;
      if (pilote) void synchronisation.envoyer(epreuveId).then(() => recharger());
    })();
    return () => {
      demonte = true;
      liberer?.();
      arreterPerte();
      window.removeEventListener('online', surEnLigne);
    };
  });

  const classementSaisi = (texte: string) => (texte.trim() ? Number(texte.trim()) : undefined);
  const messageErreur = (code: string) => t.erreurs[code] ?? t.erreurs.AUTRE!;

  /** Après une écriture : relit, envoie, et rend le message d'erreur s'il y en a une. */
  async function apres(resultat: ResultatInscription): Promise<boolean> {
    await recharger();
    if (!resultat.ok) {
      erreurs = { general: messageErreur(resultat.erreur) };
      return false;
    }
    void synchronisation.envoyer(epreuveId).then(() => recharger());
    return true;
  }

  /** CA-2 et CA-4 : vérifie, signale un homonyme (sauf confirmé), refuse un même tireur, puis inscrit. */
  async function ajouter(evenement?: SubmitEvent, confirme = false) {
    evenement?.preventDefault();
    if (!modifiable || enCours || !epreuve) return;
    const classement = classementSaisi(saisie.classement);
    const erreur = validerTireur({
      nom: saisie.nom,
      prenom: saisie.prenom,
      club: saisie.club,
      classement: Number.isNaN(classement) ? 0.5 : classement,
    });
    if (erreur) {
      const champ =
        erreur === 'TIREUR_PRENOM_VIDE' ? 'prenom' : erreur === 'CLASSEMENT_INVALIDE' ? 'classement' : 'nom';
      erreurs = { [champ]: messageErreur(erreur) };
      return;
    }
    const comparaison = comparerTireur({ nom: saisie.nom, prenom: saisie.prenom }, tireursDe(epreuve));
    if (comparaison.nature === 'homonyme' && !confirme) {
      homonyme = comparaison.tireur;
      return;
    }
    enCours = true;
    erreurs = {};
    homonyme = null;
    try {
      const nom = `${saisie.nom.trim().toUpperCase()} ${saisie.prenom.trim()}`;
      const ok = await apres(
        await inscrireTireur(
          journal,
          epreuveId,
          {
            nom: saisie.nom,
            prenom: saisie.prenom,
            club: saisie.club,
            ...(classement !== undefined && { classement }),
          },
          contexte,
        ),
      );
      if (ok) {
        if (saisie.club.trim()) {
          clubsConnus = [saisie.club.trim(), ...clubsConnus.filter((club) => cleTexte(club) !== cleTexte(saisie.club))];
        }
        Object.assign(saisie, { nom: '', prenom: '', classement: '' });
        annonce = t.ajoute(nom);
      }
    } finally {
      enCours = false;
    }
    // CA-2 : le curseur revient sur « Nom », une fois les champs réactivés (ils sont désactivés pendant l'écriture).
    await tick();
    champNom?.focus();
  }

  function commencerEdition(tireur: Tireur) {
    edition = {
      id: tireur.id,
      nom: tireur.nom,
      prenom: tireur.prenom,
      club: tireur.club,
      classement: tireur.classement === null ? '' : String(tireur.classement),
    };
    erreurs = {};
  }

  /** CA-6 : n'écrit que les champs changés. */
  async function enregistrerEdition(evenement?: SubmitEvent) {
    evenement?.preventDefault();
    const encours = edition;
    const avant = tireurs.find(({ id }) => id === encours?.id);
    if (!encours || !avant || enCours) return;
    const classement = classementSaisi(encours.classement);
    const changes = {
      ...(encours.nom.trim() !== avant.nom && { nom: encours.nom }),
      ...(encours.prenom.trim() !== avant.prenom && { prenom: encours.prenom }),
      ...(encours.club.trim() !== avant.club && { club: encours.club }),
      ...((classement ?? null) !== avant.classement && { classement: classement ?? null }),
    };
    const erreur = validerTireur({
      ...changes,
      classement: Number.isNaN(classement) ? 0.5 : changes.classement,
    });
    if (erreur) {
      erreurs = { general: messageErreur(erreur) };
      return;
    }
    if (Object.keys(changes).length === 0) {
      edition = null;
      return;
    }
    enCours = true;
    try {
      if (await apres(await modifierTireur(journal, epreuveId, { tireurId: encours.id, ...changes }, contexte))) {
        edition = null;
      }
    } finally {
      enCours = false;
    }
  }

  /** CA-7 : retire après confirmation. */
  async function validerRetrait() {
    const tireur = retraitDemande;
    if (!tireur) return { ok: true as const };
    const resultat = await retirerTireur(journal, epreuveId, tireur.id, contexte);
    if (!(await apres(resultat))) return { ok: false as const, message: erreurs.general ?? t.erreurs.AUTRE! };
    annonce = t.retire(`${tireur.nom} ${tireur.prenom}`);
    return { ok: true as const };
  }

  /** CA-6 : Échap annule l'édition de la ligne. */
  const annulerSurEchap = (evenement: KeyboardEvent) => {
    if (evenement.key === 'Escape') edition = null;
  };

  // Le nom est affiché en capitales (hypothèse de l'US), y compris dans les noms accessibles.
  const nomComplet = (tireur: Pick<Tireur, 'nom' | 'prenom'>) => `${tireur.prenom} ${tireur.nom.toUpperCase()}`;

  // US-083 : import du fichier de la Fédération, lu sur l'appareil puis montré dans un aperçu.
  const ti = textes.importFfe;
  let champFichier: HTMLInputElement | undefined = $state();
  let apercu: { analyse: AnalyseImport; avertissement: string | null } | null = $state(null);

  /** CA-1, CA-2 et CA-5 : lit le fichier choisi et ouvre l'aperçu, ou dit pourquoi il est refusé. */
  async function choisirFichier(evenement: Event & { currentTarget: HTMLInputElement }) {
    const fichier = evenement.currentTarget.files?.[0];
    evenement.currentTarget.value = '';
    if (!fichier || !epreuve) return;
    erreurs = {};
    const lu = lireFichierFfe(new Uint8Array(await fichier.arrayBuffer()));
    if (!lu.ok) {
      erreurs = { general: ti.erreurs[lu.erreur] };
      return;
    }
    const analyse = analyserImport(lu.fichier.tireurs, { sexe: epreuve.sexe, tireurs: tireursDe(epreuve) });
    const { Arme: arme, Categorie: categorie } = lu.fichier.competition;
    const lettreArme: Record<string, string> = { sabre: 'S', epee: 'E', fleuret: 'F' };
    const autreArme = arme && lettreArme[epreuve.arme] && arme.toUpperCase() !== lettreArme[epreuve.arme];
    const autreCategorie = categorie && epreuve.categorie && cleTexte(categorie) !== cleTexte(epreuve.categorie);
    apercu = {
      analyse,
      avertissement:
        autreArme || autreCategorie ? ti.competitionDifferente([arme, categorie].filter(Boolean).join(' · ')) : null,
    };
  }

  /** CA-3 : importe, relit la liste et dit le résultat. */
  async function importer(homonymesCoches: ReadonlySet<number>) {
    const encours = apercu;
    if (!encours) return;
    const rendu = await importerTireurs(journal, epreuveId, encours.analyse, homonymesCoches, contexte);
    await recharger();
    void synchronisation.envoyer(epreuveId).then(() => recharger());
    annonce = ti.resultat(rendu.inscrits, rendu.misAJour, encours.analyse.ecartes.length, rendu.echecs);
    apercu = null;
  }
</script>

{#snippet etape()}
  <div class="titre-etape">
    <h2>{t.titre}</h2>
    {#if epreuve}<span class="pastille-nombre">{t.nombre(tireurs.length)}</span>{/if}
    <span class="espace"></span>
    <!-- US-083 : « Importer un fichier… » (bouton neutre) ouvre le choix d'un fichier XML de la Fédération. -->
    {#if modifiable}
      <button type="button" class="secondaire" onclick={() => champFichier?.click()}>
        <Icone nom="televerser" taille={20} />{t.importer}
      </button>
      <input
        bind:this={champFichier}
        class="invisible"
        type="file"
        accept=".xml,text/xml,application/xml"
        aria-label={ti.choisir}
        tabindex="-1"
        onchange={choisirFichier}
      />
    {/if}
  </div>

  {#if !chargee}
    <p role="status">{te.chargement}</p>
  {:else if !epreuve}
    <p class="message" role="alert">{te.introuvable}</p>
  {:else}
    {#if motifLectureSeule}<p class="avertissement" role="status">{motifLectureSeule}</p>{/if}
    <!-- US-090 : l'attente d'envoi ne décale plus l'écran. -->
    {#if pilote}<AttenteEnvoi nombre={enAttente} />{/if}
    <p class="invisible" role="status" aria-live="polite">{annonce}</p>

    {#if parEquipes}
      <!-- US-146 CA-1 : onglets « Tireurs » et « Équipes ». -->
      <div class="onglets" role="tablist" aria-label={tq.onglets}>
        <button type="button" role="tab" aria-selected={onglet === 'tireurs'} onclick={() => (onglet = 'tireurs')}
          >{tq.ongletTireurs} <span>{tireurs.length}</span></button
        >
        <button type="button" role="tab" aria-selected={onglet === 'equipes'} onclick={() => (onglet = 'equipes')}
          >{tq.ongletEquipes} <span>{tq.resume(nombreEquipes, nombreSansEquipe)}</span></button
        >
      </div>
    {/if}

    {#if parEquipes && onglet === 'equipes'}
      <GestionEquipes {epreuve} {journal} {contexte} {modifiable} {apres} />
    {:else}
      {#if modifiable}
        <!-- CA-2 : saisie rapide en ligne ; « Ajouter » est l'action principale ; Entrée ajoute. -->
        <section class="carte" aria-labelledby="titre-ajout">
          <h3 id="titre-ajout"><Icone nom="personnePlus" taille={20} />{t.ajout}</h3>
          <form class="ajout" onsubmit={(e) => ajouter(e)} novalidate>
            <div class="champ">
              <label for="saisie-nom">{t.nom}</label>
              <input
                id="saisie-nom"
                bind:this={champNom}
                bind:value={saisie.nom}
                class="majuscules"
                placeholder={t.exempleNom}
                autocomplete="off"
                aria-invalid={erreurs.nom ? 'true' : undefined}
                aria-describedby={erreurs.nom ? 'erreur-nom' : undefined}
                disabled={enCours}
              />
              {#if erreurs.nom}<span id="erreur-nom" class="erreur">{erreurs.nom}</span>{/if}
            </div>
            <div class="champ">
              <label for="saisie-prenom">{t.prenom}</label>
              <input
                id="saisie-prenom"
                bind:value={saisie.prenom}
                placeholder={t.exemplePrenom}
                autocomplete="off"
                aria-invalid={erreurs.prenom ? 'true' : undefined}
                aria-describedby={erreurs.prenom ? 'erreur-prenom' : undefined}
                disabled={enCours}
              />
              {#if erreurs.prenom}<span id="erreur-prenom" class="erreur">{erreurs.prenom}</span>{/if}
            </div>
            <div class="champ">
              <label for="saisie-club">{t.club}</label>
              <input
                id="saisie-club"
                bind:value={saisie.club}
                list="clubs-connus"
                autocomplete="off"
                disabled={enCours}
              />
              <datalist id="clubs-connus" aria-label={t.clubsProposes}>
                {#each clubsConnus as club (club)}<option value={club}></option>{/each}
              </datalist>
            </div>
            <div class="champ">
              <label for="saisie-classement">{t.classement} <small>{t.facultatif}</small></label>
              <input
                id="saisie-classement"
                bind:value={saisie.classement}
                inputmode="numeric"
                autocomplete="off"
                aria-invalid={erreurs.classement ? 'true' : undefined}
                aria-describedby={erreurs.classement ? 'erreur-classement' : undefined}
                disabled={enCours}
              />
              {#if erreurs.classement}<span id="erreur-classement" class="erreur">{erreurs.classement}</span>{/if}
            </div>
            <button type="submit" class="principal" disabled={enCours}>
              <Icone nom="plus" taille={20} />{t.ajouter}
            </button>
          </form>
          <p class="aide">{t.aideAjout}</p>
          {#if homonyme}
            <!-- CA-4 : un homonyme déjà inscrit : l'organisateur décide. -->
            <div class="alerte" role="alert">
              <Icone nom="alerte" taille={20} />
              <span>{t.homonyme(`${homonyme.nom.toUpperCase()} ${homonyme.prenom}`, homonyme.club)}</span>
              <button type="button" class="lien" onclick={() => ajouter(undefined, true)}>{t.ajouterQuandMeme}</button>
              <button type="button" class="lien" onclick={() => (homonyme = null)}>{t.annuler}</button>
            </div>
          {/if}
          {#if erreurs.general}<p class="message" role="alert">{erreurs.general}</p>{/if}
        </section>
      {/if}

      <!-- CA-5 : la liste des inscrits, triée par classement puis par nom, filtrable. -->
      <section class="carte liste" aria-labelledby="titre-liste">
        <div class="entete-liste">
          <h3 id="titre-liste">{t.liste}</h3>
          <label class="filtre">
            <Icone nom="loupe" taille={18} />
            <input type="search" bind:value={filtre} aria-label={t.filtrer} placeholder={t.exempleFiltre} />
          </label>
          <span class="discret">{t.clubs(nombreClubs)}</span>
        </div>
        {#if tireurs.length === 0}
          <p class="vide">{t.aucun}</p>
        {:else if visibles.length === 0}
          <p class="vide">{t.aucunFiltre}</p>
        {:else}
          <div class="defilement">
            <table>
              <thead>
                <tr>
                  <th scope="col" class="col-classement">{t.colonnes.classement}</th>
                  <th scope="col">{t.colonnes.nom}</th>
                  <th scope="col">{t.colonnes.prenom}</th>
                  <th scope="col">{t.colonnes.club}</th>
                  <th scope="col" class="col-actions"><span class="invisible">{t.colonnes.actions}</span></th>
                </tr>
              </thead>
              <tbody>
                {#each visibles as tireur (tireur.id)}
                  {#if edition?.id === tireur.id}
                    <!-- CA-6 : la ligne passe en édition ; Échap annule. -->
                    <tr class="en-edition">
                      <td colspan="5">
                        <form class="edition" onsubmit={(e) => enregistrerEdition(e)} novalidate>
                          <input
                            bind:value={edition.classement}
                            onkeydown={annulerSurEchap}
                            inputmode="numeric"
                            aria-label={t.classement}
                          />
                          <input
                            bind:value={edition.nom}
                            onkeydown={annulerSurEchap}
                            class="majuscules"
                            aria-label={t.nom}
                          />
                          <input bind:value={edition.prenom} onkeydown={annulerSurEchap} aria-label={t.prenom} />
                          <input
                            bind:value={edition.club}
                            onkeydown={annulerSurEchap}
                            list="clubs-connus"
                            aria-label={t.club}
                          />
                          <button type="submit" class="principal" disabled={enCours}>{t.enregistrer}</button>
                          <button type="button" class="secondaire" onclick={() => (edition = null)}>{t.annuler}</button>
                        </form>
                        {#if erreurs.general}<p class="message" role="alert">{erreurs.general}</p>{/if}
                      </td>
                    </tr>
                  {:else}
                    <tr>
                      <td class:discret={tireur.classement === null}>{tireur.classement ?? t.sansClassement}</td>
                      <td class="nom">{tireur.nom.toUpperCase()}</td>
                      <td>{tireur.prenom}</td>
                      <td class="discret">{tireur.club}</td>
                      <td>
                        {#if modifiable}<div class="actions">
                            <button
                              type="button"
                              class="icone"
                              aria-label={t.modifier(nomComplet(tireur))}
                              title={t.modifier(nomComplet(tireur))}
                              onclick={() => commencerEdition(tireur)}><Icone nom="crayon" taille={18} /></button
                            >
                            <MenuActions
                              id="menu-tireur-{tireur.id}"
                              nom={nomComplet(tireur)}
                              contour={false}
                              actions={[
                                {
                                  libelle: t.retirer,
                                  icone: 'corbeille',
                                  destructive: true,
                                  surChoix: () => (retraitDemande = tireur),
                                },
                              ]}
                              {naviguer}
                            />
                          </div>{/if}
                      </td>
                    </tr>
                  {/if}
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
        <p class="pied">{t.tri}</p>
      </section>
    {/if}
  {/if}
{/snippet}

{#if apercu}
  <ApercuImportFfe
    analyse={apercu.analyse}
    avertissement={apercu.avertissement}
    {importer}
    fermer={() => (apercu = null)}
  />
{/if}

{#if retraitDemande}
  <ConfirmationArchivage
    titre={t.confirmerRetrait(nomComplet(retraitDemande))}
    detail={t.detailRetrait}
    action={t.retirerAction}
    valider={validerRetrait}
    fermer={() => (retraitDemande = null)}
  />
{/if}

{#if epreuve}
  <GabaritEpreuve {accueil} {epreuve} courante="inscriptions" suite={t.titre} {naviguer}>
    {@render etape()}
  </GabaritEpreuve>
{:else}
  <main class="sans-epreuve">{@render etape()}</main>
{/if}

<style>
  .onglets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .onglets button {
    min-height: 40px;
    padding: 0 1rem;
    border: 1px solid var(--bordure);
    border-radius: 999px;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .onglets button span {
    font-weight: 400;
  }

  .onglets button[aria-selected='true'] {
    border-color: var(--texte);
    background: var(--texte);
    color: var(--fond);
  }

  .titre-etape {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }

  h2 {
    margin: 0;
    font-family: var(--police-titre, inherit);
    font-size: 1.6rem;
  }

  h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 1rem;
  }

  .espace {
    flex: 1;
  }

  .pastille-nombre {
    padding: 0.15rem 0.75rem;
    border-radius: 999px;
    background: var(--surface-2);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .carte {
    display: grid;
    gap: 0.85rem;
    padding: 1rem;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
  }

  .ajout {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 1.4fr) minmax(0, 0.8fr) auto;
    gap: 0.75rem;
    align-items: start;
  }

  .ajout .champ {
    display: grid;
    gap: 0.25rem;
  }

  .ajout label {
    font-size: 0.875rem;
    font-weight: 600;
  }

  .ajout .principal {
    align-self: end;
    margin-top: 1.35rem;
  }

  small,
  .discret,
  .aide,
  .pied,
  .vide {
    color: var(--texte-discret);
    font-weight: 400;
  }

  .aide,
  .pied,
  .vide {
    margin: 0;
    font-size: 0.875rem;
  }

  input {
    box-sizing: border-box;
    min-height: 2.75rem;
    padding: 0 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-weight: 400;
  }

  .majuscules {
    text-transform: uppercase;
  }

  [aria-invalid='true'] {
    border-color: var(--etat-erreur);
  }

  .erreur {
    color: var(--etat-erreur);
    font-size: 0.8rem;
    font-weight: 400;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.75rem;
    padding: 0 1rem;
    border-radius: var(--rayon);
    font: inherit;
    cursor: pointer;
  }

  .principal {
    border: none;
    background: var(--palette-tiffany);
    color: var(--sur-tiffany);
    font-weight: 600;
  }

  .secondaire {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .lien {
    border: none;
    background: transparent;
    color: var(--accent);
    font-weight: 600;
  }

  .icone {
    justify-content: center;
    width: 2.75rem;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--texte);
  }

  .alerte {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--etat-attente-bordure);
    border-radius: var(--rayon);
    background: var(--etat-attente-fond);
  }

  .alerte span {
    flex: 1;
  }

  .liste {
    gap: 0;
    padding: 0;
    overflow: hidden;
  }

  .entete-liste {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--bordure);
  }

  .entete-liste h3 {
    flex: 1 1 12rem;
  }

  .filtre {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: min(100%, 18rem);
    padding: 0 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    color: var(--texte-discret);
  }

  .filtre input {
    flex: 1;
    min-width: 0;
    border: none;
    padding: 0;
  }

  .defilement {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    padding: 0.6rem 0.5rem;
    background: var(--fond);
    color: var(--texte-discret);
    font-size: 0.875rem;
    font-weight: 600;
    text-align: left;
  }

  td {
    padding: 0 0.5rem;
    border-top: 1px solid var(--bordure);
  }

  th:first-child,
  td:first-child {
    padding-left: 1rem;
  }

  .col-classement {
    width: 7rem;
  }

  .col-actions {
    width: 6rem;
  }

  td.nom {
    font-weight: 600;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  .edition {
    display: grid;
    grid-template-columns: 5rem minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto auto;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }

  .vide,
  .pied {
    padding: 0.75rem 1rem;
  }

  .pied {
    border-top: 1px solid var(--bordure);
  }

  .message {
    margin: 0;
    color: var(--etat-erreur);
  }

  .avertissement {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-left: 4px solid var(--etat-attente);
    background: var(--surface);
  }

  .invisible {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  /* Principe 13 : sur un écran étroit, le formulaire passe sur une colonne. */
  @media (max-width: 40rem) {
    .ajout,
    .edition {
      grid-template-columns: minmax(0, 1fr);
    }

    .ajout .principal {
      margin-top: 0;
    }
  }
</style>
