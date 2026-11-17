import { OpeningCourse, OpeningStep, OpeningVariation } from '../types/chess';
import additions from './additionalOpenings.json';

export type CourseDepth = 'essentials' | 'advanced' | 'full';
export function getDepthLines(course: OpeningCourse, depth: CourseDepth) {
  return course.variations.filter(
    (v, i) =>
      depth === 'full' ||
      i === 0 ||
      v.difficulty === 'Foundational' ||
      (depth === 'advanced' && v.difficulty === 'Club')
  );
}
function describeMove(san: string): string {
  if (san === 'O-O' || san === 'O-O-O')
    return 'Castle to connect the rooks and bring the king away from the center.';
  const destination = san.match(/[a-h][1-8]/g)?.at(-1) ?? '';
  const piece: Record<string, string> = {
    N: 'knight',
    B: 'bishop',
    R: 'rook',
    Q: 'queen',
    K: 'king',
  };
  const name = piece[san[0]] ?? 'pawn';
  return `${san.includes('x') ? 'Capture' : 'Move'} with the ${name} on ${destination}.${san.includes('+') ? ' This gives check; the next move must meet it.' : ' Check the opponent’s threats before continuing.'}`;
}
export function expandCourse(course: OpeningCourse): OpeningCourse {
  const key =
    course.id.replace('course-', '') === 'ruy-lopez' ? 'ruy' : course.id.replace('course-', '');
  const specs = (additions as Record<string, typeof additions.italian>)[key] ?? [];
  const existing = new Set(course.variations.map((v) => v.steps.map((s) => s.san).join(' ')));
  const lines: OpeningVariation[] = specs
    .filter((v) => !existing.has(v.moves.join(' ')))
    .map((v) => {
      const prefix: string[] = [];
      const steps: OpeningStep[] = v.moves.map((san, i) => {
        prefix.push(san);
        const known = course.variations.find(
          (old) =>
            old.steps
              .slice(0, i + 1)
              .map((s) => s.san)
              .join(' ') === prefix.join(' ')
        );
        return {
          san,
          note: i === v.moves.length - 1 ? v.summary : (known?.steps[i]?.note ?? describeMove(san)),
          ...(i === v.moves.length - 1 ? { keyIdea: 'Plan from this position' } : {}),
        };
      });
      return {
        ...v,
        difficulty: v.difficulty as OpeningVariation['difficulty'],
        courseId: course.id,
        steps,
      };
    });
  return { ...course, variations: [...course.variations, ...lines] };
}
