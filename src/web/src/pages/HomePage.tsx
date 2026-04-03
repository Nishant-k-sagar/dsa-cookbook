import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { SearchBar } from '../components/SearchBar';
import { TopicCard } from '../components/TopicCard';
import { TopicCardSkeleton } from '../components/Skeleton';
import { getTopics } from '../services/dataService';
import type { Topic } from '../types';
import './HomePage.css';

function BrowseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="home-action-svg">
      <rect x="3" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="3" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="14" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PathIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="home-action-svg">
      <circle cx="12" cy="5" r="2" fill="currentColor" />
      <path d="M12 7v4M12 11l-4 4M12 11l4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="8" cy="15" r="2" fill="currentColor" />
      <circle cx="16" cy="15" r="2" fill="currentColor" />
      <path d="M8 17v2M16 17v2" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function ProgressIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="home-action-svg">
      <path d="M3 20h18M6 16v4M10 12v8M14 8v12M18 4v16" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function HomePage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        setLoading(true);
        const data = await getTopics();
        setTopics(data);
      } catch (err) {
        setError('Failed to load topics');
        console.error('Error fetching topics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTopics();
  }, []);

  const featuredTopics = topics.slice(0, 6);

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="home-hero">
        <div className="home-hero-content">
          <h1 className="home-hero-title">The DSA recipes</h1>
          <p className="home-hero-subtitle">
            Curated problem sets for structured revision. Each set includes optimal solutions 
            with clear intuition, assuming you understand the fundamentals. If you are still 
            building foundational skills, start with the learn page.
          </p>
          <div className="home-hero-search">
            <SearchBar placeholder="Search topics, problems, concepts..." />
          </div>
        </div>
      </section>

      {/* Featured Topics Section */}
      <section className="home-featured">
        <div className="home-section-header">
          <h2 className="home-section-title">Popular Topics</h2>
          <Link to="/problem-sets" className="home-section-link">
            View all topics →
          </Link>
        </div>
        
        {error && (
          <div className="home-error">
            {error}
          </div>
        )}

        <div className="home-topics-grid">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <TopicCardSkeleton key={i} />
            ))
          ) : featuredTopics.length === 0 ? (
            <div className="home-empty">
              <p>No topics available</p>
            </div>
          ) : (
            featuredTopics.map((topic) => (
              <TopicCard key={topic.slug} topic={topic} />
            ))
          )}
        </div>
      </section>

      {/* Quick Actions Section */}
      <section className="home-actions">
        <div className="home-actions-grid">
          <Link to="/problem-sets" className="home-action-card">
            <div className="home-action-icon"><BrowseIcon /></div>
            <h3 className="home-action-title">Problem Sets</h3>
            <p className="home-action-description">
              Optimized solutions designed for quick revision. Each problem includes 
              the most efficient approach, with intuition and pitfalls explained.
            </p>
          </Link>
          
          <Link to="/learn" className="home-action-card">
            <div className="home-action-icon"><PathIcon /></div>
            <h3 className="home-action-title">Learn from Basics</h3>
            <p className="home-action-description">
              Build strong fundamentals first. Structured progression from 
              foundational concepts to advanced techniques, with detailed explanations.
            </p>
          </Link>
          
          <div className="home-action-card">
            <div className="home-action-icon"><ProgressIcon /></div>
            <h3 className="home-action-title">Track Progress</h3>
            <p className="home-action-description">
              Monitor your learning journey with progress tracking
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}