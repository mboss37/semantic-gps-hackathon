'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { joinLines, parseLines } from './shared';

export type GeoFenceConfig = {
  allowed_regions?: string[];
  source?: 'header';
};

export const GeoFenceForm = ({
  config,
  onChange,
}: {
  config: GeoFenceConfig;
  onChange: (cfg: GeoFenceConfig) => void;
}) => (
  <div className="grid gap-3">
    <div className="grid gap-2">
      <Label htmlFor="geo-fence-source" className="text-xs text-muted-foreground">
        Source (locked to &quot;header&quot; in v1)
      </Label>
      <Input id="geo-fence-source" value="header" readOnly disabled />
    </div>
    <div className="grid gap-2">
      <Label className="text-xs text-muted-foreground">
        Allowed region codes (one per line — compared to x-agent-region)
      </Label>
      <Textarea
        rows={4}
        spellCheck={false}
        className="font-mono text-xs"
        placeholder="eu-west&#10;us-east"
        defaultValue={joinLines(config.allowed_regions)}
        onChange={(e) =>
          onChange({ ...config, source: 'header', allowed_regions: parseLines(e.target.value) })
        }
      />
    </div>
    <p className="text-xs text-muted-foreground">
      Empty list denies everyone (fail-closed). org_setting source is reserved for a future release.
    </p>
  </div>
);
