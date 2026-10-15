"use client";

import { useState } from 'react';
import { Check, X, Lightbulb } from 'lucide-react';
import type { AcademyQuiz } from '../../data/academy';

interface AcademyQuizProps {
  quiz: AcademyQuiz;
  passed: boolean;
  onPass: () => void;
}

export default function AcademyQuiz({ quiz, passed, onPass }: AcademyQuizProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(passed);

  const handleSelect = (index: number) => {
    if (answered) return;
    setSelected(index);
    setAnswered(true);
    if (index === quiz.correctIndex) onPass();
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center gap-2">
        <Lightbulb size={16} className="text-accent" />
        <h4 className="font-semibold text-sm">Verifica o que aprendeste</h4>
      </div>

      <div className="p-4">
        <p className="font-medium mb-3">{quiz.question}</p>
        <div className="space-y-2">
          {quiz.options.map((option, index) => {
            const isCorrect = index === quiz.correctIndex;
            const isSelected = selected === index;
            const showCorrect = answered && isCorrect;
            const showWrong = answered && isSelected && !isCorrect;

            return (
              <button
                key={index}
                onClick={() => handleSelect(index)}
                disabled={answered}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  showCorrect
                    ? 'border-green-600 bg-green-600/10 text-green-700'
                    : showWrong
                      ? 'border-red-500 bg-red-500/10 text-red-600'
                      : 'border-border hover:border-accent hover:bg-muted/50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="flex-shrink-0">
                    {showCorrect ? (
                      <Check size={16} />
                    ) : showWrong ? (
                      <X size={16} />
                    ) : (
                      <span className="inline-flex w-4 h-4 border border-border rounded-full" />
                    )}
                  </span>
                  {option}
                </span>
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="mt-4 text-sm bg-muted/40 border border-border rounded-lg px-3 py-2.5 flex gap-2">
            <Lightbulb size={16} className="text-accent flex-shrink-0 mt-0.5" />
            <p className="text-muted-foreground">{quiz.explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
