import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTopic, getProblemsForTopic } from '../services/dataService';
import type { Topic, Problem, Difficulty } from '../types';
import { ProblemCard } from '../components/ProblemCard';
import { ProblemCardSkeleton } from '../components/Skeleton';
import { FilterChips } from '../components/FilterChips';
import './LearnTopicDetail.css';

type SortOption = 'default' | 'leetcode-asc' | 'leetcode-desc' | 'title-asc' | 'difficulty';
type DifficultyFilter = 'all' | Difficulty;

const difficultyRank: Record<Difficulty, number> = {
  Easy: 0,
  Medium: 1,
  Hard: 2,
};

export function LearnTopicDetail() {
  const { topicSlug } = useParams<{ topicSlug: string }>();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');

  useEffect(() => {
    async function loadData() {
      if (!topicSlug) return;
      try {
        const [topicData, problemsData] = await Promise.all([
          getTopic(topicSlug),
          getProblemsForTopic(topicSlug),
        ]);
        setTopic(topicData ?? null);
        setProblems(problemsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load topic');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [topicSlug]);

  const visibleProblems = useMemo(() => {
    const filtered = problems.filter(
      (problem) => difficultyFilter === 'all' || problem.difficulty === difficultyFilter,
    );

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'leetcode-asc':
          return a.leetcodeId - b.leetcodeId;
        case 'leetcode-desc':
          return b.leetcodeId - a.leetcodeId;
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'difficulty':
          return difficultyRank[a.difficulty] - difficultyRank[b.difficulty] || a.leetcodeId - b.leetcodeId;
        case 'default':
        default:
          return a.leetcodeId - b.leetcodeId;
      }
    });

    return sorted;
  }, [difficultyFilter, problems, sortBy]);


  if (loading) {
    return (
      <div className="topic-detail">
        <div className="topic-detail-header">
          <Link to="/problem-sets" className="topic-detail-back">Back to Problem Sets</Link>
          <div className="topic-detail-title-skeleton"></div>
        </div>
        <div className="topic-detail-problems">
          {Array.from({ length: 5 }).map((_, i) => (
            <ProblemCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !topic) {
    return (
      <div className="topic-detail">
        <div className="topic-detail-error">
          {error || 'Topic not found'}
        </div>
        <Link to="/problem-sets">Back to Problem Sets</Link>
      </div>
    );
  }

  return (
    <div className="topic-detail">
      <header className="topic-detail-header">
        <Link to="/problem-sets" className="topic-detail-back">Back to Problem Sets</Link>
        <h1 className="topic-detail-title">{topic.name}</h1>
        {topic.description && (
          <p className="topic-detail-description">{topic.description}</p>
        )}
      </header>

      <section className="topic-detail-controls" aria-label="Problem list controls">
        <div className="topic-detail-controls-row">
          <label className="topic-detail-select-group" htmlFor="topic-problem-sort">
            <span className="topic-detail-control-label">Sort</span>
            <select
              id="topic-problem-sort"
              className="topic-detail-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
            >
              <option value="default">Default order</option>
              <option value="leetcode-asc">LeetCode ID ascending</option>
              <option value="leetcode-desc">LeetCode ID descending</option>
              <option value="difficulty">Difficulty</option>
              <option value="title-asc">Title A-Z</option>
            </select>
          </label>

          <FilterChips
            chips={[
              { value: 'all', label: 'All' },
              { value: 'Easy', label: 'Easy', variant: 'easy' },
              { value: 'Medium', label: 'Medium', variant: 'medium' },
              { value: 'Hard', label: 'Hard', variant: 'hard' },
            ]}
            selectedValue={difficultyFilter}
            onChange={(value) => setDifficultyFilter(value as DifficultyFilter)}
            label="Difficulty filters"
          />

          <div className="topic-detail-summary">
            <span>{visibleProblems.length} problems</span>
          </div>
        </div>
      </section>

      <div className="topic-detail-problems">
        {visibleProblems.length === 0 ? (
          <div className="topic-detail-empty">No problems match the current filters</div>
        ) : (
          visibleProblems.map((problem: Problem) => (
            <ProblemCard key={problem.slug} problem={problem} />
          ))
        )}
      </div>
    </div>
  );
}
