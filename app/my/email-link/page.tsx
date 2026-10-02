import { AccountEntry, type AccountQuery } from '@/components/my-trusthub/account-entry';
export default async function EmailLinkPage({ searchParams }: { searchParams: Promise<AccountQuery> }) {
  return <AccountEntry operation="link" query={await searchParams} />;
}
