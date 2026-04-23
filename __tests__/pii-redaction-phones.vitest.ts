import { describe, expect, it } from 'vitest';
import { runPiiRedaction } from '@/lib/policies/built-in';

// International phone-number coverage for pii_redaction. Parses via
// libphonenumber-js so we can match real CRM data across regions without
// hand-rolled regex false-positives on dates, IPs, zips, or IDs.

describe('runPiiRedaction — international phones', () => {
  const expectRedacted = (input: unknown, expected: { min?: number } = {}) => {
    const out = runPiiRedaction(input);
    const serialized = JSON.stringify(out.redacted);
    return { out, serialized, min: expected.min ?? 1 };
  };

  describe('US formats', () => {
    it('redacts parenthesized US phone (Salesforce canonical)', () => {
      const { out, serialized } = expectRedacted({ phone: '(512) 757-6000' });
      expect(out.match_count).toBeGreaterThanOrEqual(1);
      expect(serialized).toContain('[redacted:phone]');
      expect(serialized).not.toContain('757-6000');
    });

    it('redacts dashed US phone', () => {
      const { out, serialized } = expectRedacted({ phone: '512-757-6000' });
      expect(out.match_count).toBeGreaterThanOrEqual(1);
      expect(serialized).not.toContain('512-757-6000');
    });

    it('redacts dotted US phone', () => {
      const { out, serialized } = expectRedacted({ phone: '512.757.6000' });
      expect(out.match_count).toBeGreaterThanOrEqual(1);
      expect(serialized).not.toContain('512.757.6000');
    });

    it('redacts US phone with country code and parens', () => {
      const { out, serialized } = expectRedacted({ phone: '+1 (512) 757-6000' });
      expect(out.match_count).toBeGreaterThanOrEqual(1);
      expect(serialized).not.toContain('757-6000');
    });
  });

  describe('international formats (E.164 + local)', () => {
    it('redacts UK international', () => {
      const { out, serialized } = expectRedacted({ phone: '+44 20 7946 0958' });
      expect(out.match_count).toBeGreaterThanOrEqual(1);
      expect(serialized).not.toContain('7946 0958');
    });

    it('redacts German international', () => {
      const { out, serialized } = expectRedacted({ phone: '+49 30 12345678' });
      expect(out.match_count).toBeGreaterThanOrEqual(1);
      expect(serialized).not.toContain('12345678');
    });

    it('redacts bare E.164 without separators', () => {
      const { out, serialized } = expectRedacted({ phone: '+15127576000' });
      expect(out.match_count).toBeGreaterThanOrEqual(1);
      expect(serialized).not.toContain('+15127576000');
    });

    it('redacts French international', () => {
      const { out, serialized } = expectRedacted({ phone: '+33 1 42 68 53 00' });
      expect(out.match_count).toBeGreaterThanOrEqual(1);
      expect(serialized).not.toContain('42 68 53 00');
    });

    it('redacts Japanese international', () => {
      const { out, serialized } = expectRedacted({ phone: '+81 3-5555-1234' });
      expect(out.match_count).toBeGreaterThanOrEqual(1);
      expect(serialized).not.toContain('5555-1234');
    });
  });

  describe('inline phones in prose text', () => {
    it('redacts phone embedded in a sentence', () => {
      const out = runPiiRedaction({
        note: 'Call Sarah at (512) 757-6000 before EOD to confirm the order.',
      });
      expect(out.match_count).toBeGreaterThanOrEqual(1);
      const txt = (out.redacted as { note: string }).note;
      expect(txt).toContain('[redacted:phone]');
      expect(txt).not.toContain('757-6000');
      expect(txt).toMatch(/Call Sarah at .* before EOD/);
    });

    it('redacts multiple phones in one string', () => {
      const out = runPiiRedaction({
        note: 'Primary: (512) 757-6000 · Mobile: +44 20 7946 0958',
      });
      expect(out.match_count).toBeGreaterThanOrEqual(2);
      const txt = (out.redacted as { note: string }).note;
      expect(txt).not.toContain('757-6000');
      expect(txt).not.toContain('7946 0958');
    });
  });

  describe('false-positive resistance', () => {
    it('leaves ISO dates alone', () => {
      const payload = { created: '2024-01-15', updated: '2024-12-31' };
      const out = runPiiRedaction(payload);
      expect(out.match_count).toBe(0);
      expect(out.redacted).toEqual(payload);
    });

    it('leaves IPv4 addresses alone', () => {
      const payload = { client_ip: '192.168.100.200', server: '10.0.0.1' };
      const out = runPiiRedaction(payload);
      expect(out.match_count).toBe(0);
      expect(out.redacted).toEqual(payload);
    });

    it('leaves US zip codes alone', () => {
      const payload = { zip: '90210', zip4: '90210-1234' };
      const out = runPiiRedaction(payload);
      expect(out.match_count).toBe(0);
      expect(out.redacted).toEqual(payload);
    });

    it('leaves timestamps and long IDs alone', () => {
      const payload = {
        ms_ts: '1713600000000',
        trace_id: '550e8400-e29b-41d4-a716-446655440000',
        order: 'ORD-9000000012345',
      };
      const out = runPiiRedaction(payload);
      expect(out.match_count).toBe(0);
      expect(out.redacted).toEqual(payload);
    });
  });

  describe('Salesforce-shaped payload', () => {
    it('redacts a realistic find_account response', () => {
      const sfRecord = {
        records: [
          {
            attributes: {
              type: 'Account',
              url: '/services/data/v60.0/sobjects/Account/001g500000ISeWUAA1',
            },
            Id: '001g500000ISeWUAA1',
            Name: 'Edge Communications',
            Industry: 'Electronics',
            Phone: '(512) 757-6000',
            Website: 'http://edgecomm.com',
          },
        ],
      };
      const out = runPiiRedaction(sfRecord);
      const serialized = JSON.stringify(out.redacted);
      expect(out.match_count).toBeGreaterThanOrEqual(1);
      expect(serialized).toContain('[redacted:phone]');
      expect(serialized).not.toContain('(512) 757-6000');
      // Non-PII fields untouched
      expect(serialized).toContain('Edge Communications');
      expect(serialized).toContain('001g500000ISeWUAA1');
      expect(serialized).toContain('edgecomm.com');
    });
  });
});
