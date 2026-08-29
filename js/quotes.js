// Statische Sprüche nach Tageszeit (Offline-Anforderung: kein Nachladen von außen).
const QUOTES = {
  morning: [
    'Hey Frühaufsteher, los gehts!',
    'Die anderen zählen noch Schafe, du schon Wiederholungen.',
    'Der Kaffee wartet. Training zuerst.',
    'Wer morgens trainiert, braucht abends keine Ausrede mehr.',
    'Noch vor dem ersten Meeting bist du stärker als gestern.',
  ],
  day: ['Heute besiegst du die Schwerkraft.', 'Du bist hier. Das ist schon die halbe Miete.'],
  evening: [
    'Der Tag ist fast rum, aber eine gute Sache kommt noch.',
    'Jetzt kommt das Sahnehäubchen für deinen Tag.',
  ],
};

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

// Deterministisch über den Tag als Seed, damit an einem Tag konsistent
// derselbe Spruch erscheint (nicht bei jedem App-Öffnen neu zufällig).
export function getQuoteOfTheDay(date = new Date()) {
  const hour = date.getHours();
  const category = hour < 10 ? 'morning' : hour < 20 ? 'day' : 'evening';
  const list = QUOTES[category];
  const index = dayOfYear(date) % list.length;
  return list[index];
}
