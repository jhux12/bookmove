import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Lightbulb,
  List,
  RotateCcw,
  Shuffle,
  Swords,
} from 'lucide-react';
import { ATTACK_TRAININGS, AttackTraining, TrainingBranch } from '../data/attackTrainings';
import { BOARD_THEMES } from '../data/themes';
import { OPENING_COURSES } from '../data/openingCourses';
import { useAuth } from '../context/AuthContext';
import { BoardArrow, PieceType, SparringSeed, UserPreferences } from '../types/chess';
import {
  branchesAtPosition,
  chooseOpponentStep,
  completedTrainingBranch,
  gameFromTraining,
  trainingChoices,
  trainingPracticeSeed,
} from '../utils/trainingTree';
import {
  chooseTrainingResponse,
  mergeTrainingProgress,
  readTrainingProgress,
  recordTrainingResponse,
  TRAINING_PROGRESS_KEY,
  TrainingProgress,
} from '../utils/trainingProgress';
import { soundEngine } from '../utils/sound';
import { ChessBoard } from './ChessBoard';
import { CoachBoardStage } from './CoachBoardStage';
import { Modal } from './ui/Modal';
import { ResultOverlayModal } from './ResultOverlayModal';

export function AttackTrainingView({
  preferences,
  onSparLine,
}: {
  preferences: UserPreferences;
  onSparLine: (seed: SparringSeed) => void;
}) {
  const { recordLinePractice } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'learn' | 'test' | null>(null);
  const [targetId, setTargetId] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [usedHint, setUsedHint] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [wrong, setWrong] = useState(false);
  const [progress, setProgress] = useState<TrainingProgress>(readTrainingProgress);
  const [storageError, setStorageError] = useState(false);
  const [showResponses, setShowResponses] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const completionSaved = useRef(false);
  const training = ATTACK_TRAININGS.find((t) => t.id === selectedId) ?? null;
  const target = training?.branches.find((b) => b.id === targetId) ?? training?.branches[0];
  const available = useMemo(
    () => (training ? (mode === 'learn' && target ? [target] : training.branches) : []),
    [training, mode, target]
  );
  const game = useMemo(() => gameFromTraining(history), [history]);
  const choices = useMemo(() => trainingChoices(available, history), [available, history]);
  const complete = useMemo(() => completedTrainingBranch(available, history), [available, history]);
  const isPlayer = training && game.turn() === training.playerColor;
  const playedBranches = branchesAtPosition(available, history);

  useEffect(() => {
    const update = () => setProgress(readTrainingProgress());
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);

  const start = (t: AttackTraining, b: TrainingBranch, nextMode: 'learn' | 'test') => {
    completionSaved.current = false;
    setSelectedId(t.id);
    setTargetId(b.id);
    setMode(nextMode);
    setHistory([]);
    setMistakes(0);
    setUsedHint(false);
    setHintVisible(false);
    setWrong(false);
    setShowResult(false);
    setShowResponses(false);
    setMessage(
      nextMode === 'learn'
        ? t.goal
        : `Play as ${t.playerColor === 'w' ? 'White' : 'Black'}. Read the opponent’s moves and adapt. The next response is hidden; hints count as help.`
    );
  };
  const startMixed = (t: AttackTraining) =>
    start(t, chooseTrainingResponse(t, progress, targetId), 'test');

  // Only the opponent advances automatically. The learner must make every one
  // of their own moves; changing an exercise cancels its pending response.
  useEffect(() => {
    if (!training || !mode || complete || isPlayer || showResponses) return;
    const step = chooseOpponentStep(available, history, targetId);
    if (!step) return;
    const timer = window.setTimeout(() => {
      setHistory([...history, step.san]);
      setMessage(step.note);
      setWrong(false);
      setHintVisible(false);
      if (step.san.includes('+') || step.san.includes('#')) soundEngine.playCheck();
      else soundEngine.playMove();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [training, mode, complete, isPlayer, available, history, targetId, showResponses]);

  useEffect(() => {
    if (!training || !mode || !complete || completionSaved.current) return;
    completionSaved.current = true;
    const merged = mergeTrainingProgress(progress, readTrainingProgress());
    const next = recordTrainingResponse(merged, training.id, complete.id, mode, mistakes, usedHint);
    setProgress(next);
    try {
      localStorage.setItem(TRAINING_PROGRESS_KEY, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
    // Share credit only for fully covered existing course lines after an
    // unassisted test. A partial setup or a guided walkthrough earns no recall credit.
    if (mode === 'test' && mistakes === 0 && !usedHint) {
      for (const course of OPENING_COURSES)
        for (const line of course.variations) {
          if (
            line.steps.length <= history.length &&
            line.steps.every((s, i) => s.san === history[i])
          )
            void recordLinePractice(course.id, line.id, 0);
        }
    }
    setShowResult(true);
  }, [complete, training, mode, mistakes, usedHint, history, progress, recordLinePractice]);

  const showHint = () => {
    if (mode === 'test') setUsedHint(true);
    setHintVisible(true);
    setMessage(
      choices[0] ? `Try ${choices[0].san}. ${choices[0].note}` : 'This response is complete.'
    );
  };
  const arrows = useMemo(() => {
    if (!choices[0] || !isPlayer || complete || !(mode === 'learn' || hintVisible)) return [];
    const position = new Chess(game.fen());
    const move = position.move(choices[0].san);
    return [{ from: move.from, to: move.to, color: '#E5A93C' }] as BoardArrow[];
  }, [choices, isPlayer, complete, mode, hintVisible, game]);
  const move = (from: string, to: string, promotion?: PieceType) => {
    if (!training || !mode || !isPlayer || complete) return false;
    let played;
    try {
      played = new Chess(game.fen()).move({ from, to, promotion: promotion ?? 'q' });
    } catch {
      return false;
    }
    if (!choices.some((s) => s.san === played.san)) {
      setMistakes((n) => n + 1);
      setWrong(true);
      setMessage(
        training.warnings[history.join(' ')]?.[played.san] ??
          `That move is legal, but it is outside this lesson’s response plans. ${mode === 'learn' ? `Try ${choices[0]?.san}. ${choices[0]?.note}` : 'Recheck the opponent’s threat, or use Hint for an explanation.'}`
      );
      return false;
    }
    const step = choices.find((s) => s.san === played.san)!;
    setHistory([...history, played.san]);
    setMessage(step.note);
    setWrong(false);
    setHintVisible(false);
    if (played.san.includes('+') || played.san.includes('#')) soundEngine.playCheck();
    else if (played.captured) soundEngine.playCapture();
    else soundEngine.playMove();
    return true;
  };
  const practice = (t: AttackTraining, b: TrainingBranch) => onSparLine(trainingPracticeSeed(t, b));
  const score = (t: AttackTraining) =>
    t.branches.filter((b) => progress[t.id]?.[b.id]?.tested).length;

  if (!training)
    return (
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-7 space-y-6">
        <header>
          <p className="text-xs uppercase tracking-widest text-[#E5A93C]">Attacks & defenses</p>
          <h1 className="mt-2 text-2xl font-bold">Learn the idea. Read the response.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
            Five standalone trainings. Learn the main idea, meet different opponent moves, then test
            yourself without knowing which response is coming.
          </p>
        </header>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ATTACK_TRAININGS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-label={`Open ${t.title} training`}
              onClick={() => {
                setSelectedId(t.id);
                setMode(null);
              }}
              className="group text-left rounded-2xl border border-slate-400/12 hover:border-[#E5A93C]/50 bg-[#161E29] p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <Swords size={20} className="text-[#E5A93C]" />
                <span className="text-xs text-slate-400">
                  Play as {t.playerColor === 'w' ? 'White' : 'Black'}
                </span>
              </div>
              <div>
                <h2 className="font-bold text-lg">{t.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{t.subtitle}</p>
              </div>
              <div className="pt-3 border-t border-slate-400/10 text-xs flex justify-between text-slate-400">
                <span>{t.branches.length} opponent responses</span>
                <span className="text-[#E5A93C]">
                  {score(t)} / {t.branches.length} tested
                </span>
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Guided lessons teach the plan. Mixed tests require your own moves; hints and mistakes do
          not count as a clean test. Training progress saves in this browser.
        </p>
      </div>
    );

  if (!mode)
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <button
          onClick={() => setSelectedId(null)}
          className="min-h-11 inline-flex items-center gap-2 text-sm text-slate-400"
        >
          <ArrowLeft size={16} />
          All attack trainings
        </button>
        <header>
          <h1 className="text-2xl font-bold">{training.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{training.goal}</p>
        </header>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => start(training, training.branches[0], 'learn')}
            className="min-h-12 px-5 rounded-xl bg-[#E5A93C] text-slate-950 font-bold inline-flex items-center gap-2"
          >
            <BookOpen size={17} />
            Start guided lesson
          </button>
          <button
            onClick={() => startMixed(training)}
            className="min-h-12 px-5 rounded-xl border border-slate-400/20 text-sm font-semibold inline-flex items-center gap-2"
          >
            <Shuffle size={17} />
            Mixed response test
          </button>
        </div>
        <section aria-label="Opponent responses" className="space-y-3">
          <h2 className="font-semibold">What if the opponent plays differently?</h2>
          {training.branches.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border border-slate-400/12 bg-[#161E29] p-4 space-y-3"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-sm">{b.name}</h3>
                  <p className="mt-1 text-xs text-slate-400">{b.opponentChoice}</p>
                </div>
                <span className="shrink-0 text-xs text-[#2EB88A]">
                  {progress[training.id]?.[b.id]?.tested
                    ? 'Test passed'
                    : progress[training.id]?.[b.id]?.guided
                      ? 'Guided complete'
                      : ''}
                </span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">{b.lesson}</p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => start(training, b, 'learn')}
                  className="min-h-10 text-xs font-semibold text-[#E5A93C]"
                >
                  Learn this response
                </button>
                <button
                  onClick={() => practice(training, b)}
                  className="min-h-10 text-xs text-slate-300"
                >
                  Practice position vs bot
                </button>
              </div>
            </div>
          ))}
        </section>
        <p className="text-xs text-slate-500">
          {score(training)} of {training.branches.length} responses passed without help. Your
          progress is kept when you switch trainings.
        </p>
      </div>
    );

  const branch =
    complete ?? playedBranches.find((b) => b.id === targetId) ?? playedBranches[0] ?? target!;
  const denominator = Math.max(history.length, ...playedBranches.map((b) => b.steps.length));
  const lastGame = gameFromTraining(history);
  const last = lastGame.history({ verbose: true }).at(-1);
  return (
    <>
      <CoachBoardStage
        title={training.title}
        onBack={() => {
          setMode(null);
          setShowResult(false);
        }}
        backLabel="Training overview"
        subHeader={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`px-3 py-2 rounded-lg ${mode === 'test' ? 'bg-[#222C3A] text-[#E5A93C]' : 'bg-[#222C3A] text-slate-200'}`}
            >
              {mode === 'learn' ? 'Guided lesson' : 'Mixed response test'}
            </span>
            <span className="text-slate-400">
              You play {training.playerColor === 'w' ? 'White' : 'Black'}
            </span>
          </div>
        }
        barMode="progress"
        barPct={(100 * history.length) / Math.max(1, denominator)}
        barLeftLabel={`Move ${history.length}`}
        barRightLabel={
          mode === 'test'
            ? `${mistakes} mistakes${usedHint ? ' · Help used' : ''}`
            : `Response ${training.branches.findIndex((b) => b.id === branch.id) + 1} / ${training.branches.length}`
        }
        badgeColor={wrong ? '#EB6150' : complete ? '#2EB88A' : '#E5A93C'}
        badgeContent={complete ? <Check size={12} /> : <BookOpen size={12} />}
        headline={
          complete
            ? branch.name
            : wrong
              ? 'Recheck the position'
              : mode === 'learn'
                ? branch.name
                : isPlayer
                  ? 'Your response'
                  : 'Opponent’s move'
        }
        chipText={mode === 'test' ? 'Test' : 'Learn'}
        comment={
          complete
            ? `${branch.lesson} ${mode === 'test' ? (mistakes === 0 && !usedHint ? 'Clean test passed.' : 'Completed with help or mistakes. Try again for a clean pass.') : 'Guided response complete. Try a mixed test to recall it yourself.'}`
            : message
        }
        bubbleActions={
          <span className="text-xs">
            {complete
              ? 'Response complete'
              : isPlayer
                ? mode === 'learn'
                  ? `Follow the guide: ${choices[0]?.san}`
                  : 'Read the position. No guide arrows unless you ask for a hint.'
                : 'Watch the opponent’s reply, then choose your plan.'}
          </span>
        }
        board={
          <ChessBoard
            fen={game.fen()}
            orientation={training.playerColor}
            allowedColor={training.playerColor}
            interactive={Boolean(isPlayer && !complete)}
            boardTheme={BOARD_THEMES[preferences.boardTheme]}
            pieceSet={preferences.pieceSet}
            coordinates={preferences.coordinates}
            showLegalMoves={preferences.showLegalMoves}
            animationSpeed={preferences.animationSpeed}
            extraArrows={arrows}
            lastMove={last ? { from: last.from, to: last.to } : null}
            onMove={move}
          />
        }
        ribbon={
          <div
            className="h-11 flex items-center gap-2 overflow-x-auto rounded-xl border border-slate-400/12 bg-[#161E29] px-3 font-mono text-xs text-slate-400"
            aria-label="Moves played"
          >
            {history.length ? (
              history.map((san, i) => (
                <span key={i} className="shrink-0">
                  {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ''}
                  {san}
                </span>
              ))
            ) : (
              <span>
                Starting position ·{' '}
                {mode === 'test' ? 'Opponent responses are mixed' : 'Play your moves on the board'}
              </span>
            )}
          </div>
        }
        bottomActions={[
          {
            id: 'responses',
            label: 'Responses',
            icon: <List size={16} />,
            onClick: () => {
              if (mode === 'test' && !complete) setUsedHint(true);
              setShowResponses(true);
            },
          },
          {
            id: 'hint',
            label: 'Hint',
            icon: <Lightbulb size={16} />,
            onClick: showHint,
            disabled: Boolean(complete || !isPlayer),
          },
          {
            id: 'restart',
            label: 'Restart',
            icon: <RotateCcw size={16} />,
            onClick: () => start(training, target!, mode),
          },
          {
            id: 'next',
            label: complete ? 'Next response' : mode === 'learn' ? 'Mixed test' : 'Bot practice',
            icon: <Swords size={16} />,
            primary: true,
            onClick: () =>
              complete
                ? start(training, chooseTrainingResponse(training, progress, branch.id), mode)
                : mode === 'learn'
                  ? startMixed(training)
                  : practice(training, branch),
          },
        ]}
      />
      {storageError && (
        <p role="alert" className="mx-auto max-w-3xl p-4 text-sm text-amber-200">
          Progress is available in this tab, but browser storage could not save it. Keep this tab
          open.
        </p>
      )}
      {showResponses && (
        <Modal label="Training responses" onClose={() => setShowResponses(false)}>
          <div className="p-5 space-y-4">
            <h2 className="text-lg font-bold">{training.title}: opponent responses</h2>
            {mode === 'test' && !complete && (
              <p className="text-xs text-amber-200">
                Opening this guide counts as help for the current test.
              </p>
            )}
            {training.branches.map((b) => (
              <div key={b.id} className="border-t border-slate-400/10 pt-3">
                <h3 className="text-sm font-semibold">{b.name}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{b.lesson}</p>
                <button
                  onClick={() => start(training, b, 'learn')}
                  className="min-h-10 text-xs text-[#E5A93C]"
                >
                  Learn this response
                </button>
              </div>
            ))}
            <button onClick={() => setShowResponses(false)} className="min-h-11 w-full text-sm">
              Back to training
            </button>
          </div>
        </Modal>
      )}
      <ResultOverlayModal
        open={showResult}
        variant={mode === 'test' && mistakes === 0 && !usedHint ? 'puzzle' : 'draw'}
        title={
          mode === 'learn'
            ? 'Response learned'
            : mistakes === 0 && !usedHint
              ? 'Clean test passed'
              : 'Response completed'
        }
        subtitle={branch.name}
        details={
          mode === 'learn'
            ? 'Now practice recognizing the opponent’s choices.'
            : `${mistakes} mistakes · ${usedHint ? 'Help used — retry for a clean pass' : 'No hints used'}`
        }
        primaryLabel={mode === 'learn' ? 'Try mixed test' : 'Next response'}
        onPrimary={() =>
          mode === 'learn'
            ? startMixed(training)
            : start(training, chooseTrainingResponse(training, progress, branch.id), 'test')
        }
        secondaryLabel="Practice vs bot"
        onSecondary={() => practice(training, branch)}
        onClose={() => setShowResult(false)}
      />
    </>
  );
}
