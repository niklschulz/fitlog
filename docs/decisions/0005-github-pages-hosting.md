# 0005 – GitHub Pages als Hosting, Repo öffentlich

## Kontext

Die App braucht HTTPS-Hosting (Voraussetzung für Service Worker) für den Test auf einem echten iPhone. Kein eigener Server soll für den MVP nötig sein.

## Entscheidung

GitHub Pages, deployt aus der Root von `main`. Das erfordert ein **öffentliches** Repository — GitHub Pages für private Repos ist nur auf bezahlten Plänen (Pro/Team) verfügbar, nicht auf dem kostenlosen Plan.

## Konsequenzen

- Der komplette Quellcode ist öffentlich einsehbar. Unproblematisch, da die App rein clientseitig ist, keine Zugangsdaten oder Secrets enthält und keine Backend-Anbindung hat.
- **Wichtige Regel für alles, was künftig dazukommt**: Sobald echte Infrastruktur existiert (Raspberry Pi, Tailscale-Netzwerk, Zugangsdaten), dürfen deren konkrete Details (Hostnames, IP-Adressen, Ports, SSH-Zugang) **nicht** in dieses Repo — auch nicht in Doku-Form. Diese Informationen gehören ins separate private Repo `fitlog-infra`. Nur das *Prinzip* (z. B. "Sync läuft über Tailscale, kein offener Router-Port") ist hier unbedenklich.
- Deployment ist ein einfacher Push auf `main`, kein zusätzlicher CI/CD-Schritt nötig
