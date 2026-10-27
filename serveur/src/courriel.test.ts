import { describe, expect, it, vi } from 'vitest';
import { creerExpediteur, type EnvoiSmtp, type TransportSmtp } from './courriel';
import type { ConfigurationSmtp, Courriel } from './logique';

const CONFIGURATION: ConfigurationSmtp = {
  hote: 'ssl0.ovh.net',
  port: 465,
  utilisateur: 'no-reply@pessac-escrime.fr',
  motDePasse: 'mot-de-passe-de-la-boite',
};
const COURRIEL: Courriel = {
  destinataire: 'julien@club.fr',
  sujet: 'Essai',
  texte: 'Bonjour é à',
  html: '<p>Bonjour é à</p>',
};

describe('expéditeur d’e-mails (US-018)', () => {
  it('US-018 CA-3 : transmet au transport le serveur, l’expéditeur, le destinataire et le contenu', async () => {
    const transport = vi.fn<TransportSmtp>(async () => {});
    expect(await creerExpediteur(CONFIGURATION, transport).envoyer(COURRIEL)).toEqual({ ok: true });
    expect(transport).toHaveBeenCalledWith(CONFIGURATION, {
      de: { nom: 'Poule Position', adresse: 'no-reply@pessac-escrime.fr' },
      a: 'julien@club.fr',
      sujet: 'Essai',
      texte: 'Bonjour é à',
      html: '<p>Bonjour é à</p>',
    } satisfies EnvoiSmtp);
  });

  it('US-018 CA-4 : un échec du transport donne une erreur maîtrisée, journalisée sans le contenu ni le mot de passe', async () => {
    const journal = vi.fn();
    const transport: TransportSmtp = async () => {
      throw new Error('535 5.7.8 Authentication failed');
    };
    expect(await creerExpediteur(CONFIGURATION, transport, journal).envoyer(COURRIEL)).toEqual({
      ok: false,
      erreur: 'ENVOI_IMPOSSIBLE',
    });
    expect(journal).toHaveBeenCalledTimes(1);
    const trace = String(journal.mock.calls[0]?.join(' '));
    expect(trace).toContain('535 5.7.8 Authentication failed');
    expect(trace).not.toContain('mot-de-passe-de-la-boite');
    expect(trace).not.toContain('Bonjour');
  });

  it('US-018 CA-4 : une erreur qui n’est pas une Error est aussi maîtrisée', async () => {
    const journal = vi.fn();
    const transport: TransportSmtp = () => Promise.reject('délai dépassé');
    expect(await creerExpediteur(CONFIGURATION, transport, journal).envoyer(COURRIEL)).toEqual({
      ok: false,
      erreur: 'ENVOI_IMPOSSIBLE',
    });
  });

  it('US-018 CA-4 : un e-mail invalide n’est pas envoyé', async () => {
    const transport = vi.fn<TransportSmtp>(async () => {});
    const resultat = await creerExpediteur(CONFIGURATION, transport).envoyer({
      ...COURRIEL,
      sujet: 'a\r\nBcc: x@y.fr',
    });
    expect(resultat).toEqual({ ok: false, erreur: 'MESSAGE_INVALIDE' });
    expect(transport).not.toHaveBeenCalled();
  });

  it('US-018 CA-5 : sans configuration, rien ne part et l’appelant le sait', async () => {
    const transport = vi.fn<TransportSmtp>(async () => {});
    expect(await creerExpediteur(null, transport).envoyer(COURRIEL)).toEqual({
      ok: false,
      erreur: 'ENVOI_NON_CONFIGURE',
    });
    expect(transport).not.toHaveBeenCalled();
  });
});
