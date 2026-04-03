import './Skeleton.css';

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
}

export function Skeleton({ width = '100%', height = '20px', borderRadius = 'var(--radius-sm)' }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius }}
    />
  );
}

export function TopicCardSkeleton() {
  return (
    <div className="topic-card-skeleton">
      <Skeleton height="24px" width="60%" />
      <Skeleton height="16px" width="40%" />
    </div>
  );
}

export function ProblemCardSkeleton() {
  return (
    <div className="problem-card-skeleton">
      <Skeleton height="20px" width="70%" />
      <Skeleton height="16px" width="15%" />
    </div>
  );
}
