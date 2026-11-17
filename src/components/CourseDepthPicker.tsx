import { useState } from 'react';
import { OpeningCourse } from '../types/chess';
import { CourseDepth, getDepthLines } from '../data/openingCurriculum';
import { Modal } from './ui/Modal';

export function CourseDepthPicker({
  course,
  initialDepth,
  onSelect,
  onClose,
  previewOnly,
}: {
  course: OpeningCourse;
  initialDepth: CourseDepth;
  onSelect: (depth: CourseDepth) => void;
  onClose: () => void;
  previewOnly: boolean;
}) {
  const [depth, setDepth] = useState<CourseDepth>(initialDepth);
  const options = [
    {
      id: 'essentials',
      name: 'Essentials',
      description: 'Start here. Core structures and first responses.',
    },
    {
      id: 'advanced',
      name: 'Advanced',
      description: 'Add sidelines and more demanding positions.',
    },
    { id: 'full', name: 'Full Repertoire', description: 'Explore every available study line.' },
  ] as const;
  return (
    <Modal label="Choose your course depth" onClose={onClose}>
      <div className="p-5 sm:p-6 space-y-5">
        <header>
          <h2 className="text-xl font-bold">How deep would you like to go?</h2>
          <p className="text-sm text-slate-400 mt-2">
            {course.title} · {course.variations.length} lines
          </p>
        </header>
        <fieldset className="space-y-2">
          <legend className="sr-only">Course depth</legend>
          {options.map((o) => (
            <label
              key={o.id}
              className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer ${depth === o.id ? 'border-[#E5A93C] bg-[#E5A93C]/5' : 'border-slate-400/15'}`}
            >
              <input
                type="radio"
                name="course-depth"
                checked={depth === o.id}
                onChange={() => setDepth(o.id)}
                className="accent-[#E5A93C]"
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold">{o.name}</span>
                <span className="block mt-1 text-xs text-slate-400">{o.description}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-xl">
                  {getDepthLines(course, o.id).length}
                </span>
                <span className="text-xs text-slate-400">lines</span>
              </span>
            </label>
          ))}
        </fieldset>
        {previewOnly && (
          <p className="text-xs text-slate-400">
            Your free lesson is included at every depth. Explore the full demo from Account to study
            the remaining lines.
          </p>
        )}
        <button
          onClick={() => onSelect(depth)}
          className="w-full min-h-12 rounded-xl bg-[#E5A93C] font-bold text-slate-950"
        >
          {previewOnly
            ? 'Start free lesson'
            : `Continue with ${options.find((o) => o.id === depth)?.name}`}
        </button>
        <button onClick={onClose} className="w-full min-h-10 text-sm text-slate-400">
          Back
        </button>
        <p className="text-center text-xs text-slate-500">
          You can change depth at any time. Your progress is kept.
        </p>
      </div>
    </Modal>
  );
}
