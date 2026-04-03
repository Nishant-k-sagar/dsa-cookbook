import { Link } from 'react-router-dom';
import type { Problem } from '../types';
import './ProblemCard.css';

interface ProblemCardProps {
  problem: Problem;
}

export function ProblemCard({ problem }: ProblemCardProps) {
  return (
    <Link to={`/problem-sets/${problem.topicSlug}/${problem.slug}`} className="problem-card">
      <h3 className="problem-card-title">
        {problem.leetcodeId}. {problem.title}
      </h3>
      <div className="problem-card-meta">
        <span className={`problem-card-difficulty difficulty-${problem.difficulty.toLowerCase()}`}>
          {problem.difficulty}
        </span>
        {problem.status && (
          <span className={`problem-card-status status-${problem.status.toLowerCase()}`}>
            {problem.status}
          </span>
        )}
      </div>
    </Link>
  );
}
