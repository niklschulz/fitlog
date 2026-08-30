# Features & Scope

## MVP-Scope

- Übungen anlegen/bearbeiten/löschen
- Routinen anlegen/bearbeiten/löschen (Sammlung von Übungen als Trainingsvorlage, mit Reihenfolge)
- Training starten (optional auf Basis einer Routine), Sätze (Gewicht, Wiederholungen) eintragen
- Trainingsverlauf einsehen, nachträglich bearbeiten
- Alle Einträge jederzeit und dauerhaft bearbeit- und löschbar
- Vollständig offline nutzbar (Erstinstallation ausgenommen)

## Explizit nicht im MVP

- Sync zu einem Backend (geplant, s. [architecture.md](architecture.md#sync--infrastruktur-geplant-noch-nicht-gebaut))
- Multi-Device-Sync mit Konfliktauflösung
- Push-Benachrichtigungen
- HealthKit-/Apple-Watch-Integration
- Nutzerverwaltung (Single-User-System)

## Die vier Kern-Flows

### Übungen (`js/views/exercises.js`)
Liste aller Übungen (alphabetisch), "+ Neue Übung" öffnet ein Formular, Tap auf bestehende Übung öffnet dasselbe Formular vorbefüllt zum Bearbeiten. Löschen mit Bestätigungsdialog — entfernt die Übung aus allen Routinen, bereits erfasste Sätze bleiben erhalten (zeigen "Gelöschte Übung" als Fallback).

### Routinen (`js/views/routines.js`)
Liste aller Routinen mit Übungs-Anzahl. "+ Neue Routine" fragt zuerst nur den Namen ab, führt danach direkt in den Editor. Im Editor: Name jederzeit änderbar, Übungen per Picker hinzufügen (inkl. spontaner Neuanlage), per ▲/▼-Buttons umsortieren (kein Drag&Drop), per ✕ entfernen. Löschen mit Bestätigung.

### Training (`js/views/training.js`) — Kernfunktion
Start optional mit Routine (Übungen der Routine werden als Chips vorgeschlagen, erste Übung automatisch vorausgewählt) oder ohne. Weitere Übungen über aufklappbare Liste erreichbar, inkl. spontaner Neuanlage. Gewicht/Wiederholungen werden mit dem letzten Satz derselben Übung vorbefüllt (**Progressive-Overload-Hilfe**, übungsbezogen über alle Trainings hinweg). Sätze erscheinen laufend (neueste zuerst), sofort löschbar. **Ein aktives Training übersteht App-Neustart**: beim Öffnen wird geprüft, ob ein Workout mit `finishedAt: null` existiert, und automatisch fortgesetzt — wichtig, falls die App im Gym geschlossen/neu geladen wird.

### Verlauf (`js/views/history.js`)
Liste vergangener Trainings (Datum, Dauer, Routine, Satzanzahl), neueste zuerst. Ein laufendes Training zeigt "läuft" statt Dauer und lässt sich auch von hier beenden. Detailansicht: Tap auf einen Satz öffnet Inline-Bearbeitung (Gewicht/Wiederholungen ändern oder löschen). Sätze lassen sich auch nachträglich zu bereits abgeschlossenen Trainings hinzufügen (inkl. Progressive-Overload-Vorbefüllung). Training löschen kaskadiert auf alle zugehörigen Sätze.

### Profil (`js/views/profile.js`) — Vorbereitung für späteren Sync
Fünfter Tab, ganz rechts. Drei Zustände: **kein Profil** (Hinweistext + "Profil hinzufügen"-Button), **Formular** (Username + Token als Pflichtfelder, unmaskierter Text, Speichern/Abbrechen), **Profil vorhanden** (zeigt Username und Token an, darunter "Profil entfernen" mit Bestätigungsdialog, wie überall sonst in der App). Kein Bearbeiten-Modus — ein Token-Wechsel läuft über Entfernen + erneutes Hinzufügen. Beide Werte werden lokal über `localStorage` gespeichert (`js/profile.js`), nicht in der Dexie-Datenbank — sind reine Geräte-Konfiguration, keine Trainingsdaten. **Der eigentliche Sync findet noch nicht statt** (kein Backend vorhanden), das Tracking funktioniert unabhängig vom Profil-Status vollständig offline weiter. Hintergrund: [ADR 0006](decisions/0006-token-basierte-nutzertrennung.md).

## Lösch-Verhalten (Kurzfassung)

Siehe [ADR 0004](decisions/0004-loesch-kaskaden.md) für die vollständige Begründung.

| Aktion | Konsequenz |
|---|---|
| Übung löschen | Aus allen Routinen entfernt, Sätze bleiben (Fallback-Anzeige) |
| Routine löschen | Verknüpfungen gelöscht, betroffene Trainings bleiben (`routineId` → `null`) |
| Training löschen | Alle zugehörigen Sätze werden mitgelöscht |
| Satz löschen | Nur der Satz selbst |

## UI/UX-Leitplanken

- Mobile-first, Touch-Targets mind. 44×44px
- Dunkles Theme, Akzentfarbe Limette-Grün — fest, kein Light/Dark-Toggle im MVP. Vollständige Farbpalette, Typografie- und Radius-Tokens: [design-system.md](design-system.md)
- Bestätigungsdialog vor jedem Löschen (`window.confirm`, ausreichend für den MVP-Umfang)
- Freischwebende, pillenförmige Bottom-Tab-Navigation mit Icons: Training, Übungen, Routinen, Verlauf, Profil

## Vorgemerkte, noch nicht spezifizierte Erweiterungen

- Zusätzliche Satz-Felder (Notizen, RPE/Anstrengungsgrad, Pausenzeiten)
- Auswertungen auf Basis der Routine-Verknüpfung (z. B. Trainingshäufigkeit pro Routine)

## Verworfene Experimente

- **Home-Tab mit tageszeitabhängigem Spruch**: wurde vollständig implementiert (deterministische Sprüche pro Tageszeit, lokal eingebundene Serifenschrift) und auf ausdrücklichen Wunsch wieder entfernt. Details im [CHANGELOG](CHANGELOG.md).
