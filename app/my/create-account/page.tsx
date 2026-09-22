import { AccountEntry, type AccountQuery } from '@/components/my-trusthub/account-entry';
export default async function CreateAccountPage({ searchParams }: { searchParams: Promise<AccountQuery> }) {
  return <AccountEntry operation="signup" query={await searchParams} />;
}
