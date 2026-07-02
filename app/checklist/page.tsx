'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { ChecklistItem } from '@/components/checklist-item';
import { ProgressRing } from '@/components/progress-ring';
import { MASTER_CHECKLIST, CATEGORY_LABELS, type ChecklistCategory } from '@/lib/checklist';
import { fadeUp } from '@/lib/animations';

export default function ChecklistPage() {
  const [completed, setCompleted] = useState<Set<string>>(new Set(['budget']));

  function handleToggle(id: string, checked: boolean) {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const progress = Math.round((completed.size / MASTER_CHECKLIST.length) * 100);
  const categories = [...new Set(MASTER_CHECKLIST.map((i) => i.category))] as ChecklistCategory[];

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
          <div>
            <p className="text-sm font-semibold text-trust flex items-center gap-1">
              <Sparkles className="h-4 w-4" /> Master Move Checklist
            </p>
            <h1 className="text-3xl font-bold mt-1">Your relocation playbook</h1>
            <p className="text-muted-foreground mt-2">
              Check items off as you go — we&apos;ll celebrate every win with you.
            </p>
          </div>
          <ProgressRing progress={progress} size={100} label="Done" />
        </div>

        {categories.map((cat) => (
          <section key={cat} className="mb-10">
            <h2 className="text-lg font-bold mb-4 text-foreground/80">{CATEGORY_LABELS[cat]}</h2>
            <ul className="space-y-3">
              {MASTER_CHECKLIST.filter((i) => i.category === cat).map((item) => (
                <ChecklistItem
                  key={item.id}
                  {...item}
                  defaultChecked={completed.has(item.id)}
                  onToggle={handleToggle}
                />
              ))}
            </ul>
          </section>
        ))}
      </motion.div>
    </div>
  );
}