export const quotes = [
  "Disziplin ist die Brücke zwischen Zielen und Erfolg. – Jim Rohn",
  "Wir leiden öfter in der Vorstellung als in der Wirklichkeit. – Seneca",
  "Wer sich selbst besiegt, ist der mächtigste Krieger. – Konfuzius",
  "Du hast Macht über deinen Geist – nicht über äußere Ereignisse. Erkenne das, und du findest Stärke. – Marcus Aurelius",
  "Je mehr du in Friedenszeiten schwitzt, desto weniger blutest du im Krieg. – Norman Schwarzkopf",
  "Sich selbst zu beherrschen ist die höchste Macht. – Das Sanktum",
  "Das Hindernis auf dem Weg wird zum Weg. Vergiss nie: In jedem Hindernis steckt eine Chance. – Zen-Sprichwort",
  "Andere zu beherrschen ist Stärke. Sich selbst zu beherrschen ist wahre Macht. – Laotse",
  "Bete nicht um ein leichtes Leben, bete um die Kraft, ein schweres zu ertragen. – Bruce Lee",
  "Zuerst formen wir unsere Gewohnheiten, dann formen unsere Gewohnheiten uns. – Charles C. Noble",
  "Verschwende keine Zeit mehr mit Diskussionen darüber, wie ein guter Mensch sein sollte. Sei einer. – Marcus Aurelius",
  "Wenn du ein Meister sein willst, verhalte dich wie einer, bevor du einer wirst. – Das Sanktum",
  "Beständigkeit ist die Waffe der Elite. – Unbekannt",
  "Der Sieg ist denen vorbehalten, die bereit sind, seinen Preis zu zahlen. – Sun Tzu"
];

export const getDailyQuote = (dateStr: string) => {
  // Simple hash of date string to pick a consistent quote for the day
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % quotes.length;
  return quotes[index];
};
