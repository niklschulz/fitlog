# 0002 – Tailwind CSS über Play CDN statt Build-Pipeline

## Kontext

Tailwind CSS wurde für schnelles, konsistentes Mobile-First-Styling gewählt (s. [ADR 0001](0001-vanilla-js-ohne-framework.md) zum "kein Build-Schritt"-Prinzip). Der reguläre Tailwind-Workflow erfordert aber normalerweise einen Build-Schritt (CLI oder PostCSS-Plugin), der von Tailwind selbst für Produktion empfohlen wird — die Play CDN (`cdn.tailwindcss.com`) ist explizit nur für Prototyping gedacht.

## Entscheidung

Trotzdem die Play CDN nutzen, mit inline `tailwind.config` für Custom-Farben (`bg`, `surface`, `accent`) direkt in `index.html`. Begründung: Abschnitt 6 des ursprünglichen Konzepts schließt die Erstinstallation explizit von der Offline-Anforderung aus ("Vollständige Nutzbarkeit ohne Internetverbindung, Erstinstallation ausgenommen") — die Play CDN passt exakt in diese Lücke: Internet nötig beim allerersten Laden, danach cached der Service Worker das Skript für alle weiteren (auch offline) Aufrufe.

## Konsequenzen

- Browser-Konsole zeigt bei jedem Laden eine Produktions-Warnung von Tailwind selbst — bewusst in Kauf genommen, kein funktionales Problem
- **Wichtiger technischer Stolperstein**: `cache.addAll()` im Service Worker verwendet standardmäßig den `cors`-Fetch-Modus. `cdn.tailwindcss.com` liefert dafür keine passenden CORS-Header, wodurch `cache.addAll()` beim Versuch, die CDN-URL mitzucachen, komplett fehlschlägt — und zwar so, dass der gesamte Service-Worker-Install-Schritt scheitert, nicht nur die eine Datei. Lösung: CDN-Skripte einzeln mit `fetch(url, { mode: 'no-cors' })` holen und als opaque Response separat cachen (s. `sw.js`)
- Bei spürbarem Bedarf (z. B. deutlich wachsender Umfang) wäre ein Wechsel auf eine einmalig kompilierte, lokal eingebundene Tailwind-CSS-Datei die nächste Eskalationsstufe — würde einen einmaligen `npx tailwindcss`-Lauf erfordern, aber weiterhin keinen laufenden Build-Prozess
