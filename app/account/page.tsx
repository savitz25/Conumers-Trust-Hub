'use client';

import Link from 'next/link';
import { User, Bell, CreditCard, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Account skeleton — V1 wires Supabase Auth */
export default function AccountPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-lg">
      <h1 className="text-3xl font-bold mb-8">Your account</h1>

      <Card className="mb-6 border-dashed">
        <CardContent className="pt-6 text-center">
          <LogIn className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Sign in to sync your checklist, vault, and concierge history</p>
          <Button variant="trust" className="mt-4 rounded-xl w-full">Sign in with email</Button>
          <p className="text-xs text-muted-foreground mt-3">Magic link — no password needed</p>
        </CardContent>
      </Card>

      <div className="space-y-4 opacity-60 pointer-events-none">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Profile</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Name, move dates, ZIPs</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Checklist reminders, SEP alerts</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Premium</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <Link href="/pricing">View plans →</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}