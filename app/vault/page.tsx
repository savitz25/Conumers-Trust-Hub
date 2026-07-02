'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FolderLock, FileText, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { fadeUp } from '@/lib/animations';

const FOLDERS = [
  { id: 'identity', label: 'Identity', emoji: '🪪', description: 'IDs, passports' },
  { id: 'lease', label: 'Lease & Closing', emoji: '📄', description: 'Contracts, HUD-1' },
  { id: 'insurance', label: 'Insurance', emoji: '🛡️', description: 'Policies, binders' },
  { id: 'moving', label: 'Moving', emoji: '📦', description: 'Inventory, BOL' },
  { id: 'loan', label: 'Loan', emoji: '🏡', description: 'Estimates, pre-approval' },
];

/** Document Vault skeleton — V1 wires Supabase Storage + RLS */
export default function VaultPage() {
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    // V1: upload to Supabase Storage
    alert('Vault uploads launch in V1 — your files will be encrypted at rest.');
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <div className="flex items-center gap-3 mb-2">
          <FolderLock className="h-8 w-8 text-trust" />
          <h1 className="text-3xl font-bold">Document Vault</h1>
        </div>
        <p className="text-muted-foreground mb-8">
          Keep leases, policies, and loan docs safe — searchable when you need them most.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-2xl border-2 border-dashed p-12 text-center transition-colors mb-10 ${dragOver ? 'border-trust bg-trust/5' : 'border-muted-foreground/25'}`}
        >
          <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <p className="font-semibold">Drag files here or click to upload</p>
          <p className="text-sm text-muted-foreground mt-1">PDF, JPG, PNG up to 50MB — encrypted at rest</p>
          <Button variant="outline" className="mt-4 rounded-xl">Choose files</Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FOLDERS.map((folder) => (
            <Card key={folder.id} className="hub-card cursor-pointer">
              <CardContent className="pt-6">
                <span className="text-2xl">{folder.emoji}</span>
                <h3 className="font-semibold mt-2">{folder.label}</h3>
                <p className="text-xs text-muted-foreground">{folder.description}</p>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <FileText className="h-3 w-3" /> 0 files
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground justify-center">
          <Shield className="h-3.5 w-3.5 text-trust" />
          AES-256 at rest · Row-level security · You control sharing
        </p>
      </motion.div>
    </div>
  );
}