# tests/e2e — Playwright

Tests de bout en bout, exécutés en local et en CI contre la preview Vercel (en-tête
`x-vercel-protection-bypass`, ADR-0008). Chaque test nomme le critère qu'il couvre (`US-012 CA-3 …`). Les
coupures réseau sont simulées avec `context.setOffline()`.
