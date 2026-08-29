export const COVERAGE_NOTIFY_CONTRACT = 'coverage-notify-v1';

export type CoverageNotifyIntent = {
  contract: typeof COVERAGE_NOTIFY_CONTRACT;
  hubId: string;
  geographyCode: string;
  coverageLevel: string;
  createdAt: string;
  wired: false;
  note: string;
};

export function coverageNotifyIntent(hubId: string, geographyCode: string, coverageLevel: string): CoverageNotifyIntent {
  return {
    contract: COVERAGE_NOTIFY_CONTRACT,
    hubId,
    geographyCode,
    coverageLevel,
    createdAt: new Date().toISOString(),
    wired: false,
    note: 'Notification/watch is not wired. No parallel account system. Future Saved Research / customer platform may attach this intent.',
  };
}
