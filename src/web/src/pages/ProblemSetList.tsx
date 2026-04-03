import { TopicCard } from '../components/TopicCard';
import { TopicCardSkeleton } from '../components/Skeleton';
import { useTopicsWithSearch } from '../hooks/useTopicsWithSearch';
import type { Topic } from '../types';
import './ProblemSetList.css';

export function ProblemSetList() {
  const {
    filteredTopics,
    loading,
    error,
  } = useTopicsWithSearch();

  return (
    <div className="problem-set-list">
      <header className="problem-set-list-header">
        <h1 className="problem-set-list-title">Problem Sets</h1>
        <p className="problem-set-list-subtitle">
          These problem sets are prepared using the best publicaly available DSA sheets. Those sheets are merged into big one source of problems' list, and then problems are extracted from them.
          Although, These sets also include other selected problems on the basic of various filters and factors. Approach and steps are as per seasoned coders and optimized for interviews. If you are a beginner, explore Learn page.<br />
          If you got your interview aligned in near future, this is the best place to rewind your DSA concepts.
        </p>
      </header>

      {error && (
        <div className="problem-set-list-error">
          {error}
        </div>
      )}

      <div className="problem-set-list-grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <TopicCardSkeleton key={i} />
          ))
        ) : filteredTopics.length === 0 ? (
          <div className="problem-set-list-empty">
            <p>No topics found</p>
          </div>
        ) : (
          filteredTopics.map((topic: Topic) => (
            <TopicCard key={topic.slug} topic={topic} />
          ))
        )}
      </div>
    </div>
  );
}
