# 0006 – Token-basierte Nutzertrennung für den späteren Sync

## Kontext

Die App wird künftig von mehreren Personen genutzt (aktuell zwei, generisch erweiterbar), deren Trainingsdaten beim geplanten Sync zum Pi-Backend (s. [architecture.md](../architecture.md#sync--infrastruktur-geplant-noch-nicht-gebaut)) server-seitig getrennt gehalten werden müssen. Ein vollwertiges Login-System (Passwort, Sessions, Registrierung) steht aber in keinem Verhältnis zum eigentlichen Schutzbedarf: Der Netzwerkzugriff selbst ist bereits über Tailscale (privates Mesh-VPN) beschränkt, es geht nur noch um die *Zuordnung* von Daten zu Personen, nicht um Abwehr fremder Angreifer aus dem offenen Internet.

## Entscheidung

- **Bearer-Token statt Login**: Jede Person bekommt einen langen, zufälligen, vom Pi generierten Token. Einmalig in der App hinterlegt, danach bei jedem Sync automatisch mitgeschickt (`Authorization: Bearer <token>`). Kein Passwort, keine Session, kein Ablauf/Refresh.
- **Server-seitige `users`-Tabelle** (`id`, `name`, `token`, `createdAt`) ordnet Tokens Personen zu; alle Sync-relevanten Tabellen (`workouts`, `routines`, `exercises`, `sets`) bekommen serverseitig ein zusätzliches `userId`-Feld. **Die lokale IndexedDB auf dem Gerät bleibt davon unberührt** — dort ist ohnehin nur eine Person pro Gerät aktiv.
- **Klartext-Token in der Datenbank** (bewusste MVP-Vereinfachung): Für einen kleinen, bekannten Nutzerkreis mit Zugriff ausschließlich über das private Tailnet wird auf Hashing verzichtet. Spätere Härtung (Token hashen wie ein Passwort) ist eine mögliche Eskalationsstufe, kein aktueller Scope.
- **Nutzer-Anlage per CLI-Skript auf dem Pi** (`node create-user.js "<Name>"`) statt Web-Backoffice: Anlegen ist ein seltenes Ereignis, ein zusätzliches Web-Interface wäre unnötige Angriffsfläche ohne echten Mehrwert.

## Konsequenzen

- Kein Passwort-Reset-Flow, keine Session-Verwaltung nötig — reduziert Implementierungsaufwand erheblich
- Sicherheit hängt vollständig an der Tailscale-Netzwerkgrenze und der Geheimhaltung des Tokens selbst — ohne Tailscale-Zugriff kann niemand Sync-Anfragen überhaupt stellen
- Ein Token-Leak (z. B. Screenshot, Shoulder-Surfing) erlaubt vollen Lese-/Schreibzugriff auf die Trainingsdaten der jeweiligen Person, ohne dass die Person das bemerkt (kein Login-Alert, keine Geräte-Liste) — akzeptiert für den privaten Nutzerkreis
- **Reale Namen und reale Token-Werte dürfen nicht ins öffentliche `fitlog`-Repo** — nur das hier beschriebene Funktionsprinzip ist öffentlich unbedenklich, s. [ADR 0005](0005-github-pages-hosting.md)
- Frontend-seitig vorbereitet über den "Profil"-Tab (Username + Token, lokal gespeichert), auch bevor das Backend existiert — Sync selbst bleibt inaktiv, bis der Pi tatsächlich läuft
