import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProblemSet, getTopicsForProblemSet } from '../services/dataService';
import type { ProblemSet, Topic } from '../types';
import './ProblemSetDetail.css';

export function ProblemSetDetail() {
  const { problemSetSlug } = useParams<{ problemSetSlug: string }>();
  const [problemSet, setProblemSet] = useState<ProblemSet | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProblemSetData() {
      if (!problemSetSlug) return;
      try {
        const ps = await getProblemSet(problemSetSlug);
        if (!ps) {
          setError('Problem set not found');
          setLoading(false);
          return;
        }
        setProblemSet(ps);

        const topicsData = await getTopicsForProblemSet(problemSetSlug);
        setTopics(topicsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load problem set');
      } finally {
        setLoading(false);
      }
    }
    loadProblemSetData();
  }, [problemSetSlug]);

  if (loading) {
    return (
      <div className="problem-set-detail">
        <div className="problem-set-detail-loading">Loading...</div>
      </div>
    );
  }

  if (error || !problemSet) {
    return (
      <div className="problem-set-detail">
        <div className="problem-set-detail-error">{error || 'Problem set not found'}</div>
        <Link to="/problem-sets">Back to Problem Sets</Link>
      </div>
    );
  }

  return (
    <div className="problem-set-detail">
      <header className="problem-set-detail-header">
        <Link to="/problem-sets" className="problem-set-detail-back">
          Back to Problem Sets
        </Link>
        <h1 className="problem-set-detail-title">{problemSet.name}</h1>
        <p className="problem-set-detail-description">{problemSet.description}</p>
        <div className="problem-set-detail-meta">
          <span>{problemSet.problemCount} problems</span>
          <span>{topics.length} topics</span>
        </div>
      </header>

      {topics.length === 0 ? (
        <div className="problem-set-detail-empty">No topics in this problem set.</div>
      ) : (
        <div className="problem-set-detail-topics">
          {topics.map((topic) => (
            <section key={topic.id} className="problem-set-detail-topic">
              <Link to={`/problem-sets/${topic.slug}`} className="problem-set-detail-topic-link">
                <h2 className="problem-set-detail-topic-title">
                  {topic.name}
                  <span className="problem-set-detail-topic-count">
                    {topic.problemCount} problems
                  </span>
                </h2>
                <p className="problem-set-detail-topic-description">{topic.description}</p>
              </Link>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
