# 0042 – 1RM in den Persönlichen Bestwerten (Brzycki)

**Status:** Gültig

## Kontext

Die Tabelle „Persönliche Bestwerte“ der Statistik-Übungs-Seite hatte seit Beginn eine 1RM-Zeile, die leer blieb („–“), weil die Berechnung nicht festgelegt war. Offen waren Formel, welche Sätze zählen, Auswahl des Bestwerts, Darstellung und Umfang.

## Entscheidung

- **Formel:** Brzycki, `1RM = Gewicht × 36 / (37 − Wiederholungen)`. Bei 1 Wiederholung ergibt sie exakt das Gewicht, eine Sonderbehandlung von Einzelsätzen gibt es nicht.
- **Zählende Sätze:** nur Sätze mit **1 bis 10 Wiederholungen** und Gewicht > 0. Darüber wird die Schätzung zu ungenau; solche Sätze zählen weiter für Gewicht, Volumen und Reps, aber nicht für den 1RM. Die App kennt keine Satztypen (Aufwärm-/Dropsätze), daher zählt sonst jeder gültige Satz. Reine Körpergewichtsübungen (Gewicht 0) zeigen „–“.
- **Bestwert:** der Satz mit dem höchsten berechneten 1RM im gewählten Zeitraum (3M / 1J / Max, wie die anderen Zeilen). Bei Gleichstand zählt der früheste Satz, wie bei den übrigen Bestwerten.
- **Anzeige:** Wert mit einer Nachkommastelle („,0“ entfällt, z. B. 116,6 kg bzw. 100 kg) und Datum im Format der anderen Zeilen. Der Quellsatz (Gewicht × Reps) wird nicht angezeigt.
- **Umfang:** nur die Tabelle. Es gibt kein 1RM-PR-Badge an Sätzen; die PR-Markierungen bleiben Gewicht und Reps ([ADR 0025](0025-pr-markierungen.md) unverändert).
- **Umsetzung:** `estimateOneRepMax()` und `computePersonalBests()` in `js/exerciseStats.js` (reine Funktionen, Tests in `tests/exerciseStats.test.js`), Anzeige in `js/views/statistics-exercise-detail.js`.

## Konsequenzen

- Wer überwiegend mit mehr als 10 Wiederholungen trainiert, sieht bei vielen Übungen keinen 1RM. Die Grenze lässt sich über `ONE_RM_MAX_REPS` anpassen.
- Der Wert ist eine Schätzung, kein getesteter Einzelversuch.
- Eine andere Formel oder ein 1RM-Badge wären eine neue Entscheidung (neues ADR).
