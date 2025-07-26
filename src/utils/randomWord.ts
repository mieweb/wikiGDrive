export function randomWord() {
  const words = [
    "apple", "book", "chair", "desk", "lamp", "pen", "cup", "plate", "fork", "spoon",
    "table", "door", "window", "car", "bike", "tree", "flower", "grass", "stone", "path",
    "river", "hill", "cloud", "sky", "star", "moon", "sun", "bird", "fish", "cat",
    "dog", "horse", "cow", "sheep", "pig", "barn", "field", "road", "bridge", "fence",
    "gate", "wall", "roof", "floor", "room", "bed", "pillow", "blanket", "sheet", "clock",
    "watch", "phone", "screen", "mouse", "key", "lock", "bag", "shoe", "hat", "coat",
    "shirt", "pants", "sock", "belt", "ring", "chain", "box", "jar", "can", "bottle",
    "glass", "bowl", "pot", "pan", "knife", "sponge", "towel", "soap", "brush", "comb",
    "mirror", "sink", "tap", "pipe", "wire", "bulb", "fan", "switch", "plug", "cord",
    "paper", "card", "note", "map", "globe", "flag", "sign", "post", "mail", "stamp",
    "coin", "bill", "wallet", "purse", "clip", "pin", "tape", "glue", "string", "rope",
    "net", "hook", "nail", "screw", "bolt", "nut", "tool", "hammer", "saw", "drill",
    "axe", "shovel", "rake", "hoe", "wheel", "cart", "boat", "oar", "sail", "anchor",
    "flag", "bell", "horn", "drum", "flute", "guitar", "piano", "song", "tune", "note",
    "band", "stage", "light", "curtain", "seat", "row", "ticket", "pass", "guide", "tour",
    "path", "trail", "park", "bench", "swing", "slide", "pool", "lake", "pond", "dock",
    "raft", "float", "tube", "ball", "bat", "net", "goal", "score", "game", "card",
    "dice", "chip", "board", "piece", "move", "turn", "win", "loss", "tie", "point",
    "line", "dot", "dash", "mark", "spot", "stain", "print", "paint", "brush", "canvas",
    "frame", "lens", "scope", "view", "sight", "glance", "look", "stare", "peek", "gaze"
  ];

  return words[Math.floor(Math.random() * words.length)];
}
