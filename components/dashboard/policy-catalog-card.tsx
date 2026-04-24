import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DIMENSION_LABELS, type CatalogEntry } from '@/lib/policies/catalog';

export const PolicyCatalogCard = ({ entry }: { entry: CatalogEntry }) => (
  <Card className="flex flex-col">
    <CardHeader className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <CardTitle className="text-base">{entry.title}</CardTitle>
        <Badge variant="outline" className="shrink-0 text-xs font-normal">
          {DIMENSION_LABELS[entry.dimension]}
        </Badge>
      </div>
      <code className="text-xs text-muted-foreground">{entry.builtin_key}</code>
    </CardHeader>
    <CardContent className="flex-1 space-y-3">
      <p className="text-sm text-muted-foreground">{entry.description}</p>
      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Config: </span>
        {entry.config_keys.join(', ')}
      </div>
    </CardContent>
    <CardFooter>
      <Button asChild size="sm" className="w-full">
        <Link href={`/dashboard/policies?builtin=${entry.builtin_key}`}>Apply to my org</Link>
      </Button>
    </CardFooter>
  </Card>
);
