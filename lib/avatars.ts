// Pool of fun, recognizable emojis for student avatars
export const AVATAR_POOL = [
  // Animals - Mammals
  "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
  "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦆", "🦉",
  "🦇", "🐺", "🦝", "🐴", "🦄", "🐗", "🦒", "🦘", "🦙", "🦛",
  "🦏", "🐘", "🐫", "🦌", "🐆", "🦓", "🦍", "🦧",

  // Animals - Sea & Others
  "🐙", "🦀", "🐠", "🐡", "🦈", "🐬", "🦑", "🐢", "🦦", "🦭",
  "🐊", "🦎", "🐍", "🦖", "🦕", "🐳", "🦐", "🦞", "🐌",
  "🦋", "🐝", "🐛", "🐞", "🦗", "🕷️", "🦂",

  // Food - Fruits
  "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍒", "🍑", "🥝",
  "🥑", "🍍", "🥭", "🍈", "🫐", "🥥", "🍅", "🌽", "🥕", "🥒",

  // Food - Meals & Snacks
  "🍕", "🍔", "🌭", "🍟", "🍿", "🧁", "🍩", "🍪", "🎂", "🍰",
  "🥐", "🥨", "🥖", "🧀", "🥚", "🍳", "🥞", "🧇", "🥓", "🌮",
  "🌯", "🥙", "🥗", "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟",

  // Sports & Activities
  "⚽", "🏀", "🎾", "🏈", "⚾", "🥎", "🏐", "🏉", "🥏", "🎱",
  "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥊", "🥋", "⛸️",

  // Objects & Fun
  "🎯", "🎮", "🎸", "🎹", "🎨", "🎭", "🎬", "📚", "🔭", "🔬",
  "⚗️", "🧲", "🧪", "🎲", "🪀", "🎺", "🎷", "🥁", "🎻", "🪕",

  // Nature & Weather
  "🌻", "🌹", "🌵", "🍀", "🌲", "🌴", "🌾",
  "⭐", "🌙", "☀️", "⛅", "🌈", "⚡", "❄️", "☃️", "🔥", "💧",

  // Special & Symbols
  "🎈", "🎉", "🎁", "💎", "👑", "🎪", "🏆", "🥇",
  "🔔", "🎀", "💝", "🌟", "✨", "🎵",
];

