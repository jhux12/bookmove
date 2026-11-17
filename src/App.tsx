/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { CoursesView } from './components/CoursesView';
import { CustomizeView } from './components/CustomizeView';
import { MembershipView } from './components/MembershipView';
import { PlayBotsView } from './components/PlayBotsView';
import { PracticeView } from './components/PracticeView';
import { useAuth } from './context/AuthContext';
import { DEFAULT_PREFERENCES } from './data/themes';
import {
  ActiveTab,
  ArchivedGame,
  CustomLineSeed,
  SparringSeed,
  UserPreferences,
} from './types/chess';
import { soundEngine } from './utils/sound';

const PREFS_STORAGE_KEY = 'checkmate_preferences_v2';
const ARCHIVE_STORAGE_KEY = 'checkmate_archive_v1';

function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function loadArchive(): ArchivedGame[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const {
    user,
    effectiveTier,
    cloudGames,
    remotePreferences,
    signInWithGoogle,
    syncPreferences,
    saveArchivedGameCloud,
    deleteArchivedGameCloud,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>('courses');
  const [preferences, setPreferences] = useState<UserPreferences>(loadPreferences);
  const [localArchivedGames, setLocalArchivedGames] = useState<ArchivedGame[]>(loadArchive);
  const [newGameTrigger, setNewGameTrigger] = useState(0);
  const [sparringSeed, setSparringSeed] = useState<SparringSeed | null>(null);
  const [courseFocus, setCourseFocus] = useState<{
    courseId: string;
    variationId: string;
    nonce: number;
  } | null>(null);
  const [customBuilderSeed, setCustomBuilderSeed] = useState<{
    data: CustomLineSeed;
    nonce: number;
  } | null>(null);

  // Apply synced preferences from Firestore on sign-in
  useEffect(() => {
    if (remotePreferences) {
      setPreferences(remotePreferences);
    }
  }, [remotePreferences]);

  useEffect(() => {
    soundEngine.setEnabled(preferences.soundEnabled);
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore storage quota errors
    }
  }, [preferences]);

  useEffect(() => {
    if (user) return;
    try {
      localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(localArchivedGames));
    } catch {
      // Ignore storage quota errors
    }
  }, [localArchivedGames, user]);

  const handleUpdatePreferences = useCallback(
    (next: UserPreferences) => {
      setPreferences(next);
      if (user) {
        void syncPreferences(next);
      }
    },
    [user, syncPreferences]
  );

  const displayedGames = user && cloudGames !== null ? cloudGames : localArchivedGames;

  const handleSaveGame = useCallback(
    (game: ArchivedGame) => {
      setLocalArchivedGames((prev) => {
        if (prev.some((g) => g.id === game.id)) return prev;
        return [game, ...prev].slice(0, 100);
      });
      if (user) {
        void saveArchivedGameCloud(game);
      }
    },
    [user, saveArchivedGameCloud]
  );

  const handleDeleteGame = useCallback(
    (id: string) => {
      setLocalArchivedGames((prev) => prev.filter((g) => g.id !== id));
      if (user) {
        void deleteArchivedGameCloud(id);
      }
    },
    [user, deleteArchivedGameCloud]
  );

  const handleClearArchive = useCallback(() => {
    if (user && cloudGames) {
      for (const g of cloudGames) {
        void deleteArchivedGameCloud(g.id);
      }
    }
    setLocalArchivedGames([]);
  }, [user, cloudGames, deleteArchivedGameCloud]);

  const handleSparLine = useCallback((seed: SparringSeed) => {
    setSparringSeed(seed);
    setActiveTab('play');
  }, []);

  const handleOpenMembership = useCallback(() => {
    setActiveTab('membership');
  }, []);

  const handleDrillRepertoireLine = useCallback((courseId: string, variationId: string) => {
    setCourseFocus({ courseId, variationId, nonce: Date.now() });
    setActiveTab('courses');
  }, []);

  const handleSaveCustomPrep = useCallback((seed: CustomLineSeed) => {
    setCustomBuilderSeed({ data: seed, nonce: Date.now() });
    setActiveTab('courses');
  }, []);

  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'courses', label: 'Courses' },
    { id: 'practice', label: 'Practice' },
    { id: 'play', label: 'Play Bots' },
    { id: 'customize', label: 'Customize' },
    { id: 'membership', label: 'Membership' },
  ];

  const primaryCtaLabel = !user
    ? 'Sign In'
    : effectiveTier === 'pro'
    ? 'Checkmate Pro'
    : 'Unlock Pro';

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#0E131B] text-[#F1F5F9] flex flex-col">
        {/* Top Bar Contract: Brand wordmark — 5 nav links — 1 primary action */}
        <header className="border-b border-slate-400/10 bg-[#0A0E14]/95 backdrop-blur-md">
          <div className="max-w-[1240px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
            <button
              type="button"
              onClick={() => setActiveTab('courses')}
              className="font-display text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              Checkmate
            </button>

            <nav className="flex items-center gap-4 sm:gap-7 overflow-x-auto">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`py-1 text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                      isActive
                        ? 'text-white border-[#E5A93C]'
                        : 'text-slate-400 border-transparent hover:text-white hover:border-slate-400/35'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={() => {
                if (!user) {
                  void signInWithGoogle();
                } else {
                  setActiveTab('membership');
                }
              }}
              className="px-4 py-1.5 rounded-lg bg-[#E5A93C] hover:bg-[#F0B952] text-[#0E131B] font-display font-bold text-xs tracking-tight transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {primaryCtaLabel}
            </button>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1">
          <div className={activeTab === 'play' ? 'block' : 'hidden'}>
            <PlayBotsView
              preferences={preferences}
              onToggleSound={() =>
                handleUpdatePreferences({
                  ...preferences,
                  soundEnabled: !preferences.soundEnabled,
                })
              }
              archivedGames={displayedGames}
              onSaveGame={handleSaveGame}
              onDeleteGame={handleDeleteGame}
              onClearAllGames={handleClearArchive}
              newGameTrigger={newGameTrigger}
              sparringSeed={sparringSeed}
              onClearSparringSeed={() => {
                setSparringSeed(null);
                setNewGameTrigger((n) => n + 1);
              }}
              onDrillRepertoireLine={handleDrillRepertoireLine}
              onSaveCustomPrep={handleSaveCustomPrep}
            />
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'courses' && (
              <motion.div
                key="tab-courses"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <CoursesView
                  preferences={preferences}
                  onSparLine={handleSparLine}
                  onOpenMembership={handleOpenMembership}
                  focusTarget={courseFocus}
                  customSeed={customBuilderSeed}
                />
              </motion.div>
            )}

            {activeTab === 'practice' && (
              <motion.div
                key="tab-practice"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <PracticeView
                  preferences={preferences}
                  onGoToCourses={() => setActiveTab('courses')}
                />
              </motion.div>
            )}

            {activeTab === 'customize' && (
              <motion.div
                key="tab-customize"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <CustomizeView
                  preferences={preferences}
                  onUpdatePreferences={handleUpdatePreferences}
                />
              </motion.div>
            )}

            {activeTab === 'membership' && (
              <motion.div
                key="tab-membership"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              >
                <MembershipView onBrowseCourses={() => setActiveTab('courses')} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </MotionConfig>
  );
}
