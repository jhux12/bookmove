import { BotProfile } from '../types/chess';

export const BOTS: BotProfile[] = [
  {
    id: 'pip',
    name: 'Pip',
    elo: 400,
    tier: 'Beginner',
    tagline: 'Enthusiastic club beginner who loves pushing pawns and trading pieces.',
    playstyle: 'Playful · Unpredictable',
    avatarUrl: '/src/assets/images/bot_avatar_pip_1794860677147.jpg',
    accentColor: '#81B64C',
    searchDepth: 1,
    blunderRate: 0.42,
    noiseCp: 220,
    aggression: 0.9,
    thinkTimeMs: [450, 800],
    dialogues: {
      greeting: [
        'Hi! I just learned how the knight hops. Ready for a fun game?',
        'Good luck! Watch out, I sometimes leave my queen unguarded by mistake.',
      ],
      capture: [
        'Ooh, I get to take that piece!',
        'Snack time for my pieces!',
      ],
      check: [
        'Check! Wait, did I mean to do that?',
        'Your king looks a bit nervous over there!',
      ],
      blunder: [
        'Uh oh... did I just walk right into a trap?',
        'Whoops! Let us pretend that was a clever sacrifice.',
      ],
      goodMove: [
        'Whoa, nice move! I did not see that coming.',
        'You play really cleanly!',
      ],
      win: [
        'Wait, I won?! Best day at the chess club ever!',
        'Great game! Want a rematch?',
      ],
      lose: [
        'Well played! You taught me a lot in that game.',
        'Checkmate! Nice job spotting the finish.',
      ],
      draw: [
        'A tie! That was super close.',
        'Draw! Looks like neither of us backed down.',
      ],
    },
  },
  {
    id: 'clara',
    name: 'Clara',
    elo: 800,
    tier: 'Beginner',
    tagline: 'Cozy cafe player who develops her pieces steadily before attacking.',
    playstyle: 'Steady · Fundamentals',
    avatarUrl: '/src/assets/images/bot_avatar_clara_1794860677580.jpg',
    accentColor: '#A3B86C',
    searchDepth: 2,
    blunderRate: 0.24,
    noiseCp: 130,
    aggression: 0.95,
    thinkTimeMs: [500, 900],
    dialogues: {
      greeting: [
        'Coffee is poured and the board is set. Shall we begin?',
        'Let us play a thoughtful, relaxed game.',
      ],
      capture: [
        'A clean exchange keeps things tidy.',
        'I will happily scoop up that material.',
      ],
      check: [
        'Check. Time to tuck your king to safety.',
        'Just a gentle check to keep you alert.',
      ],
      blunder: [
        'Hmm, I think I miscalculated that square.',
        'Ah, I overlooked that tactic. Well spotted!',
      ],
      goodMove: [
        'That is a very solid move.',
        'Strong central control!',
      ],
      win: [
        'Good game! Those extra pawns made all the difference.',
        'Thanks for the match! Care for another round?',
      ],
      lose: [
        'Well earned victory! Your coordination was sharp.',
        'You outplayed me cleanly. Great match!',
      ],
      draw: [
        'A balanced battle ending in a fair draw.',
        'Peaceful handshake on a draw!',
      ],
    },
  },
  {
    id: 'mina',
    name: 'Mina',
    elo: 1200,
    tier: 'Intermediate',
    tagline: 'Alert tactician who hunts for forks, pins, and unguarded back ranks.',
    playstyle: 'Tactical · Opportunistic',
    avatarUrl: '/src/assets/images/bot_avatar_mina_1794860677154.jpg',
    accentColor: '#34D399',
    searchDepth: 2,
    blunderRate: 0.1,
    noiseCp: 65,
    aggression: 1.12,
    thinkTimeMs: [550, 950],
    dialogues: {
      greeting: [
        'Keep an eye on your undefended pieces. I will be looking for tactics.',
        'Sharp position ahead. Let us see what you find.',
      ],
      capture: [
        'You left that slightly loose.',
        'Material gained—every tempo counts.',
      ],
      check: [
        'Check! Watch your back rank and diagonals.',
        'Putting pressure on your king.',
      ],
      blunder: [
        'Nice! You caught a tactical flaw in my setup.',
        'Respect—I missed that intermediate resource.',
      ],
      goodMove: [
        'Precise defense.',
        'Clean calculation.',
      ],
      win: [
        'Tactics decided it. Ready for a rematch?',
        'Once the files opened, the attack played itself.',
      ],
      lose: [
        'Sharp play. You neutralized every threat I threw.',
        'Impressive accuracy—well played!',
      ],
      draw: [
        'Neither side blinked. Solid draw.',
        'A tactical stalemate—good fight.',
      ],
    },
  },
  {
    id: 'soren',
    name: 'Soren',
    elo: 1550,
    tier: 'Intermediate',
    tagline: 'Bold strategist who thrives on active piece play and kingside pressure.',
    playstyle: 'Aggressive · Dynamic',
    avatarUrl: '/src/assets/images/bot_avatar_soren_1794860677973.jpg',
    accentColor: '#60A5FA',
    searchDepth: 3,
    blunderRate: 0.05,
    noiseCp: 42,
    aggression: 1.25,
    thinkTimeMs: [600, 1050],
    dialogues: {
      greeting: [
        'Play actively or get pushed off the board. Let us go.',
        'I prefer initiative over passive defense. Show me your best.',
      ],
      capture: [
        'Breaking through the position.',
        'Taking space and material together.',
      ],
      check: [
        'Check—nowhere comfortable for your king to hide.',
        'Keeping the initiative alive!',
      ],
      blunder: [
        'You turned my aggression against me. Sharp counter.',
        'Fair play, you found the refutation.',
      ],
      goodMove: [
        'Strong counterplay. This is getting interesting.',
        'I appreciate a fearless reply.',
      ],
      win: [
        'Momentum carried the attack home. Rematch?',
        'Initiative wins games. Good battle!',
      ],
      lose: [
        'You weathered the storm and struck back cleanly.',
        'Well defended and decisively converted.',
      ],
      draw: [
        'An intense tactical battle ends in equality.',
        'Hard-fought draw. Let us run it back!',
      ],
    },
  },
  {
    id: 'elena',
    name: 'Elena',
    elo: 1900,
    tier: 'Advanced',
    tagline: 'Composed tournament player known for clean technique and endgame precision.',
    playstyle: 'Positional · Technical',
    avatarUrl: '/src/assets/images/bot_avatar_elena_1794860678892.jpg',
    accentColor: '#C084FC',
    searchDepth: 3,
    blunderRate: 0.015,
    noiseCp: 18,
    aggression: 1.05,
    thinkTimeMs: [650, 1100],
    dialogues: {
      greeting: [
        'Small advantages accumulate quickly. Play with patience.',
        'A classical struggle awaits. Best of luck.',
      ],
      capture: [
        'Simplifying into a favorable structure.',
        'Converting the positional edge.',
      ],
      check: [
        'Check. Notice how your dark squares are weakening.',
        'Tightening the bind around your king.',
      ],
      blunder: [
        'An unexpected resource. I underestimated that line.',
        'Accurate move. That shifts the evaluation.',
      ],
      goodMove: [
        'Grandmaster-level restraint.',
        'Very harmonious piece placement.',
      ],
      win: [
        'Technique prevailed in the end. Review the turning point.',
        'Clean conversion. Ready for another test?',
      ],
      lose: [
        'Clinical execution on your part. Truly well played.',
        'You out-calculated me in the critical phase.',
      ],
      draw: [
        'Exact play from both sides. A textbook draw.',
        'Equality held cleanly to the end.',
      ],
    },
  },
  {
    id: 'viktor',
    name: 'Viktor',
    elo: 2250,
    tier: 'Master',
    tagline: 'Relentless veteran master who punishes inaccuracies with deep calculation.',
    playstyle: 'Master · Relentless',
    avatarUrl: '/src/assets/images/bot_avatar_viktor_1794860679687.jpg',
    accentColor: '#E58F2A',
    searchDepth: 4,
    blunderRate: 0,
    noiseCp: 6,
    aggression: 1.1,
    thinkTimeMs: [700, 1200],
    dialogues: {
      greeting: [
        'Every move creates a weakness somewhere. Prove yours are sound.',
        'Sit down and calculate deeply. I will not forgive loose play.',
      ],
      capture: [
        'As calculated.',
        'The flaw in your structure has been punished.',
      ],
      check: [
        'Check. There is very little oxygen left on the board.',
        'The king hunt begins.',
      ],
      blunder: [
        'Remarkable. You found the one line I dismissed too early.',
        'Deep calculation. You have earned my respect.',
      ],
      goodMove: [
        'Precise. You are playing at master strength.',
        'The strongest continuation in the position.',
      ],
      win: [
        'Analyze your inaccuracies and challenge me again.',
        'Checkmate. Precision separates masters from amateurs.',
      ],
      lose: [
        'Extraordinary game. Few players find that level of accuracy.',
        'I tip my king. A genuinely masterful victory.',
      ],
      draw: [
        'Holding a draw against me is no small feat. Well played.',
        'Flawless defense. Half a point well earned.',
      ],
    },
  },
];

export function pickDialogue(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}
