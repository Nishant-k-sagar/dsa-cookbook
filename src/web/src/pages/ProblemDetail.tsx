import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProblem, getProblemsForTopic } from '../services/dataService';
import type { Problem } from '../types';
import { CopyButton } from '../components/CopyButton';
import { TabNav } from '../components/TabNav';
import './ProblemDetail.css';

export function ProblemDetail() {
  const { topicSlug, problemSlug } = useParams<{ topicSlug: string; problemSlug: string }>();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'intuition' | 'approach' | 'pseudocode' | 'code'>('intuition');
  const [prevProblem, setPrevProblem] = useState<Problem | null>(null);
  const [nextProblem, setNextProblem] = useState<Problem | null>(null);

  useEffect(() => {
    async function loadProblem() {
      if (!problemSlug) return;
      try {
        const data = await getProblem(problemSlug);
        setProblem(data ?? null);
        
        if (data?.topicSlug) {
          const problems = await getProblemsForTopic(data.topicSlug);
          
          const currentIndex = problems.findIndex(p => p.slug === problemSlug);
          if (currentIndex > 0) {
            setPrevProblem(problems[currentIndex - 1]);
          }
          if (currentIndex < problems.length - 1) {
            setNextProblem(problems[currentIndex + 1]);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load problem');
      } finally {
        setLoading(false);
      }
    }
    loadProblem();
  }, [problemSlug]);

  if (loading) {
    return (
      <div className="problem-detail">
        <div className="problem-detail-loading">Loading...</div>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="problem-detail">
        <div className="problem-detail-error">{error || 'Problem not found'}</div>
        <Link to="/problem-sets">Back to Problem Sets</Link>
      </div>
    );
  }

  return (
    <div className="problem-detail">
      <header className="problem-detail-header">
        <Link to="/problem-sets" className="problem-detail-back">Back to Problem Sets</Link>
        <h1 className="problem-detail-title">{problem.title}</h1>
        {problem.difficulty && (
          <span className={`problem-detail-difficulty problem-detail-difficulty--${problem.difficulty.toLowerCase()}`}>
            {problem.difficulty}
          </span>
        )}
        {problem.leetcodeUrl && (
          <a 
            href={problem.leetcodeUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="problem-detail-leetcode-link"
          >
            View on LeetCode
          </a>
        )}
      </header>

      <section className="problem-detail-section">
        <h2>Problem Statement</h2>
        <div className="problem-detail-statement">{problem.statement}</div>
      </section>

      {problem.examples && problem.examples.length > 0 && (
        <section className="problem-detail-section">
          <h2>Examples</h2>
          {problem.examples.map((example, i) => (
            <div key={i} className="problem-detail-example">
              <div><strong>Input:</strong> {example.input}</div>
              <div><strong>Output:</strong> {example.output}</div>
              {example.explanation && <div><strong>Explanation:</strong> {example.explanation}</div>}
            </div>
          ))}
        </section>
      )}

      {problem.constraints && problem.constraints.length > 0 && (
        <section className="problem-detail-section">
          <h2>Constraints</h2>
          <ul className="problem-detail-constraints">
            {problem.constraints.map((constraint, i) => (
              <li key={i}>{constraint}</li>
            ))}
          </ul>
        </section>
      )}

      <TabNav
        tabs={[
          { id: 'intuition', label: 'Intuition' },
          { id: 'approach', label: 'Approach' },
          { id: 'pseudocode', label: 'Pseudocode' },
          { id: 'code', label: 'Code' },
        ]}
        activeTab={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as 'intuition' | 'approach' | 'pseudocode' | 'code')}
        ariaLabel="Problem solution sections"
      />

      <section className="problem-detail-content">
        {activeTab === 'intuition' && (
          <div
            role="tabpanel"
            id="panel-intuition"
            aria-labelledby="tab-intuition"
            className="problem-detail-intuition"
          >
            {problem.content?.intuition || 'No intuition available.'}
            {problem.content?.keyObservations && problem.content.keyObservations.length > 0 && (
              <div className="problem-detail-observations">
                <h3>Key Observations</h3>
                <ul>
                  {problem.content.keyObservations.map((obs, i) => (
                    <li key={i}>{obs}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {activeTab === 'approach' && (
          <div
            role="tabpanel"
            id="panel-approach"
            aria-labelledby="tab-approach"
            className="problem-detail-approach"
          >
            {Array.isArray(problem.content?.approach) && problem.content.approach.length > 0 ? (
              <ul>
                {problem.content.approach.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ul>
            ) : (
              <p>{problem.content?.approach || 'No approach available.'}</p>
            )}
          </div>
        )}
        {activeTab === 'pseudocode' && (
          <div
            role="tabpanel"
            id="panel-pseudocode"
            aria-labelledby="tab-pseudocode"
            className="problem-detail-pseudocode"
          >
            {Array.isArray(problem.content?.pseudocode) ? (
              <ul>
                {problem.content.pseudocode.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ul>
            ) : (
              <pre>{problem.content?.pseudocode || 'No pseudocode available.'}</pre>
            )}
          </div>
        )}
        {activeTab === 'code' && (
          <div
            role="tabpanel"
            id="panel-code"
            aria-labelledby="tab-code"
            className="problem-detail-code-wrapper"
          >
            <div className="problem-detail-content-header">
              <CopyButton text={problem.code?.cpp || 'No code available.'} />
            </div>
            <pre className="problem-detail-code">
              <code>{problem.code?.cpp || 'No code available.'}</code>
            </pre>
          </div>
        )}
      </section>

      {problem.content?.pitfalls && problem.content.pitfalls.length > 0 && (
        <section className="problem-detail-section">
          <h2>Common Pitfalls</h2>
          <ul className="problem-detail-pitfalls">
            {problem.content.pitfalls.map((pitfall, i) => (
              <li key={i}>{pitfall}</li>
            ))}
          </ul>
        </section>
      )}

      {(problem.content?.timeComplexity || problem.content?.spaceComplexity) && (
        <section className="problem-detail-section">
          <h2>Complexity</h2>
          {problem.content?.timeComplexity && <p><strong>Time:</strong> {problem.content.timeComplexity}</p>}
          {problem.content?.spaceComplexity && <p><strong>Space:</strong> {problem.content.spaceComplexity}</p>}
        </section>
      )}

      {problem.hints && problem.hints.length > 0 && (
        <section className="problem-detail-section">
          <h2>Hints</h2>
          <ul className="problem-detail-hints">
            {problem.hints.map((hint, i) => (
              <li key={i}>{hint}</li>
            ))}
          </ul>
        </section>
      )}

      {(prevProblem || nextProblem) && (
        <nav className="problem-detail-navigation">
          {prevProblem && (
            <Link to={`/problem-sets/${topicSlug}/${prevProblem.slug}`} className="problem-detail-nav-btn problem-detail-nav-btn--prev">
              <span className="problem-detail-nav-btn-icon">&larr;</span>
              <span className="problem-detail-nav-btn-text">Previous</span>
            </Link>
          )}
          {nextProblem && (
            <Link to={`/problem-sets/${topicSlug}/${nextProblem.slug}`} className="problem-detail-nav-btn problem-detail-nav-btn--next">
              <span className="problem-detail-nav-btn-text">Next</span>
              <span className="problem-detail-nav-btn-icon">&rarr;</span>
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

