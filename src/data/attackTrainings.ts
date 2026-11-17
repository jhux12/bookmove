import { PieceColor } from '../types/chess';

export interface TrainingStep {
  san: string;
  note: string;
}
export interface TrainingBranch {
  id: string;
  name: string;
  opponentChoice: string;
  lesson: string;
  steps: TrainingStep[];
  practiceFromPly: number;
}
export interface AttackTraining {
  id: string;
  title: string;
  subtitle: string;
  goal: string;
  playerColor: PieceColor;
  branches: TrainingBranch[];
  warnings: Record<string, Record<string, string>>;
}
const branch = (
  id: string,
  name: string,
  opponentChoice: string,
  lesson: string,
  moves: string,
  practiceFromPly: number,
  notes: Record<number, string>
): TrainingBranch => ({
  id,
  name,
  opponentChoice,
  lesson,
  practiceFromPly,
  steps: moves
    .split(' ')
    .map((san, i) => ({
      san,
      note:
        notes[i + 1] ?? `${san}: continue developing and check the opponent’s immediate threats.`,
    })),
});

export const ATTACK_TRAININGS: AttackTraining[] = [
  {
    id: 'fried-liver',
    title: 'Fried Liver Attack',
    subtitle: 'Attack f7 — or change plans when Black defends.',
    goal: 'Recognize when Nxf7 is available. Against better defenses, save your bishop and build the center instead of forcing the sacrifice.',
    playerColor: 'w',
    warnings: {},
    branches: [
      branch(
        'accepted',
        'The sacrifice is available',
        'Black recaptures with …Nxd5',
        'The knight on d5 leaves f7 vulnerable. Nxf7 draws the king out, then Qf3+ and Nc3 develop with threats. This is an attack to calculate, not a promised forced mate.',
        'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7 Kxf7 Qf3+ Ke6 Nc3',
        10,
        {
          5: 'Bc4 aims at f7, the pawn defended only by the king.',
          7: 'Ng5 adds a second attacker to f7.',
          8: '…d5 blocks the bishop’s diagonal. Remove that central blocker first.',
          9: 'exd5 reopens the diagonal; now watch how Black recaptures.',
          10: '…Nxd5 allows Nxf7. This is the specific position where the Fried Liver sacrifice is available.',
          11: 'Nxf7 sacrifices the knight to expose the king; keep calculating forcing checks.',
          12: '…Kxf7 brings the king into the open. Bring the queen into the attack with check.',
          13: 'Qf3+ attacks along the f-file and develops a piece.',
          14: '…Ke6 supports the d5 knight. Add another attacker by developing Nc3.',
          15: 'Nc3 adds pressure to d5. Continue calculating; do not assume the exposed king means an automatic win.',
        }
      ),
      branch(
        'polerio',
        'Black chooses the Polerio defense',
        '…Na5 attacks your bishop',
        'After …Na5, the Fried Liver sacrifice is no longer the plan. Check first with Bb5+, exchange in the center, then retreat safely.',
        'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6 dxc6 bxc6 Be2 h6 Nf3',
        10,
        {
          8: 'Black blocks the bishop with …d5; capture the central pawn.',
          10: '…Na5 attacks your bishop instead of recapturing on d5. Switch plans: Bb5+ gains a tempo.',
          11: 'Bb5+ checks before you resolve the bishop attack.',
          12: '…c6 blocks the check and offers a pawn to gain time.',
          13: 'dxc6 takes the pawn while maintaining the attack on the center.',
          14: '…bxc6 opens the b-file. Retreat the bishop to e2.',
          15: 'Be2 brings the bishop to safety; the sacrifice on f7 is not available in this line.',
          16: '…h6 attacks the knight. Retreat and complete development.',
          17: 'Nf3 preserves the knight. Your next priorities are castling and central control.',
        }
      ),
      branch(
        'fritz',
        'Black counters with the Fritz variation',
        '…Nd4 changes the tactical targets',
        'The c6 knight jumps into d4 rather than recapturing. Answer the central threat; do not play the Fried Liver sacrifice automatically.',
        'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nd4 c3 b5 Bf1 Nxd5 Ne4',
        10,
        {
          8: '…d5 interrupts the bishop’s diagonal. Exchange on d5 first.',
          10: '…Nd4 puts a knight in the center. Challenge it with c3 rather than sacrificing on f7.',
          11: 'c3 attacks the d4 knight and supports the center.',
          12: '…b5 counterattacks your bishop. Move it to safety before taking the knight.',
          13: 'Bf1 preserves the bishop while Black has tactical counterplay.',
          14: '…Nxd5 vacates f6 and opens the queen’s diagonal toward your g5 knight. Do not grab the d4 knight automatically.',
          15: 'Ne4 saves the g5 knight from the queen’s diagonal and centralizes it. This is a counterattack to meet carefully, not a Fried Liver sacrifice.',
        }
      ),
      branch(
        'traxler',
        'Black plays the Traxler counterattack',
        '…Bc5 creates threats against your king',
        'Choose Bxf7+ to meet the counterattack with check. Retreat the bishop and castle; blindly playing Nxf7 enters a different, very sharp sacrifice.',
        'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 Bc5 Bxf7+ Ke7 Bb3 Rf8 O-O',
        8,
        {
          7: 'Ng5 threatens f7, but Black may counterattack instead of defending it.',
          8: '…Bc5 is the Traxler counterattack. Take with the bishop and check, not automatically with the knight.',
          9: 'Bxf7+ forces the king to respond before Black can launch …Bxf2+.',
          10: '…Ke7 steps out of check. Preserve the bishop with Bb3.',
          11: 'Bb3 withdraws the bishop along a safe diagonal.',
          12: '…Rf8 pressures the f-file. Castle rather than continue grabbing material.',
          13: 'O-O completes king safety. You have changed plans in response to the counterattack.',
        }
      ),
    ],
  },
  {
    id: 'evans-gambit',
    title: 'Evans Gambit',
    subtitle: 'Trade a pawn for time — and adapt to the bishop’s retreat.',
    goal: 'Use c3 and d4 to build a center. If Black declines the pawn, gain space without pretending you have sacrificed material.',
    playerColor: 'w',
    warnings: {},
    branches: [
      branch(
        'accepted-ba5',
        'Accepted: the bishop retreats to a5',
        '…Bxb4 and …Ba5',
        'The bishop has spent tempi taking the pawn and retreating. Use the time for d4 and castling instead of trying to win the pawn back immediately.',
        'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O',
        10,
        {
          6: '…Bc5 places the bishop where b4 can gain time.',
          7: 'b4 offers a pawn to deflect the bishop.',
          8: '…Bxb4 accepts. Gain a tempo on the bishop with c3.',
          9: 'c3 attacks the bishop and supports d4.',
          10: '…Ba5 keeps the bishop active. Strike in the center with d4.',
          11: 'd4 opens lines while Black is behind in development.',
          12: '…exd4 opens the center. Castle before recovering material.',
          13: 'O-O brings the king to safety and activates the rook. Your compensation is activity, not an automatic material recovery.',
        }
      ),
      branch(
        'accepted-be7',
        'Accepted: Black retreats to e7',
        '…Be7 returns the bishop home',
        'Black chooses a restrained defense. Build the center and develop; an Evans gambit does not require a reckless attack every move.',
        'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Be7 d4 d6 O-O Nf6 Re1',
        10,
        {
          8: 'Black accepts the pawn. Chase the bishop with c3.',
          10: '…Be7 chooses a more defensive retreat. Build the center with d4.',
          11: 'd4 gains central space.',
          12: '…d6 supports e5. Finish king safety instead of forcing an unsupported sacrifice.',
          13: 'O-O connects your plan to rapid development.',
          14: '…Nf6 attacks e4. Support your center with Re1.',
          15: 'Re1 defends e4 and brings the rook into the game.',
        }
      ),
      branch(
        'declined',
        'Declined: keep the space',
        '…Bb6 refuses your pawn',
        'When the gambit is declined, there is no missing pawn to recover. Use a4 to gain space and develop toward the center.',
        'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bb6 a4 a6 Nc3 Nf6 Nd5',
        8,
        {
          7: 'b4 offers the gambit, but Black can refuse it.',
          8: '…Bb6 declines. Switch to gaining queenside space with a4.',
          9: 'a4 prepares a5 and asks where the bishop will retreat.',
          10: '…a6 creates a retreat square on a7. Develop rather than push pawns without support.',
          11: 'Nc3 develops toward d5.',
          12: '…Nf6 attacks e4. Nd5 challenges this defender while using your central space.',
          13: 'Nd5 occupies an active central square. This is a space-and-development plan, not a pawn-sacrifice race.',
        }
      ),
      branch(
        'accepted-bc5',
        'Accepted: Black returns to c5',
        '…Bc5 keeps pressure on f2',
        'Continue with d4 to challenge the active bishop, then castle. Recognize the same central idea despite a different retreat square.',
        'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Bc5 d4 exd4 O-O d6 cxd4',
        10,
        {
          8: 'Black accepts the pawn. Play c3 to chase the bishop.',
          10: '…Bc5 returns to the attacking diagonal. d4 gains space and attacks it again.',
          11: 'd4 challenges the bishop and opens the center.',
          12: '…exd4 captures a central pawn. Put your king to safety first.',
          13: 'O-O completes castling before recovering the d4 pawn.',
          14: '…d6 supports Black’s position. Recapture on d4 to establish your center.',
          15: 'cxd4 builds the two-pawn center. Complete development before starting a direct attack.',
        }
      ),
    ],
  },
  {
    id: 'greek-gift',
    title: 'Greek Gift',
    subtitle: 'Check the conditions before sacrificing on h7.',
    goal: 'Recognize the Bxh7+ pattern, bring the knight and queen into the attack, and keep the bishop when the sacrifice is declined. A kingside fianchetto calls for another plan.',
    playerColor: 'w',
    warnings: {},
    branches: [
      branch(
        'king-retreats',
        'Accepted: the king retreats',
        '…Kxh7, …Kg8',
        'Bxh7+ draws the king out; Ng5+ gains time to bring the queen to h5. Continue calculating defenses rather than declaring a forced mate.',
        'e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 Nf3 c5 Bd3 Nc6 Bf4 Be7 O-O O-O Bxh7+ Kxh7 Ng5+ Kg8 Qh5',
        16,
        {
          7: 'e5 gains space and drives the knight away from f6, an important defensive square.',
          14: '…Be7 develops without adding a knight defender on f6. Castle and watch where the king goes.',
          16: '…O-O places the king behind h7. The bishop, knight and queen can now coordinate against that square.',
          17: 'Bxh7+ offers the bishop. This pattern depends on piece coordination; it is not safe in every castled position.',
          18: '…Kxh7 accepts. Use Ng5+ to bring the knight into the attack with tempo.',
          19: 'Ng5+ checks and clears f3 for the queen’s route.',
          20: '…Kg8 retreats. Bring the queen to h5 to keep attacking h7.',
          21: 'Qh5 brings a second piece toward the king. Calculate Black’s defensive resources before committing further material.',
        }
      ),
      branch(
        'king-advances',
        'Accepted: the king steps forward',
        '…Kg6 changes the checking route',
        'The king does not have to retreat. Against …Kg6, Qd3+ uses the open diagonal; do not blindly play the queen move from the retreating-king line.',
        'e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 Nf3 c5 Bd3 Nc6 Bf4 Be7 O-O O-O Bxh7+ Kxh7 Ng5+ Kg6 Qd3+',
        16,
        {
          16: 'Black castles into the h7 pattern. Start by checking with the bishop.',
          18: '…Kxh7 accepts. Bring the knight into the attack with check.',
          19: 'Ng5+ forces a king decision; watch the actual reply.',
          20: '…Kg6 advances instead of retreating. Switch the queen’s route: Qd3+ checks along d3–g6.',
          21: 'Qd3+ follows the king onto its new diagonal. The next phase requires fresh calculation, including possible pawn blocks.',
        }
      ),
      branch(
        'declined',
        'Declined: preserve the bishop',
        '…Kh8 refuses the sacrifice',
        'If the king moves away rather than taking, retreat the bishop. You have won the h-pawn without having to donate a piece.',
        'e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 Nf3 c5 Bd3 Nc6 Bf4 Be7 O-O O-O Bxh7+ Kh8 Bd3',
        16,
        {
          16: 'Black castles. Check with Bxh7+ and watch whether the king actually captures.',
          17: 'Bxh7+ offers the bishop, but acceptance is not forced.',
          18: '…Kh8 declines. Do not continue as if your bishop had been captured; bring it back.',
          19: 'Bd3 preserves the bishop and the extra pawn. Reassess the center before attacking again.',
        }
      ),
      branch(
        'fianchetto',
        'No sacrifice: Black plays …g6',
        '…g6 changes the pawn shield',
        'The target has changed before castling. Complete development with Re1 and Qd2 instead of forcing a Bxh7+ pattern that is not present.',
        'e4 e6 d4 d5 Nc3 Nf6 e5 Nfd7 Nf3 c5 Bd3 Nc6 Bf4 g6 O-O Bg7 Re1 O-O Qd2',
        14,
        {
          14: '…g6 prepares a fianchetto. Black has not castled behind the usual h7 shield; choose a development plan.',
          15: 'O-O secures your king without forcing a sacrifice.',
          16: '…Bg7 completes the fianchetto. Support the center with Re1.',
          17: 'Re1 develops the rook and keeps central play in mind.',
          18: '…O-O castles behind a different pawn structure. Qd2 coordinates your queen and bishop.',
          19: 'Qd2 completes the setup. Recognizing when not to sacrifice is part of learning the Greek Gift.',
        }
      ),
    ],
  },
  {
    id: 'legals-mate',
    title: 'Legal’s Mate',
    subtitle: 'Spot the queen trap — and respect good defenses.',
    goal: 'Recognize the mating pattern when the bishop takes your queen. If Black captures the knight or develops a defender, recover material or keep developing instead.',
    playerColor: 'w',
    warnings: {},
    branches: [
      branch(
        'queen-trap',
        'The queen bait is taken',
        '…Bxd1 allows the mating pattern',
        'After Black takes the queen, Bxf7+ and Nd5# finish the pattern. The mating net depends on Black’s undeveloped pieces and exact king position.',
        'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#',
        10,
        {
          6: '…Bg4 pins the knight to the queen. A pin can be broken tactically only when the follow-up works.',
          8: '…g6 does not develop a knight defender. Nxe5 offers the queen while creating a forcing threat.',
          9: 'Nxe5 removes the central pawn. Watch Black’s reply; taking the queen is not forced.',
          10: '…Bxd1 takes the bait. Check with Bxf7+ before trying to recover any material.',
          11: 'Bxf7+ forces the king into the mating net.',
          12: '…Ke7 is the reply. The c3 knight can deliver mate on d5.',
          13: 'Nd5# is checkmate. The pattern worked because the exact defensive conditions were present.',
        }
      ),
      branch(
        'knight-captured',
        'Black refuses the queen bait',
        '…dxe5 captures the knight',
        'When the pawn captures the knight, there is no mating sequence. Qxg4 recovers the bishop; do not play Bxf7+ by habit.',
        'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 dxe5 Qxg4',
        8,
        {
          8: '…g6 allows the tactical idea Nxe5, but Black can choose a sensible reply.',
          9: 'Nxe5 offers the queen. Your follow-up depends on which piece Black captures.',
          10: '…dxe5 takes the knight instead of the queen. The pinning bishop on g4 is now available to your queen.',
          11: 'Qxg4 recovers the bishop. You traded minor pieces and gained a pawn rather than delivering mate.',
        }
      ),
      branch(
        'knight-defense',
        'Black develops a defender on c6',
        '…Nc6 makes the automatic sacrifice unsafe',
        'A developed c6 knight changes the calculation. Challenge the pin with h3 and continue developing instead of copying the trap.',
        'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 Nc6 h3 Bh5 d3 Nf6 Be3 Be7 O-O O-O',
        8,
        {
          8: '…Nc6 adds a defender to e5. Do not copy Nxe5 from the trap line; play h3 and ask the bishop to decide.',
          9: 'h3 questions the pin while keeping your material.',
          10: '…Bh5 retains the bishop. Support e4 and open your other bishop with d3.',
          11: 'd3 supports the center.',
          12: '…Nf6 develops another defender. Continue your own development.',
          13: 'Be3 develops without a speculative sacrifice.',
          14: '…Be7 prepares castling. Secure your own king too.',
          15: 'O-O finishes king safety.',
          16: 'Black castles. The trap is gone; you have a normal, developed position.',
        }
      ),
      branch(
        'pin-exchanged',
        'Black develops …Nf6 and exchanges the pin',
        '…Bxf3 changes your recapture',
        'When Black develops and trades on f3, recapture with the queen and develop. Recognize a different position rather than chase a memorized mate.',
        'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 Nf6 h3 Bxf3 Qxf3 Be7 d3 O-O Be3',
        8,
        {
          8: '…Nf6 adds a developed piece. Ask the pinning bishop a question with h3 rather than force the trap.',
          9: 'h3 attacks the bishop and gives Black a choice.',
          10: '…Bxf3 exchanges the bishop for your knight. Recapture instead of looking for the mate pattern.',
          11: 'Qxf3 restores the material and places the queen actively.',
          12: '…Be7 prepares castling. Support e4 with d3.',
          13: 'd3 keeps the center secure.',
          14: 'Black castles. Complete development with Be3.',
          15: 'Be3 gives you a sound position. This branch teaches when the tactical pattern is no longer relevant.',
        }
      ),
    ],
  },
  {
    id: 'scholars-defense',
    title: 'Scholar’s Mate Defense',
    subtitle: 'Protect f7 while gaining time on the early queen.',
    goal: 'Notice the queen-and-bishop battery on f7. Block the queen’s attack before developing your knight, and adapt when White changes the move order or retreats the queen.',
    playerColor: 'b',
    warnings: {
      'e4 e5 Qh5 Nc6 Bc4': {
        Nf6: 'Developing …Nf6 here does not stop Qxf7#. First block the queen’s diagonal with …g6.',
      },
    },
    branches: [
      branch(
        'queen-first',
        'The queen comes out first',
        'Qh5, Bc4 and Qf3 keep targeting f7',
        'Defend e5 with …Nc6, meet the battery with …g6, then develop …Nf6 when it blocks the renewed attack from f3.',
        'e4 e5 Qh5 Nc6 Bc4 g6 Qf3 Nf6 Ne2 Bg7 d3 O-O',
        3,
        {
          1: 'White claims the center. Meet it with …e5.',
          3: 'Qh5 attacks e5 and eyes f7. Defend the central pawn with …Nc6.',
          4: '…Nc6 protects e5 without making a weakening pawn move.',
          5: 'Bc4 adds a second attacker to f7. Stop the immediate mate threat before normal development.',
          6: '…g6 blocks the queen’s diagonal and attacks the queen.',
          7: 'Qf3 renews the attack along the f-file. Now …Nf6 both develops and blocks that file.',
          8: '…Nf6 closes the queen’s route to f7.',
          9: 'Ne2 develops quietly. Finish your kingside development with …Bg7.',
          10: '…Bg7 prepares castling.',
          11: 'd3 supports the center. Castle and leave the early-mate threat behind.',
          12: '…O-O completes a safe defense. You gained development while White moved the queen repeatedly.',
        }
      ),
      branch(
        'bishop-first',
        'The bishop comes out first',
        'Bc4 before Qh5 reaches the same threat',
        'The order of White’s queen and bishop moves can change. Recognize the f7 threat by the position, not by the move number.',
        'e4 e5 Bc4 Nc6 Qh5 g6 Qf3 Nf6 Ne2 Bg7 d3 O-O',
        5,
        {
          3: 'Bc4 points at f7, but there is not yet a queen battery. Develop …Nc6.',
          5: 'Qh5 completes the battery in a different order. The correct defensive idea is still …g6.',
          6: '…g6 gains time on the queen and blocks the threat.',
          7: 'Qf3 attacks f7 again. Develop the knight to block that file.',
          8: '…Nf6 protects the king while developing.',
          9: 'White develops Ne2. Bring your bishop to g7.',
          10: '…Bg7 prepares castling.',
          11: 'White plays d3. Castle to complete your defense.',
          12: '…O-O reaches the same safe structure by a different move order.',
        }
      ),
      branch(
        'queen-retreats',
        'The queen retreats to h4',
        'Qh4 gives you time to develop',
        'After …g6, a queen retreat to h4 changes the attack. Develop calmly; there is no need to keep chasing the queen with pawns.',
        'e4 e5 Qh5 Nc6 Bc4 g6 Qh4 Nf6 Ne2 Bg7 d3 O-O',
        5,
        {
          3: 'Qh5 attacks e5. …Nc6 defends the pawn.',
          5: 'Bc4 threatens Qxf7#. Block the diagonal with …g6.',
          6: '…g6 attacks the queen.',
          7: 'Qh4 retreats without renewing a direct f-file threat. Develop …Nf6 rather than overextend your pawns.',
          8: '…Nf6 develops toward the center.',
          9: 'Ne2 continues development. Put the bishop on g7.',
          10: '…Bg7 prepares king safety.',
          11: 'd3 supports White’s center. Castle instead of launching an unnecessary queen chase.',
          12: '…O-O completes development. The early queen attack has not stopped your normal plan.',
        }
      ),
      branch(
        'queen-f3',
        'White uses the f3 move order',
        'Qf3 and Bc4 need a different block',
        'Against Qf3, …Nf6 blocks the f-file directly. Do not spend a tempo on …g6 when the queen is not on h5.',
        'e4 e5 Qf3 Nc6 Bc4 Nf6 Ne2 Bc5 c3 O-O',
        3,
        {
          3: 'Qf3 develops the queen early. Defend the central pawn with …Nc6.',
          5: 'Bc4 creates pressure on f7 along the f-file. Here …Nf6 blocks the queen’s line directly.',
          6: '…Nf6 develops and stops Qxf7 by occupying f6.',
          7: 'Ne2 develops. Put your bishop on an active diagonal with …Bc5.',
          8: '…Bc5 develops while the f7 threat is contained.',
          9: 'c3 prepares central play. Castle and be ready to meet d4.',
          10: '…O-O secures the king. You adapted the defense to the queen’s actual square.',
        }
      ),
    ],
  },
];
