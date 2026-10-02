import { AccountEntry, type AccountQuery } from '@/components/my-trusthub/account-entry';
export default async function RecoverPage({ searchParams }: { searchParams: Promise<AccountQuery> }) {
  return <AccountEntry operation="recovery" query={await searchParams} />;
}