// Emoji to name mapping for alphabetical sorting
export const EMOJI_NAMES: Record<string, string> = {
  // Animals - Mammals
  "🐶": "dog", "🐱": "cat", "🐭": "mouse", "🐹": "hamster", "🐰": "rabbit",
  "🦊": "fox", "🐻": "bear", "🐼": "panda", "🐨": "koala", "🐯": "tiger",
  "🦁": "lion", "🐮": "cow", "🐷": "pig", "🐸": "frog", "🐵": "monkey",
  "🐔": "chicken", "🐧": "penguin", "🐦": "bird", "🦆": "duck", "🦉": "owl",
  "🦇": "bat", "🐺": "wolf", "🦝": "raccoon", "🐴": "horse", "🦄": "unicorn",
  "🐗": "boar", "🦒": "giraffe", "🦘": "kangaroo", "🦙": "llama", "🦛": "hippo",
  "🦏": "rhino", "🐘": "elephant", "🐫": "camel", "🦌": "deer",
  "🐆": "leopard", "🦓": "zebra", "🦍": "gorilla", "🦧": "orangutan",

  // Animals - Sea & Others
  "🐙": "octopus", "🦀": "crab", "🐠": "fish", "🐡": "pufferfish", "🦈": "shark",
  "🐬": "dolphin", "🦑": "squid", "🐢": "turtle", "🦦": "otter", "🦭": "seal",
  "🐊": "crocodile", "🦎": "lizard", "🐍": "snake", "🦖": "t-rex", "🦕": "dinosaur",
  "🐳": "whale", "🦐": "shrimp", "🦞": "lobster", "🐌": "snail",
  "🦋": "butterfly", "🐝": "bee", "🐛": "caterpillar", "🐞": "ladybug", "🦗": "cricket",
  "🕷️": "spider", "🦂": "scorpion",

  // Food - Fruits
  "🍎": "apple", "🍊": "orange", "🍋": "lemon", "🍌": "banana", "🍉": "watermelon",
  "🍇": "grapes", "🍓": "strawberry", "🍒": "cherries", "🍑": "peach", "🥝": "kiwi",
  "🥑": "avocado", "🍍": "pineapple", "🥭": "mango", "🍈": "melon", "🫐": "blueberry",
  "🥥": "coconut", "🍅": "tomato", "🌽": "corn", "🥕": "carrot", "🥒": "cucumber",

  // Food - Meals & Snacks
  "🍕": "pizza", "🍔": "burger", "🌭": "hotdog", "🍟": "fries", "🍿": "popcorn",
  "🧁": "cupcake", "🍩": "donut", "🍪": "cookie", "🎂": "cake", "🍰": "shortcake",
  "🥐": "croissant", "🥨": "pretzel", "🥖": "baguette", "🧀": "cheese", "🥚": "egg",
  "🍳": "fried-egg", "🥞": "pancake", "🧇": "waffle", "🥓": "bacon", "🌮": "taco",
  "🌯": "burrito", "🥙": "pita", "🥗": "salad", "🍝": "pasta", "🍜": "ramen",
  "🍲": "stew", "🍛": "curry", "🍣": "sushi", "🍱": "bento", "🥟": "dumpling",

  // Sports & Activities
  "⚽": "soccer", "🏀": "basketball", "🎾": "tennis", "🏈": "football", "⚾": "baseball",
  "🥎": "softball", "🏐": "volleyball", "🏉": "rugby", "🥏": "frisbee", "🎱": "pool",
  "🏓": "ping-pong", "🏸": "badminton", "🏒": "hockey", "🏑": "field-hockey", "🥍": "lacrosse",
  "🏏": "cricket-bat", "🪃": "boomerang", "🥊": "boxing", "🥋": "martial-arts", "⛸️": "skate",

  // Objects & Fun
  "🎯": "dart", "🎮": "gamepad", "🎸": "guitar", "🎹": "piano", "🎨": "palette",
  "🎭": "theater", "🎬": "movie", "📚": "books", "🔭": "telescope", "🔬": "microscope",
  "⚗️": "flask", "🧲": "magnet", "🧪": "test-tube", "🎲": "dice", "🪀": "yo-yo",
  "🎺": "trumpet", "🎷": "saxophone", "🥁": "drum", "🎻": "violin", "🪕": "banjo",

  // Nature & Weather
  "🌻": "sunflower", "🌹": "rose", "🌵": "cactus", "🍀": "clover", "🌲": "tree", "🌴": "palm", "🌾": "wheat",
  "⭐": "star", "🌙": "moon", "☀️": "sun", "⛅": "cloud", "🌈": "rainbow",
  "⚡": "lightning", "❄️": "snowflake", "☃️": "snowman", "🔥": "fire", "💧": "droplet",

  // Special & Symbols
  "🎈": "balloon", "🎉": "party", "🎁": "gift", "💎": "gem", "👑": "crown",
  "🎪": "circus", "🏆": "trophy", "🥇": "medal",
  "🔔": "bell", "🎀": "bow", "💝": "heart", "🌟": "star-glow", "✨": "sparkle", "🎵": "music",

  // Duplicate entries for emojis without variation selectors (for compatibility)
  "🕷": "spider", "⛸": "skate", "☀": "sun", "⛅": "cloud",
  "❄": "snowflake", "☃": "snowman", "⚡": "lightning",
};

// Get emoji name for sorting/display
export function getEmojiName(emoji: string): string {
  // Try exact match first
  let name = EMOJI_NAMES[emoji];

  // If not found, try removing variation selectors (U+FE0F)
  if (!name) {
    const normalized = emoji.replace(/\uFE0F/g, '');
    name = EMOJI_NAMES[normalized];
  }

  if (!name) {
    console.warn(`Missing emoji name for: ${emoji}`);
    return "user"; // Fallback to generic name instead of showing emoji
  }
  return name;
}

// Get 3 random unique avatars from the pool, excluding taken ones
export function getRandomAvatars(count: number = 3, takenAvatars: string[] = []): string[] {
  const available = AVATAR_POOL.filter((avatar) => !takenAvatars.includes(avatar));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
