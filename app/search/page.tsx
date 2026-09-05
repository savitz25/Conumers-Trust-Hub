import { permanentRedirect } from 'next/navigation';

export default async function SearchCompatibility({searchParams}:{searchParams:Promise<{q?:string|string[]}>}) {
  const params=await searchParams;
  const q=Array.isArray(params.q)?params.q[0]:params.q;
  permanentRedirect(q?`/ask?q=${encodeURIComponent(q)}`:'/ask');
}
