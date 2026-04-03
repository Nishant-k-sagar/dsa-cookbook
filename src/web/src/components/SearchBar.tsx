import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalSearch, type SearchResult } from '../hooks/useGlobalSearch';
import './SearchBar.css';

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, i) => 
    regex.test(part) ? (
      <mark key={i} className="search-highlight">{part}</mark>
    ) : (
      part
    )
  );
}

interface SearchBarProps {
  placeholder?: string;
  className?: string;
}

const MAX_VISIBLE_RESULTS = 5;

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="search-svg">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16L21 21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SubmitGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="search-svg search-submit-svg">
      <path
        d="M7 17L17 7M9 7H17V15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClearGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="search-svg">
      <path
        d="M8 8L16 16M16 8L8 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SearchBar({ placeholder = 'Search topics, problems...', className = '' }: SearchBarProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    topicResults,
    problemResults,
    loading,
    searchQuery,
    setSearchQuery,
    search,
  } = useGlobalSearch();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState('');

  const allResults = useMemo(
    () => [
      ...topicResults,
      ...problemResults.map(p => ({ type: 'problem' as const, problem: p }))
    ],
    [topicResults, problemResults]
  );

  const hasMoreResults = allResults.length > MAX_VISIBLE_RESULTS;

  const handleSearch = useCallback(() => {
    const query = localQuery.trim();
    if (query) {
      setSearchQuery(query);
      search(query);
      setIsDropdownOpen(true);
    }
  }, [localQuery, search, setSearchQuery]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      handleSearch();
    },
    [handleSearch]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(e.target.value);
  }, []);

  const handleResultClick = useCallback(
    (result: SearchResult) => {
      setIsDropdownOpen(false);
      setLocalQuery('');
      setSearchQuery('');
      if (result.type === 'topic') {
        navigate(`/problem-sets/${result.slug}`);
      } else {
        navigate(`/problem-sets/${result.problem.topicSlug}/${result.problem.slug}`);
      }
    },
    [navigate, setSearchQuery]
  );

  const handleClear = useCallback(() => {
    setLocalQuery('');
    setSearchQuery('');
    setIsDropdownOpen(false);
    inputRef.current?.focus();
  }, [setSearchQuery]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      inputRef.current?.blur();
    }
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const showDropdown = isDropdownOpen && (allResults.length > 0 || loading || searchQuery);

  return (
    <div ref={containerRef} className={`search-bar-container ${className}`}>
      <form className="search-bar" onSubmit={handleSubmit}>
        <span className="search-icon">
          <SearchGlyph />
        </span>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={localQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {localQuery && (
          <button type="button" className="search-clear" onClick={handleClear} aria-label="Clear search">
            <ClearGlyph />
          </button>
        )}
        <button type="submit" className="search-submit" aria-label="Search">
          <SubmitGlyph />
        </button>
      </form>

      {showDropdown && (
        <div className="search-dropdown">
          {loading ? (
            <div className="search-dropdown-loading">Loading...</div>
          ) : allResults.length === 0 && searchQuery.trim() ? (
            <div className="search-dropdown-empty">No results found for "{searchQuery}"</div>
          ) : (
            <>
              {topicResults.length > 0 && (
                <div className="search-dropdown-section">
                  <div className="search-dropdown-header">TOPICS</div>
                  {topicResults.slice(0, MAX_VISIBLE_RESULTS).map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      className="search-dropdown-item"
                      onClick={() => handleResultClick(result)}
                    >
                      <div className="search-dropdown-item-content">
                        <span className="search-dropdown-item-title">{highlightMatch(result.title, searchQuery)}</span>
                        <span className="search-dropdown-item-subtitle">{highlightMatch(result.subtitle, searchQuery)}</span>
                      </div>
                      {result.badge && <span className="search-dropdown-badge">{result.badge}</span>}
                    </button>
                  ))}
                </div>
              )}

              {problemResults.length > 0 && (
                <div className="search-dropdown-section">
                  <div className="search-dropdown-header">PROBLEMS</div>
                  {problemResults.slice(0, MAX_VISIBLE_RESULTS).map((problem) => (
                    <button
                      key={problem.id}
                      type="button"
                      className="search-dropdown-item"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setLocalQuery('');
                        setSearchQuery('');
                        navigate(`/problem-sets/${problem.topicSlug}/${problem.slug}`);
                      }}
                    >
                      <div className="search-dropdown-item-content">
                        <span className="search-dropdown-item-title">{highlightMatch(problem.title, searchQuery)}</span>
                        <span className="search-dropdown-item-subtitle">
                          {problem.difficulty} • LeetCode #{problem.leetcodeId}
                        </span>
                      </div>
                      <span className="search-dropdown-badge problem-badge">
                        {problem.difficulty}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {hasMoreResults && (
                <div className="search-dropdown-more">
                  <button
                    type="button"
                    className="search-dropdown-more-button"
                    onClick={() => {
                      setIsDropdownOpen(false);
                      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
                    }}
                  >
                    View all {allResults.length} results
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
