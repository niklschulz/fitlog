# 0015 – Gestapelte Sheets öffnen/schließen ohne globales `paint()`

## Kontext

[ADR 0014](0014-neue-uebung-sheet-gestapelt.md) baute das Neue-Übung-Sheet nach demselben Muster wie das bestehende Übungs-Detail-Sheet: beide sind über dem Übungs-Sheet gestapelte Sheets, deren Öffnen/Schließen bis dahin — wie bei allen übrigen Sheets in der App — über die oberste `paint()`-Funktion der View lief (`state.xSheetOpen = true; await paint();`).

Nutzer-Feedback vom echten Gerät: Beim Öffnen des Neue-Übung-Sheets verschwand das darunterliegende, bereits offene Übungs-Sheet kurz sichtbar und flog dann neu ein; beim Schließen passierte dasselbe umgekehrt. Ursache: `paint()` ersetzt `currentContainer.innerHTML` vollständig — dabei wurden auch die DOM-Knoten des bereits offenen Übungs-Sheets (Backdrop + Panel) zerstört und neu erzeugt. Da `.bottom-sheet`/`.bottom-sheet-backdrop` (`css/styles.css`) ihre Ein-/Ausblend-Animation über CSS `animation`-Eigenschaften umsetzen, die bei *jeder* DOM-Einfügung erneut abspielen (nicht nur beim ersten Mount), spielte die Slide-/Fade-Animation des Übungs-Sheets jedes Mal erneut ab, obwohl es die ganze Zeit sichtbar war und sich inhaltlich nicht geändert hatte.

Dieselbe Grundklasse von Bug wie beim Suchfeld-Fokusverlust (Dreiundsechzigste Iteration in design-system.md) und dem `justify-self`-Fix (Zweiundsechzigste Iteration) — jeweils: `paint()`/ein zu breiter Repaint fasst DOM an, dessen Zustand (Fokus, Animation, Layout-Kontext) eigentlich unangetastet bleiben müsste.

## Entscheidung

**Gestapelte Sheets (Übungs-Detail-Sheet, Neue-Übung-Sheet) rendern und entfernen sich beim Öffnen/Schließen per direkter DOM-Manipulation, nicht mehr über `paint()`:**

- **Öffnen**: `currentContainer.insertAdjacentHTML('beforeend', renderXSheet())` statt `state.xSheetOpen = true; await paint()`. Das eigene Sheet-Markup wird ans Ende des Containers angehängt, alles andere im DOM (inkl. des darunterliegenden Übungs-Sheets) bleibt exakt unverändert stehen.
- **Schließen**: `classList.add('closing')` direkt auf den bereits bestehenden Backdrop-/Panel-Elementen (löst dieselbe CSS-Exit-Animation aus wie zuvor der Repaint mit `closing: true`), dann nach `SHEET_CLOSE_ANIMATION_MS` `.remove()` auf beiden Elementen statt eines erneuten `paint()`.
- Die `render...Sheet()`-Funktionen der beiden Sheets brauchen dadurch keine `closing`-Fallunterscheidung mehr — sie werden nur noch exakt einmal beim Öffnen aufgerufen, nie mehr für den Schließen-Zustand.
- Beide Sheets sind dadurch komplett aus dem deklarativen Render-Ausdruck der obersten `paint()`-Funktion entfernt (`${state.xSheetOpen ? renderXSheet() : ''}`) und werden auch nicht mehr über die zentrale `wireEvents()` verdrahtet, sondern jeweils direkt aus ihrer eigenen `open...Sheet()`-Funktion heraus (`wireExerciseCreateSheetEvents()` bzw. neu `wireExerciseDetailSheetEvents()`, Letztere vorher inline in `wireEvents()`).
- Sicher trotz `render()`, das bei jedem View-Mount alle Sheet-States hart auf `false` zurücksetzt: Die Sheets werden ausschließlich per Nutzer-Klick (Buttons, die `open...Sheet()` direkt aufrufen) sichtbar, nie durch den deklarativen Template-Ausdruck — ein erneutes Anzeigen nach Tab-Wechsel war ohnehin nie vorgesehen und bleibt unverändert nicht der Fall.

**Kalender-Sheet und Übungs-Sheet selbst bleiben unverändert beim `paint()`-Muster** — sie sind die "unterste" Ebene, unter der (abgesehen von der normalen Tagesansicht, die ohnehin keine Animation trägt) kein weiteres animiertes Sheet liegt, das durch ihr Neu-Rendern versehentlich mit betroffen wäre. Die Drag-to-Dismiss-Mechanik in `js/sheet.js` (ADR 0011) bleibt für alle Sheets unverändert identisch nutzbar — sie griff schon vorher direkt auf DOM-Elemente zu, unabhängig davon, wie diese ursprünglich eingefügt wurden.

## Konsequenzen

- Behebt den gemeldeten Flacker-Bug vollständig für beide betroffenen Sheets — per DOM-Prüfung verifiziert (Backdrop-Element des Übungs-Sheets bleibt beim Öffnen/Schließen des darüberliegenden Sheets nachweislich derselbe DOM-Knoten, nicht nur optisch unauffällig).
- Etabliert ein zweites, expliziteres Muster neben dem bestehenden Teil-Repaint (`repaintExerciseSheetBodyInPlace()` & Co.): Teil-Repaint für "dieselbe Ebene enger fassen", direkte DOM-Manipulation ohne jedes `paint()` für "gestapelte Sheets, die eine tiefere Ebene nicht stören dürfen". Beide verfolgen dieselbe Grundregel (nie mehr DOM anfassen als nötig), unterscheiden sich nur im Ansatzpunkt.
- Etwas mehr Code pro Sheet (kein einheitlicher `paint()`-Durchlauf mehr, jede Sheet-Funktion verwaltet ihr eigenes Einfügen/Entfernen) — akzeptiert, da die Alternative (den Bug hinnehmen oder pauschal *nie* mehr `paint()` für irgendein Sheet zu nutzen) beides schlechter wäre.
- Als Vorlage für künftige weitere gestapelte Sheets: Immer dieses Muster verwenden, sobald ein Sheet über einem bereits offenen, animierten Sheet eingeblendet wird — nicht das einfachere `paint()`-Muster der "untersten" Sheets kopieren.
