import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { LearnPage } from './pages/LearnPage';
import { LearnTopicDetail } from './pages/LearnTopicDetail';
import { ProblemDetail } from './pages/ProblemDetail';
import { ProblemSetList } from './pages/ProblemSetList';
import { SearchResultsPage } from './pages/SearchResultsPage';
import './index.css';

function LearnTopicRedirect() {
  const { topicSlug } = useParams<{ topicSlug: string }>();

  if (!topicSlug) {
    return <Navigate to="/problem-sets" replace />;
  }

  return <Navigate to={`/problem-sets/${topicSlug}`} replace />;
}

function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  return (
    <BrowserRouter>
      <div className="app">
        <Navigation />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/learn/:topicSlug" element={<LearnTopicRedirect />} />
            <Route path="/problem-sets/:topicSlug/:problemSlug" element={<ProblemDetail />} />
            <Route path="/problem-sets" element={<ProblemSetList />} />
            <Route path="/problem-sets/:topicSlug" element={<LearnTopicDetail />} />
            <Route path="/search" element={<SearchResultsPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
