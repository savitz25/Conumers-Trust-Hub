import { AccountEntry, type AccountQuery } from '@/components/my-trusthub/account-entry';
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<AccountQuery> }) {
  return <AccountEntry operation="password" query={await searchParams} />;
}
