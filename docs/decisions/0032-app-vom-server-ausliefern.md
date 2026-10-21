# 0032 – Zielarchitektur: App vom eigenen Server ausliefern

## Kontext

[ADR 0005](0005-github-pages-hosting.md) liefert die App über GitHub Pages aus. Für den geplanten Sync (Raspberry Pi, Tailscale) wäre die App dann eine fremde Origin gegenüber dem Server: Dafür braucht es CORS, und die Server-Adresse müsste irgendwo konfiguriert werden (nicht im öffentlichen Repo, s. ADR 0005).

## Entscheidung

Zielarchitektur: Der Server (Pi) liefert die App selbst aus, per HTTPS über Tailscale (`tailscale serve`, Zertifikat für die `*.ts.net`-Adresse). Vorteile: Same-Origin (kein CORS, kein Mixed Content) und keine Server-Adresse in der App - sie ist die eigene Origin, Endpunkte sind relative Pfade (`api/...`). Der Erstaufruf der App läuft immer über den Server (Tailscale muss dafür aktiv sein), danach startet sie dank Service Worker ohne Netz.

Ein Netzwerktest mit einem Mac als Stand-in-Server (Wegwerf-Stub außerhalb des Repos, liefert die App aus und beantwortet `api/ping`) hat auf dem iPhone bestätigt: App-Auslieferung über Tailscale-HTTPS funktioniert, ein nicht erreichbarer Server blockiert den App-Start nicht (die App stellt beim Start keine Anfrage an den Server). Der dafür testweise gebaute "Verbindung testen"-Knopf im Profil-Tab wurde danach wieder entfernt.

## Konsequenzen

- GitHub Pages bleibt vorerst aktiv ([ADR 0005](0005-github-pages-hosting.md) ist noch nicht abgelöst)
- Die App unter einer neuen Origin hat einen eigenen IndexedDB- und localStorage-Bestand. Ein späterer Umzug der echten Nutzung vom GitHub-Pages-Pfad auf den Pi verliert die lokalen Daten, wenn es keinen Export/Import oder Sync dafür gibt - vor dem Umzug klären
- Künftige Sync-Anfragen gehen als relative Pfade an `api/...`, müssen immer ein Timeout haben und dürfen den Start nie blockieren
- Der Service Worker fängt nur App-Shell-Dateien ab, `api/...` geht immer ans Netz (und wird nie gecacht)
