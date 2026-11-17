// Common ECO chess openings lookup by SAN move prefix
const OPENING_BOOK: { moves: string[]; name: string }[] = [
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O'], name: 'Ruy Lopez: Morphy Defense' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'], name: 'Ruy Lopez: Morphy Defense' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], name: 'Ruy Lopez' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], name: 'Italian Game: Giuoco Piano' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'], name: 'Italian Game: Two Knights Defense' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], name: 'Italian Game' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'], name: 'Scotch Game' },
  { moves: ['e4', 'e5', 'Nf3', 'Nf6'], name: "Petrov's Defense" },
  { moves: ['e4', 'e5', 'f4'], name: "King's Gambit" },
  { moves: ['e4', 'e5', 'Nc3'], name: 'Vienna Game' },
  { moves: ['e4', 'e5'], name: "King's Pawn Game" },
  { moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'], name: 'Sicilian Defense: Najdorf' },
  { moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'g6'], name: 'Sicilian Defense: Accelerated Dragon' },
  { moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4'], name: 'Sicilian Defense: Open' },
  { moves: ['e4', 'c5', 'c3'], name: 'Sicilian Defense: Alapin' },
  { moves: ['e4', 'c5'], name: 'Sicilian Defense' },
  { moves: ['e4', 'e6', 'd4', 'd5', 'Nc3'], name: 'French Defense: Classical' },
  { moves: ['e4', 'e6', 'd4', 'd5', 'e5'], name: 'French Defense: Advance' },
  { moves: ['e4', 'e6', 'd4', 'd5'], name: 'French Defense' },
  { moves: ['e4', 'c6', 'd4', 'd5', 'Nc3'], name: 'Caro-Kann Defense: Classical' },
  { moves: ['e4', 'c6', 'd4', 'd5'], name: 'Caro-Kann Defense' },
  { moves: ['e4', 'd5'], name: 'Scandinavian Defense' },
  { moves: ['e4', 'd6'], name: 'Pirc Defense' },
  { moves: ['e4', 'Nf6'], name: "Alekhine's Defense" },
  { moves: ['e4'], name: "King's Pawn Opening" },
  { moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6'], name: "Queen's Gambit Declined" },
  { moves: ['d4', 'd5', 'c4', 'c6'], name: 'Slav Defense' },
  { moves: ['d4', 'd5', 'c4', 'dxc4'], name: "Queen's Gambit Accepted" },
  { moves: ['d4', 'd5', 'c4'], name: "Queen's Gambit" },
  { moves: ['d4', 'd5', 'Bf4'], name: 'London System' },
  { moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7'], name: "King's Indian Defense" },
  { moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'], name: 'Nimzo-Indian Defense' },
  { moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5'], name: 'Grünfeld Defense' },
  { moves: ['d4', 'Nf6', 'Bf4'], name: 'London System' },
  { moves: ['d4', 'Nf6', 'c4'], name: 'Indian Defense' },
  { moves: ['d4', 'f5'], name: 'Dutch Defense' },
  { moves: ['d4', 'd5'], name: "Queen's Pawn Game" },
  { moves: ['d4'], name: "Queen's Pawn Opening" },
  { moves: ['c4', 'e5'], name: 'English Opening: Reversed Sicilian' },
  { moves: ['c4'], name: 'English Opening' },
  { moves: ['Nf3', 'd5'], name: 'Réti Opening' },
  { moves: ['Nf3'], name: 'Zukertort Opening' },
  { moves: ['b3'], name: "Nimzo-Larsen Attack" },
  { moves: ['g3'], name: "King's Fianchetto Opening" },
];

export function detectOpening(sanList: string[]): string {
  if (sanList.length === 0) return 'Starting Position';
  let bestMatch = 'Custom Opening';
  let bestLen = 0;

  for (const entry of OPENING_BOOK) {
    if (entry.moves.length > sanList.length || entry.moves.length <= bestLen) continue;
    let matches = true;
    for (let i = 0; i < entry.moves.length; i++) {
      if (sanList[i] !== entry.moves[i]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      bestMatch = entry.name;
      bestLen = entry.moves.length;
    }
  }
  return bestMatch;
}
