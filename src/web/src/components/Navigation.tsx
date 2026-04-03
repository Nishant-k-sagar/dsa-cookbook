import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { SearchBar } from './SearchBar';
import './Navigation.css';

const navLinks = [
  { path: '/', label: 'Home' },
  { path: '/problem-sets', label: 'Problem Sets' },
  { path: '/learn', label: 'Learn' },
];

function SearchToggleGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="search-toggle-svg">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16L21 21" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="search-toggle-svg">
      <path
        d="M7 7L17 17M17 7L7 17"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-toggle-svg">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="theme-toggle-svg">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Navigation() {
  const location = useLocation();
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light';
    }
    return 'light';
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const isHomePage = location.pathname === '/';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleMenu = () => {
    setIsSearchOpen(false);
    setIsMenuOpen(prev => !prev);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const toggleSearch = () => {
    setIsMenuOpen(false);
    setIsSearchOpen(prev => !prev);
  };

  return (
    <nav className="nav">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          DSA Cookbook
        </Link>

        {!isHomePage && (
          <div className="nav-search">
            <SearchBar />
          </div>
        )}

        <div className="nav-actions">
          {!isHomePage && (
            <button
              className="nav-search-toggle"
              onClick={toggleSearch}
              aria-label={isSearchOpen ? 'Close search' : 'Open search'}
              aria-expanded={isSearchOpen}
            >
              {isSearchOpen ? <CloseGlyph /> : <SearchToggleGlyph />}
            </button>
          )}

          {!isMenuOpen ? (
            <button
              className="nav-hamburger"
              onClick={toggleMenu}
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </button>
          ) : (
            <button className="nav-close" onClick={closeMenu} aria-label="Close menu">
              <CloseGlyph />
            </button>
          )}
        </div>

        <div className={`nav-search-mobile ${isSearchOpen ? 'is-open' : ''}`}>
          <SearchBar />
        </div>

        <ul className={`nav-links ${isMenuOpen ? 'nav-links--open' : ''}`}>
          {navLinks.map(link => (
            <li key={link.path}>
              <Link
                to={link.path}
                className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
                onClick={closeMenu}
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}
