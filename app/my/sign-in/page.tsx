import { AccountEntry, type AccountQuery } from '@/components/my-trusthub/account-entry';
export default async function SignInPage({ searchParams }: { searchParams: Promise<AccountQuery> }) {
  return <AccountEntry operation="login" query={await searchParams} />;
}
