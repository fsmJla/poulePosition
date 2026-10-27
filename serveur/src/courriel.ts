// Envoi d'e-mails par le serveur (US-018, ADR-0015) : interface `Expediteur`, indépendante de la bibliothèque SMTP.
// Le transport réel (smtp.ts, worker-mailer) n'est connu que du Worker ; les tests en injectent un faux. Aucun détail
// SMTP ne sort d'ici : l'appelant ne reçoit qu'un code, et le journal ne garde ni le contenu ni le mot de passe.
import { courrielValide, NOM_EXPEDITEUR, type ConfigurationSmtp, type Courriel } from './logique';

export type ErreurEnvoi = 'ENVOI_NON_CONFIGURE' | 'MESSAGE_INVALIDE' | 'ENVOI_IMPOSSIBLE';
export type ResultatEnvoi = { ok: true } | { ok: false; erreur: ErreurEnvoi };

export interface Expediteur {
  envoyer(courriel: Courriel): Promise<ResultatEnvoi>;
}

/** Ce que le transport SMTP reçoit : expéditeur, destinataire et contenu. */
export interface EnvoiSmtp {
  de: { nom: string; adresse: string };
  a: string;
  sujet: string;
  texte: string;
  html: string;
}

/** Envoie un e-mail par SMTP ; lève une erreur en cas d'échec. */
export type TransportSmtp = (configuration: ConfigurationSmtp, envoi: EnvoiSmtp) => Promise<void>;

/**
 * Expéditeur du serveur. `configuration` vaut null quand les secrets SMTP manquent (CA-5). `journal` reçoit le motif
 * d'un échec (CA-4), pour les journaux du Worker.
 */
export function creerExpediteur(
  configuration: ConfigurationSmtp | null,
  transport: TransportSmtp,
  journal: (...message: string[]) => void = console.error,
): Expediteur {
  return {
    async envoyer(courriel) {
      if (!configuration) return { ok: false, erreur: 'ENVOI_NON_CONFIGURE' };
      if (!courrielValide(courriel)) return { ok: false, erreur: 'MESSAGE_INVALIDE' };
      const { destinataire, sujet, texte, html } = courriel;
      try {
        await transport(configuration, {
          de: { nom: NOM_EXPEDITEUR, adresse: configuration.utilisateur },
          a: destinataire,
          sujet,
          texte,
          html,
        });
        return { ok: true };
      } catch (erreur) {
        journal("Envoi d'e-mail impossible :", erreur instanceof Error ? erreur.message : String(erreur));
        return { ok: false, erreur: 'ENVOI_IMPOSSIBLE' };
      }
    },
  };
}
