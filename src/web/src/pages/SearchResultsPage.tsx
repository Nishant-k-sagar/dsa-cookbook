import { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { ProblemCard } from '../components/ProblemCard';
import './SearchResultsPage.css';

export function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { topicResults, problemResults, loading, search, searchQuery, setSearchQuery } = useGlobalSearch();

  useEffect(() => {
    if (query && query !== searchQuery && !loading) {
      setSearchQuery(query);
      search(query);
    }
  }, [query, searchQuery, loading, search, setSearchQuery]);

  return (
    <div className="search-results-page">
      <header className="search-results-header">
        <h1 className="search-results-title">Search Results</h1>
        <p className="search-results-query">
          {query ? `Results for "${query}"` : 'Enter a search query'}
        </p>
      </header>

      {loading ? (
        <div className="search-results-loading">Loading...</div>
      ) : !query ? (
        <div className="search-results-empty">
          <p>Enter a search query to find topics and problems</p>
        </div>
      ) : topicResults.length === 0 && problemResults.length === 0 ? (
        <div className="search-results-empty">
          <p>No results found for "{query}"</p>
          <p className="search-results-hint">
            Try searching by topic name, problem title, or LeetCode ID
          </p>
        </div>
      ) : (
        <>
          {topicResults.length > 0 && (
            <section className="search-results-section">
              <h2 className="search-results-section-title">Topics ({topicResults.length})</h2>
                <div className="search-results-grid">
                  {topicResults.map((result) => (
                  <Link key={result.id} to={`/problem-sets/${result.slug}`} className="search-result-card">
                    <div className="search-result-content">
                      <span className="search-result-title">{result.title}</span>
                      <span className="search-result-subtitle">{result.subtitle}</span>
                    </div>
                    {result.badge && <span className="search-result-badge">{result.badge}</span>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {problemResults.length > 0 && (
            <section className="search-results-section">
              <h2 className="search-results-section-title">Problems ({problemResults.length})</h2>
              <div className="search-results-problems">
                {problemResults.map((problem) => (
                  <ProblemCard key={problem.id} problem={problem} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

