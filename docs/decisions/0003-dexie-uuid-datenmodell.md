# 0003 – IndexedDB via Dexie, UUIDs statt Auto-Increment-IDs

## Kontext

Der MVP hat kein Backend, aber ein späterer Sync zu einem selbst gehosteten Backend (Raspberry Pi über Tailscale) ist explizit vorgesehen (s. [architecture.md](../architecture.md#sync--infrastruktur-geplant-noch-nicht-gebaut)). Das Datenmodell soll so gestaltet sein, dass dieser Sync später ohne Umbau ergänzt werden kann.

## Entscheidung

- **IndexedDB über Dexie.js** als alleinige Datenquelle. Dexie vereinfacht die native IndexedDB-API deutlich (Promises statt Callbacks, einfachere Query-Syntax) — reine Ergonomie-Entscheidung, kein funktionaler Unterschied zu roher IndexedDB.
- **UUIDs statt Auto-Increment-IDs** für alle Entitäten (`crypto.randomUUID()`), obwohl aktuell kein Sync-Ziel existiert.
- **`updatedAt`-Timestamp auf jeder Entität**, aktualisiert bei jeder Änderung.
- **Kein `synced`-Flag** — ergibt ohne existierendes Backend keinen Sinn, kommt erst mit dem Sync selbst dazu.

## Konsequenzen

- IDs bleiben stabil und eindeutig, unabhängig davon, wohin die Daten später syncen — verhindert eine ID-Migration im Nachhinein
- `updatedAt` ist bereits die Grundlage für eine spätere Konfliktauflösung beim Sync (z. B. Last-Write-Wins), ohne dass das jetzt schon implementiert werden muss
- Dexie-intern wird die deklarierte Schema-Version mit Faktor 10 in die rohe IndexedDB-Versionsnummer übersetzt (Schema-Version 1 → IndexedDB-Version 10) — kein Fehler, sondern Dexies Standardverhalten, um Raum für eigene Migrationen zu lassen
