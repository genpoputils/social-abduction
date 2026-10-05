const ADJECTIVES = [
  'Curious', 'Silent', 'Clever', 'Midnight', 'Shadow',
  'Velvet', 'Starlight', 'Phantom', 'Mystic', 'Crimson',
  'Silver', 'Golden', 'Swift', 'Wandering', 'Dusk',
  'Hollow', 'Fierce', 'Noble', 'Ancient', 'Subtle',
  'Frost', 'Ember', 'Quiet', 'Vigilant', 'Astral'
];

const ANIMALS = [
  'Fox', 'Raven', 'Wolf', 'Owl', 'Lynx',
  'Badger', 'Bear', 'Hare', 'Falcon', 'Panther',
  'Stag', 'Crow', 'Otter', 'Hawk', 'Viper',
  'Cobra', 'Leopard', 'Eagle', 'Marten', 'Robin',
  'Tiger', 'Bison', 'Kestrel', 'Jackal', 'Swan'
];

export function generateAnonymousName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}

const ROOM_CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateRoomId(length: number = 6): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
  }
  return result;
}
