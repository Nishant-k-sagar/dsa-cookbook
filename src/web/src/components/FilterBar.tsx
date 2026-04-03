import './FilterBar.css';

export type Difficulty = 'All' | 'Easy' | 'Medium' | 'Hard';

interface FilterBarProps {
  selectedDifficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
}

const difficulties: Difficulty[] = ['All', 'Easy', 'Medium', 'Hard'];

export function FilterBar({ selectedDifficulty, onDifficultyChange }: FilterBarProps) {
  return (
    <div className="filter-bar">
      <span className="filter-label">Difficulty:</span>
      <div className="filter-options">
        {difficulties.map((diff) => (
          <button
            key={diff}
            className={`filter-button ${selectedDifficulty === diff ? 'active' : ''}`}
            onClick={() => onDifficultyChange(diff)}
          >
            {diff}
          </button>
        ))}
      </div>
    </div>
  );
}
