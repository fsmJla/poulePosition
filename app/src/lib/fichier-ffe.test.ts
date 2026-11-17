import { describe, expect, it } from 'vitest';
import { lireFichierFfe, TAILLE_MAX_FICHIER_FFE } from './fichier-ffe';

/** Encode un texte en ISO-8859-1 (un octet par caractère), comme les fichiers d'Engarde. */
const latin1 = (texte: string) => Uint8Array.from([...texte].map((caractere) => caractere.charCodeAt(0)));
const utf8 = (texte: string) => new TextEncoder().encode(texte);

const EXEMPLE = `<?xml version="1.0" encoding="ISO-8859-1"?>
<!-- Fichier d'exemple anonymisé -->
<BaseCompetitionIndividuelle Version="3.3" Arme="S" Sexe="F" Categorie="M13" TitreCourt="M13 Dames">
  <Tireurs>
    <Tireur ID="1" Nom="DUBOIS" Prenom="Chloé" Sexe="F" Licence="123456" Club="PESSAC SPUC" Ligue="NOUVELLE AQUITAINE"
            Nation="FRA" Classement="12" DateNaissance="01.02.2014" />
    <Tireur ID="2" Nom="D'ARTAGNAN &amp; FILS" Prenom='Léa' Sexe="F" Club="TALENCE"></Tireur>
  </Tireurs>
  <Arbitres><Arbitre ID="9" Nom="ARBITRE" Prenom="Paul" /></Arbitres>
</BaseCompetitionIndividuelle>`;

describe('lecture du fichier d’inscription de la Fédération (US-083)', () => {
  it('CA-1 : lit un fichier ISO-8859-1, ses attributs de tireur (sans la date de naissance) et sa compétition', () => {
    const lu = lireFichierFfe(latin1(EXEMPLE));
    expect(lu).toEqual({
      ok: true,
      fichier: {
        tireurs: [
          { Nom: 'DUBOIS', Prenom: 'Chloé', Sexe: 'F', Licence: '123456', Club: 'PESSAC SPUC', Classement: '12' },
          { Nom: "D'ARTAGNAN & FILS", Prenom: 'Léa', Sexe: 'F', Club: 'TALENCE' },
        ],
        competition: { Version: '3.3', Arme: 'S', Sexe: 'F', Categorie: 'M13', TitreCourt: 'M13 Dames' },
      },
    });
  });

  it('CA-1 : lit aussi un fichier UTF-8', () => {
    const lu = lireFichierFfe(utf8(EXEMPLE.replace('ISO-8859-1', 'UTF-8')));
    expect(lu.ok && lu.fichier.tireurs[0]?.Prenom).toBe('Chloé');
  });

  it('CA-5 : refuse un fichier par équipes, d’un autre format, sans tireur ou trop gros', () => {
    expect(lireFichierFfe(utf8('<BaseCompetitionParEquipes><Equipes/></BaseCompetitionParEquipes>'))).toEqual({
      ok: false,
      erreur: 'PAS_INDIVIDUEL',
    });
    expect(lireFichierFfe(utf8('NOM;PRENOM\nDUBOIS;Chloé'))).toEqual({ ok: false, erreur: 'PAS_INDIVIDUEL' });
    expect(lireFichierFfe(utf8('<BaseCompetitionIndividuelle><Tireurs/></BaseCompetitionIndividuelle>'))).toEqual({
      ok: false,
      erreur: 'AUCUN_TIREUR',
    });
    expect(lireFichierFfe(new Uint8Array(TAILLE_MAX_FICHIER_FFE + 1))).toEqual({ ok: false, erreur: 'TROP_GROS' });
  });
});
