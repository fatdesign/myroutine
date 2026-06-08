export const quotes = [
  "Discipline is the bridge between goals and accomplishment. – Jim Rohn",
  "We suffer more often in imagination than in reality. – Seneca",
  "He who conquers himself is the mightiest warrior. – Confucius",
  "You have power over your mind - not outside events. Realize this, and you will find strength. – Marcus Aurelius",
  "The more you sweat in peace, the less you bleed in war. – Norman Schwarzkopf",
  "To rule yourself is the ultimate power. – The Sanctum",
  "The obstacle in the path becomes the path. Never forget, within every obstacle is an opportunity. – Zen Proverb",
  "Mastering others is strength. Mastering yourself is true power. – Lao Tzu",
  "Do not pray for an easy life, pray for the strength to endure a difficult one. – Bruce Lee",
  "First we make our habits, then our habits make us. – Charles C. Noble",
  "Waste no more time arguing about what a good man should be. Be one. – Marcus Aurelius",
  "If you want to be a master, act like one before you become one. – The Sanctum",
  "Consistency is the weapon of the elite. – Unknown",
  "Victory is reserved for those who are willing to pay its price. – Sun Tzu"
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
