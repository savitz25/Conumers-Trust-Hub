'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Send } from 'lucide-react';
import { CONSUMERS_TRUST_HUB } from '@/lib/sites';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const contactSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  subject: z.string().min(3, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type ContactForm = z.infer<typeof contactSchema>;

export default function ContactPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
  });

  async function onSubmit(data: ContactForm) {
    // Future: POST to /api/contact with Supabase or email service
    console.log('Contact form submission:', data);
    alert('Thank you for reaching out. We will respond within 2 business days.');
    reset();
  }

  return (
    <div className="container mx-auto px-4 py-12 md:py-16">
      <div className="max-w-xl">
        <h1 className="text-4xl font-bold tracking-tight">Contact Us</h1>
        <p className="mt-4 text-muted-foreground">
          Questions about our directories, verification methodology, or partnership inquiries.
          We respond within 2 business days.
        </p>

        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Mail className="h-4 w-4" />
          {CONSUMERS_TRUST_HUB.email}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-5" noValidate>
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" className="mt-1.5" {...register('name')} aria-invalid={!!errors.name} />
            {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" className="mt-1.5" {...register('email')} aria-invalid={!!errors.email} />
            {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" className="mt-1.5" {...register('subject')} aria-invalid={!!errors.subject} />
            {errors.subject && <p className="mt-1 text-sm text-destructive">{errors.subject.message}</p>}
          </div>

          <div>
            <Label htmlFor="message">Message</Label>
            <textarea
              id="message"
              rows={5}
              className="mt-1.5 flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              {...register('message')}
              aria-invalid={!!errors.message}
            />
            {errors.message && <p className="mt-1 text-sm text-destructive">{errors.message.message}</p>}
          </div>

          <Button type="submit" variant="trust" disabled={isSubmitting} className="gap-2">
            <Send className="h-4 w-4" />
            {isSubmitting ? 'Sending...' : 'Send Message'}
          </Button>
        </form>
      </div>
    </div>
  );
}