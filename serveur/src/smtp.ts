// Transport SMTP réel (US-018, ADR-0015) : bibliothèque worker-mailer, sur les sockets TCP de Cloudflare. Port 465 :
// TLS dès la connexion ; autre port (587) : STARTTLS (solution de repli de l'ADR-0015). Les journaux de la
// bibliothèque sont coupés : elle tracerait la session SMTP.
import { LogLevel, WorkerMailer } from 'worker-mailer';
import type { TransportSmtp } from './courriel';

/** Délai maximal d'attente du serveur SMTP, en millisecondes. */
const DELAI_SMTP = 10_000;

export const transportSmtp: TransportSmtp = async (configuration, envoi) => {
  const tlsImplicite = configuration.port === 465;
  await WorkerMailer.send(
    {
      host: configuration.hote,
      port: configuration.port,
      secure: tlsImplicite,
      startTls: !tlsImplicite,
      credentials: { username: configuration.utilisateur, password: configuration.motDePasse },
      authType: ['login', 'plain'],
      logLevel: LogLevel.NONE,
      socketTimeoutMs: DELAI_SMTP,
      responseTimeoutMs: DELAI_SMTP,
    },
    {
      from: { name: envoi.de.nom, email: envoi.de.adresse },
      to: envoi.a,
      subject: envoi.sujet,
      text: envoi.texte,
      html: envoi.html,
    },
  );
};
