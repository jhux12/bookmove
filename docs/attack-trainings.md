# Standalone branching trainings

The Attacks tab contains five independent trainings: Fried Liver Attack, Evans Gambit, Greek Gift, Legal’s Mate, and Scholar’s Mate Defense. Each has four modeled opponent-response paths. These are curated exercises, not a claim that all possible legal defenses are covered or that every attack forces a win.

## Learning behavior

A guided lesson follows the response selected in the overview. Every learner move is played on the board; only opponent moves advance automatically. Coach notes explain the actual reply and the plan that follows. For example, Fried Liver training distinguishes …Nxd5 (Nxf7), …Na5 (Bb5+), …Nd4 (c3), and the Traxler (Bxf7+). The Greek Gift also teaches keeping the bishop when the sacrifice is declined and choosing a different plan against …g6.

Mixed tests use all response paths without disclosing the target in the heading. The scheduler prioritizes unpassed responses and then the least-practiced response; it avoids repeating the previous response when another is available. The prefix tree validates the position and accepts the modeled learner continuations that match the actual moves already played. Opponent replies follow the scheduled path; the next reply is not shown in advance.

Legal moves outside the exercise are rejected with wording that distinguishes exercise scope from chess legality. A specific Scholar’s Mate warning explains why …Nf6 fails before …g6 in the queen-on-h5 position. Hint or opening the response guide counts as help. Mistakes or help prevent a clean test pass. Guided completion and recall-test completion are recorded separately. Passing all four response paths is required for full test coverage.

## Progress and reuse

Progress is stored per training and response in `checkmate_attack_training_progress_v1`. Switching modes, navigating away, or reloading keeps completed progress. Current unfinished test attempts restart; they do not earn credit. There is no new claim of live cloud sync for the standalone training collection.

An unassisted, mistake-free test also credits existing opening lines only when the complete existing line is a prefix of the moves the learner actually completed from the starting position. Guided walkthroughs and partial bot setups do not award opening recall credit. Existing opening IDs are preserved.

Each response supplies a legal bot-practice starting point on the learner’s turn, before the attack’s key decision. This avoids starting a bot game from an already checkmated board. Starting bot practice requires explicit confirmation before replacing an unfinished saved game. In-flight opponent responses are canceled when a lesson changes, and stale bot computations are invalidated when a new sparring seed arrives.

## Validation

`npm test` replays every response legally, checks prefix-tree transitions, verifies practice positions and independent progress rules, and confirms Legal’s Mate and the warned Scholar’s Mate continuation are checkmate.

The browser suite plays every mixed response path, checks wrong-move/hint behavior, verifies guided progress survives refresh, checks mobile layout and the coach portrait, and exercises bot-practice handoff and saved-game protection. Run `npm run test:browser` for the complete browser suite.
