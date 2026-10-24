/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Adresse WebSocket du serveur (wss://…workers.dev), fournie au build (ADR-0008). */
  readonly VITE_URL_SERVEUR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
