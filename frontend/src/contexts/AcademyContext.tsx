"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';

export interface AcademyProgressState {
  completedLessons: string[];
  passedQuizzes: string[];
}

interface AcademyContextType {
  completedLessons: string[];
  passedQuizzes: string[];
  isLessonComplete: (lessonSlug: string) => boolean;
  isQuizPassed: (lessonSlug: string) => boolean;
  completeLesson: (lessonSlug: string, quizPassed?: boolean) => void;
  passQuiz: (lessonSlug: string) => void;
  resetProgress: () => void;
}

const AcademyContext = createContext<AcademyContextType | undefined>(undefined);

const STORAGE_KEY = 'eshopping-academy-progress-v1';

function loadInitial(): AcademyProgressState {
  if (typeof window === 'undefined') {
    return { completedLessons: [], passedQuizzes: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        completedLessons: Array.isArray(parsed.completedLessons) ? parsed.completedLessons : [],
        passedQuizzes: Array.isArray(parsed.passedQuizzes) ? parsed.passedQuizzes : [],
      };
    }
  } catch {}
  return { completedLessons: [], passedQuizzes: [] };
}

export function AcademyProvider({ children }: { children: ReactNode }) {
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [passedQuizzes, setPassedQuizzes] = useState<string[]>([]);

  useEffect(() => {
    const initial = loadInitial();
    setCompletedLessons(initial.completedLessons);
    setPassedQuizzes(initial.passedQuizzes);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ completedLessons, passedQuizzes }),
      );
    } catch {}
  }, [completedLessons, passedQuizzes]);

  const isLessonComplete = useCallback(
    (lessonSlug: string) => completedLessons.includes(lessonSlug),
    [completedLessons],
  );

  const isQuizPassed = useCallback(
    (lessonSlug: string) => passedQuizzes.includes(lessonSlug),
    [passedQuizzes],
  );

  const completeLesson = useCallback((lessonSlug: string, quizPassed?: boolean) => {
    setCompletedLessons((prev) =>
      prev.includes(lessonSlug) ? prev : [...prev, lessonSlug],
    );
    if (quizPassed) {
      setPassedQuizzes((prev) =>
        prev.includes(lessonSlug) ? prev : [...prev, lessonSlug],
      );
    }
  }, []);

  const passQuiz = useCallback((lessonSlug: string) => {
    setPassedQuizzes((prev) =>
      prev.includes(lessonSlug) ? prev : [...prev, lessonSlug],
    );
  }, []);

  const resetProgress = useCallback(() => {
    setCompletedLessons([]);
    setPassedQuizzes([]);
  }, []);

  return (
    <AcademyContext.Provider
      value={useMemo(
        () => ({
          completedLessons,
          passedQuizzes,
          isLessonComplete,
          isQuizPassed,
          completeLesson,
          passQuiz,
          resetProgress,
        }),
        [
          completedLessons,
          passedQuizzes,
          isLessonComplete,
          isQuizPassed,
          completeLesson,
          passQuiz,
          resetProgress,
        ],
      )}
    >
      {children}
    </AcademyContext.Provider>
  );
}

export function useAcademy(): AcademyContextType {
  const ctx = useContext(AcademyContext);
  if (!ctx) throw new Error('useAcademy must be used within an <AcademyProvider>');
  return ctx;
}
