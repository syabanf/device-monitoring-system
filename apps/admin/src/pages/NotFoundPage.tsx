import { Link } from 'react-router';
import { Button, EmptyState } from '@monitoring/ui';
import { SearchX } from 'lucide-react';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<SearchX />}
      title="Page not found"
      description="The page you are looking for does not exist."
      action={<Button asChild variant="outline"><Link to="/">Back to dashboard</Link></Button>}
      className="py-24"
    />
  );
}
