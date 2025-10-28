// Pool of fun, recognizable emojis for student avatars
export const AVATAR_POOL = [
  // Animals
  "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
  "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦆", "🦉",
  "🦋", "🐝", "🐙", "🦀", "🐠", "🐡", "🦈", "🐬", "🦑", "🐢",

  // Food
  "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍒", "🍑", "🥝",
  "🍕", "🍔", "🌭", "🍟", "🍿", "🧁", "🍩", "🍪", "🎂", "🍰",

  // Objects & Nature
  "⚽", "🏀", "🎾", "🏈", "⚾", "🎯", "🎮", "🎸", "🎹", "🎨",
  "🌸", "🌺", "🌻", "🌹", "🌷", "⭐", "🌙", "☀️", "⛅", "🌈",
  "🎈", "🎉", "🎁", "🔥", "💎", "👑", "🎪", "🎭", "🎬", "📚",
];

// Emoji to name mapping for alphabetical sorting
export const EMOJI_NAMES: Record<string, string> = {
  // Animals
  "🐶": "dog", "🐱": "cat", "🐭": "mouse", "🐹": "hamster", "🐰": "rabbit",
  "🦊": "fox", "🐻": "bear", "🐼": "panda", "🐨": "koala", "🐯": "tiger",
  "🦁": "lion", "🐮": "cow", "🐷": "pig", "🐸": "frog", "🐵": "monkey",
  "🐔": "chicken", "🐧": "penguin", "🐦": "bird", "🦆": "duck", "🦉": "owl",
  "🦋": "butterfly", "🐝": "bee", "🐙": "octopus", "🦀": "crab", "🐠": "fish",
  "🐡": "pufferfish", "🦈": "shark", "🐬": "dolphin", "🦑": "squid", "🐢": "turtle",

  // Food
  "🍎": "apple", "🍊": "orange", "🍋": "lemon", "🍌": "banana", "🍉": "watermelon",
  "🍇": "grapes", "🍓": "strawberry", "🍒": "cherries", "🍑": "peach", "🥝": "kiwi",
  "🍕": "pizza", "🍔": "burger", "🌭": "hotdog", "🍟": "fries", "🍿": "popcorn",
  "🧁": "cupcake", "🍩": "donut", "🍪": "cookie", "🎂": "cake", "🍰": "shortcake",

  // Objects & Nature
  "⚽": "soccer", "🏀": "basketball", "🎾": "tennis", "🏈": "football", "⚾": "baseball",
  "🎯": "dart", "🎮": "gamepad", "🎸": "guitar", "🎹": "piano", "🎨": "palette",
  "🌸": "blossom", "🌺": "hibiscus", "🌻": "sunflower", "🌹": "rose", "🌷": "tulip",
  "⭐": "star", "🌙": "moon", "☀️": "sun", "⛅": "cloud", "🌈": "rainbow",
  "🎈": "balloon", "🎉": "party", "🎁": "gift", "🔥": "fire", "💎": "gem",
  "👑": "crown", "🎪": "circus", "🎭": "theater", "🎬": "movie", "📚": "books",
};

// Get emoji name for sorting/display
export function getEmojiName(emoji: string): string {
  return EMOJI_NAMES[emoji] || emoji;
}

// Get 3 random unique avatars from the pool
export function getRandomAvatars(count: number = 3): string[] {
  const shuffled = [...AVATAR_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
