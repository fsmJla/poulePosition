// Durable Object « Limiteur » (repris du relais) : un objet par usage et par adresse IP. Compte les essais erronés et
// bloque les essais au hasard : secrets d'installation (idFromName(ip), US-002) et connexions
// (idFromName(`connexion:${ip}`), US-004 CA-2). La règle de comptage est celle du domaine (essais.ts).
import { DurableObject } from 'cloudflare:workers';
import { essaisVides, noterEchec, saisieBloquee, type Essais, type RegleEssais } from '@poule-position/domaine';
import type { Env } from './index';

export class Limiteur extends DurableObject<Env> {
  /** Vrai si les essais de cette adresse sont refusés. */
  async estBloque(): Promise<boolean> {
    return saisieBloquee(await this.lire(), Date.now());
  }

  /** Enregistre un essai erroné selon `regle` ; vrai si l'adresse est désormais bloquée. */
  async enregistrerEchec(regle: RegleEssais): Promise<boolean> {
    const maintenant = Date.now();
    const essais = noterEchec(await this.lire(), maintenant, regle);
    await this.ctx.storage.put('compteur', essais);
    // Efface le compteur quand il ne peut plus servir.
    await this.ctx.storage.setAlarm(maintenant + regle.fenetre + regle.duree);
    return saisieBloquee(essais, maintenant);
  }

  override async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }

  private async lire(): Promise<Essais> {
    return (await this.ctx.storage.get<Essais>('compteur')) ?? essaisVides();
  }
}
