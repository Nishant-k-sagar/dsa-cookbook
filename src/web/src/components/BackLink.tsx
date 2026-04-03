import { Link } from 'react-router-dom';
import './BackLink.css';

interface BackLinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
}

export function BackLink({ to, children, className = '' }: BackLinkProps) {
  return (
    <Link to={to} className={`back-link ${className}`}>
      {children}
    </Link>
  );
}