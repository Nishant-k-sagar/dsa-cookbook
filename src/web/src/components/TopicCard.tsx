import { Link } from 'react-router-dom';
import type { Topic } from '../types';
import './TopicCard.css';

interface TopicCardProps {
  topic: Topic;
}

export function TopicCard({ topic }: TopicCardProps) {
  // const progress = topic.problemCount > 0
  //   ? Math.round(((topic.solvedCount || 0) / topic.problemCount) * 100)
  //   : 0;

  return (
    <Link to={`/problem-sets/${topic.slug}`} className="topic-card">
      <div className="topic-card-header">
        <h3 className="topic-card-title">{topic.name}</h3>
      </div>
      <p className="topic-card-description">{topic.description}</p>
      <div className="topic-card-footer">
        <span className="topic-card-count">{topic.problemCount} problems</span>
        {/* <div className="topic-card-progress">
          <div
            className="topic-card-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="topic-card-progress-text">{progress}%</span> */}
      </div>
    </Link>
  );
}
