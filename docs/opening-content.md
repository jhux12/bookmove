# Opening repertoire content

The repertoire contains 119 distinct study sequences across eight courses (previously 48):

| Course | Lines |
|---|---:|
| Italian Game | 24 |
| London System | 14 |
| Sicilian Defense | 15 |
| Ruy Lopez | 14 |
| Queen's Gambit | 14 |
| Caro-Kann | 13 |
| King's Indian | 13 |
| French Defense | 12 |

The additional named branches were selected from the public [Lichess opening database](https://github.com/lichess-org/chess-openings), accessed at upstream HEAD `3ba6b20d31b2e6125cb0e6a2e792f400717d9d39`. The database is CC0; its license is included in `lichess-openings-CC0.txt`. New London study sequences and the teaching notes are original to this project. Existing course IDs and progress IDs are retained. One exact duplicate was excluded when expanding the original catalog.

The selections broaden common responses and named structures rather than importing thousands of database rows. Each line is replayed from the starting position by the automated curriculum test; duplicate move sequences and IDs are rejected. This establishes legality and distinctness, not an engine proof that every move is best. These are study examples, not claims of a forced win or a complete tournament repertoire. Future additions should include an original strategic goal and a meaningful stopping position, and pass the same tests.

Depth is cumulative: Essentials contains the first lesson and foundational lines; Advanced adds club lines; Full Repertoire includes master lines as well. Counts come from actual course data. Changing depth does not delete progress or change access. Depth preferences are stored per course in the browser.

The supplied Chessreps screenshots inspired the optional depth chooser and the board-first desktop layout. Live Chessreps, Chessable and Lichess website pages could not be reviewed because the cloud environment returned HTTP 403 for those hosts. No course prose or artwork was copied from those sites.
