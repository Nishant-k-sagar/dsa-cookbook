import { Link } from 'react-router-dom';
import './LearnPage.css';

export function LearnPage() {
  return (
    <div className="learn-page">
      <div className="learn-page-launch">
        <div className="launch-ribbon">Upcoming Feature</div>
        <h2 className="launch-title">Structured Learning Paths</h2>
        <p className="launch-description">
          This page will contain the good to go steps for beginners. Once, They start, They will figure out the things along the way.
        </p>
        <p className="launch-note">
          In the meantime, explore our problem sets in the{' '}
          <Link to="/problem-sets" className="launch-link">
            Problem Sets
          </Link>{' '}
          section.
        </p>
      </div>
    </div>
  );
}
