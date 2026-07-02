'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fadeUp } from '@/lib/animations';

const STEPS = [
  { id: 'type', title: 'What kind of move?', subtitle: 'No wrong answers — we tailor everything to you.' },
  { id: 'from', title: 'Where are you now?', subtitle: 'Your current ZIP helps us find local pros.' },
  { id: 'to', title: 'Where are you headed?', subtitle: 'New adventures await! 🎉' },
  { id: 'date', title: "When's the big day?", subtitle: "Rough is fine — we'll nudge you at the right times." },
  { id: 'priorities', title: 'What matters most?', subtitle: "We'll optimize your checklist around this." },
];

const MOVE_TYPES = ['Local', 'Interstate', 'International', 'Apartment → House', 'Downsizing'];
const PRIORITIES = ['Save money', 'Move fast', 'Full-service ease', 'Health insurance focus'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    moveType: '',
    fromZip: '',
    toZip: '',
    moveDate: '',
    priority: '',
  });

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function next() {
    if (isLast) {
      // Guest session stub — future: Supabase profile save
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('cth-onboarding', JSON.stringify(data));
      }
      router.push('/dashboard');
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 fun-gradient-bg">
      <div className="w-full max-w-lg">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-10" role="progressbar" aria-valuenow={step + 1} aria-valuemax={STEPS.length}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`journey-dot ${i < step ? 'journey-dot-done' : ''} ${i === step ? 'journey-dot-active' : ''}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, x: -20 }}
            className="glass-panel p-8"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-trust">Step {step + 1} of {STEPS.length}</p>
            <h1 className="text-2xl md:text-3xl font-bold mt-2">{current.title}</h1>
            <p className="text-muted-foreground mt-2">{current.subtitle}</p>

            <div className="mt-8 space-y-4">
              {current.id === 'type' && (
                <div className="grid gap-2">
                  {MOVE_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setData({ ...data, moveType: t })}
                      className={`rounded-xl border p-4 text-left font-medium transition-all ${data.moveType === t ? 'border-trust bg-trust/10' : 'hover:border-trust/30'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
              {current.id === 'from' && (
                <div>
                  <Label htmlFor="fromZip">Current ZIP</Label>
                  <Input id="fromZip" className="mt-2 h-12 text-lg" placeholder="e.g. 10001" value={data.fromZip} onChange={(e) => setData({ ...data, fromZip: e.target.value })} />
                </div>
              )}
              {current.id === 'to' && (
                <div>
                  <Label htmlFor="toZip">New ZIP</Label>
                  <Input id="toZip" className="mt-2 h-12 text-lg" placeholder="e.g. 90210" value={data.toZip} onChange={(e) => setData({ ...data, toZip: e.target.value })} />
                </div>
              )}
              {current.id === 'date' && (
                <div>
                  <Label htmlFor="moveDate">Target move date</Label>
                  <Input id="moveDate" type="date" className="mt-2 h-12" value={data.moveDate} onChange={(e) => setData({ ...data, moveDate: e.target.value })} />
                </div>
              )}
              {current.id === 'priorities' && (
                <div className="grid gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setData({ ...data, priority: p })}
                      className={`rounded-xl border p-4 text-left font-medium transition-all ${data.priority === p ? 'border-trust bg-trust/10' : 'hover:border-trust/30'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button variant="trust" onClick={next} className="rounded-xl gap-2">
                {isLast ? (
                  <>Let&apos;s go! <PartyPopper className="h-4 w-4" /></>
                ) : (
                  <>Continue <ArrowRight className="h-4 w-4" /></>
                )}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}