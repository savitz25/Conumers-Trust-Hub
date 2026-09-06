'use client';

export default function ManageError({reset}:{error:Error & {digest?:string};reset:()=>void}) {
  return <main className="mx-auto max-w-xl px-4 py-12" role="alert"><h1 className="text-2xl font-semibold text-navy">My Trust Hub is temporarily unavailable</h1><p className="mt-2 text-sm text-muted-foreground">Your profiles and public evidence have not been changed. Try loading your private workspace again.</p><button className="btn-primary mt-5" type="button" onClick={reset}>Try again</button></main>;
}
