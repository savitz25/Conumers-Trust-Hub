'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getSearchUrl, type ServiceVertical } from '@/lib/sites';
import { cn } from '@/lib/utils';

const VERTICALS: { id: ServiceVertical; label: string }[] = [
  { id: 'moving', label: 'Moving' },
  { id: 'lending', label: 'Lending' },
  { id: 'insurance', label: 'Insurance' },
];

interface UnifiedSearchProps {
  className?: string;
  defaultVertical?: ServiceVertical;
  compact?: boolean;
}

export function UnifiedSearch({
  className,
  defaultVertical = 'moving',
  compact = false,
}: UnifiedSearchProps) {
  const router = useRouter();
  const [vertical, setVertical] = useState<ServiceVertical>(defaultVertical);
  const [zip, setZip] = useState('');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = zip.trim();
    if (trimmed) {
      window.location.href = getSearchUrl(vertical, trimmed);
    } else {
      router.push(`/${vertical}`);
    }
  }

  return (
    <form onSubmit={handleSearch} className={cn('w-full', className)}>
      <Tabs value={vertical} onValueChange={(v) => setVertical(v as ServiceVertical)}>
        <TabsList className={cn('mb-3 w-full', compact ? 'h-9' : 'h-10')}>
          {VERTICALS.map((v) => (
            <TabsTrigger key={v.id} value={v.id} className="flex-1 text-xs sm:text-sm">
              {v.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{5}(-[0-9]{4})?"
            placeholder="Enter ZIP code"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            className="pl-9"
            aria-label="ZIP code"
            maxLength={10}
          />
        </div>
        <Button type="submit" variant="trust" className="gap-2 shrink-0">
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className={compact ? 'sr-only sm:not-sr-only' : ''}>Search</span>
        </Button>
      </div>
    </form>
  );
}