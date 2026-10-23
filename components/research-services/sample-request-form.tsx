'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { BRAND } from '@/lib/brand';
import { ASK_BRAND } from '@/lib/design/ask-design-system';
import {
  RESEARCH_INQUIRY_HONEYPOT,
  RESEARCH_SERVICE_ROLES,
  RESEARCH_SERVICE_VENDOR_COUNTS,
  researchInquiryRateLimitCopy,
  researchInquiryReceiptCopy,
  researchInquiryUnsavedCopy,
  researchServicesMailto,
  researchServicesRequestDetails,
  validateResearchInquiry,
  type ResearchInquiryErrors,
  type ResearchInquiryField,
  type ResearchInquiryInput,
} from '@/lib/research-services/inquiry';

const EMPTY: ResearchInquiryInput = {
  name: '',
  email: '',
  organization: '',
  role: '',
  vendorCount: '',
  message: '',
};

const controlClass =
  'mt-1 min-h-11 w-full rounded-lg border border-border bg-white px-3 text-base text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5]';

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return '';
}

export function SampleRequestForm({ storageEnabled = false }: { storageEnabled?: boolean }) {
  const formId = useId();
  const [values, setValues] = useState<ResearchInquiryInput>(EMPTY);
  const [errors, setErrors] = useState<ResearchInquiryErrors>({});
  const [honeypot, setHoneypot] = useState('');
  const [mailto, setMailto] = useState('');
  const [requestDetails, setRequestDetails] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [receiptId, setReceiptId] = useState('');
  const [failure, setFailure] = useState<'rate' | 'unsaved' | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const idempotencyKey = useRef(newIdempotencyKey());
  const fields = useRef<Partial<Record<ResearchInquiryField, HTMLElement | null>>>({});
  const statusRef = useRef<HTMLParagraphElement | null>(null);
  const focusStatus = useRef(false);

  useEffect(() => {
    setInteractive(true);
  }, []);

  useEffect(() => {
    if (!focusStatus.current) return;
    focusStatus.current = false;
    statusRef.current?.focus();
  }, [receiptId, failure]);

  function update(name: ResearchInquiryField, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setMailto('');
    setRequestDetails('');
    setCopyStatus('');
    setReceiptId('');
    setFailure('');
    idempotencyKey.current = newIdempotencyKey();
  }

  function focusFirst(nextErrors: ResearchInquiryErrors) {
    const order: ResearchInquiryField[] = ['name', 'email', 'organization', 'role', 'vendorCount', 'message'];
    const first = order.find((name) => nextErrors[name]);
    if (first) fields.current[first]?.focus();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateResearchInquiry(values);
    if (!result.ok) {
      setErrors(result.errors);
      setMailto('');
      setRequestDetails('');
      setCopyStatus('');
      setReceiptId('');
      setFailure('');
      focusFirst(result.errors);
      return;
    }
    setErrors({});
    if (!storageEnabled || !idempotencyKey.current) {
      const href = researchServicesMailto(result.value);
      setRequestDetails(researchServicesRequestDetails(result.value));
      setCopyStatus('');
      setMailto(href);
      window.location.href = href;
      return;
    }
    setSubmitting(true);
    setFailure('');
    setCopyStatus('');
    try {
      const response = await fetch('/api/research-services/inquiries', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        referrerPolicy: 'no-referrer',
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          [RESEARCH_INQUIRY_HONEYPOT]: honeypot,
          ...result.value,
        }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; stored?: boolean; receiptId?: string; error?: string; fields?: ResearchInquiryErrors } | null;
      if (payload?.ok === true && payload.stored === true && typeof payload.receiptId === 'string' && payload.receiptId) {
        setReceiptId(payload.receiptId);
        setFailure('');
        setRequestDetails('');
        focusStatus.current = true;
        return;
      }
      setReceiptId('');
      setRequestDetails(researchServicesRequestDetails(result.value));
      if (payload?.error === 'invalid' && payload.fields) {
        setErrors(payload.fields);
        setFailure('');
        focusFirst(payload.fields);
        return;
      }
      focusStatus.current = true;
      setFailure(payload?.error === 'rate_limited' ? 'rate' : 'unsaved');
    } catch {
      setReceiptId('');
      focusStatus.current = true;
      setFailure('unsaved');
      setRequestDetails(researchServicesRequestDetails(result.value));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyRequestDetails() {
    if (!requestDetails) return;
    try {
      await navigator.clipboard.writeText(requestDetails);
      setCopyStatus('Request details copied. Paste them into an email to hello@asktrusthub.com and send it to complete your request.');
    } catch {
      setCopyStatus('Could not copy request details. Select and copy the prepared details below, then email them to hello@asktrusthub.com.');
    }
  }

  const errorItems = (
    [
      ['name', 'Name'],
      ['email', 'Work email'],
      ['organization', 'Organization'],
      ['role', 'Role'],
      ['vendorCount', 'Approximate vendor count'],
      ['message', 'Message'],
    ] as const
  ).filter(([name]) => errors[name]);

  const statusText = receiptId
    ? researchInquiryReceiptCopy(receiptId)
    : failure === 'rate'
      ? researchInquiryRateLimitCopy()
      : failure === 'unsaved'
        ? researchInquiryUnsavedCopy()
        : mailto
          ? ''
          : storageEnabled
            ? 'The request is confirmed here only after it is saved. You can also email hello@asktrusthub.com.'
            : 'The request is delivered only when you send the email.';

  return (
    <form className="card-surface p-5 sm:p-8" method="post" onSubmit={onSubmit} noValidate aria-describedby={`${formId}-dependency`}>
      <h2 id="sample-request-heading" className="text-2xl font-semibold tracking-tight" style={{ color: ASK_BRAND.navy }}>
        Request a complimentary sample
      </h2>
      <p id={`${formId}-dependency`} className="mt-3 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>
        {storageEnabled ? (
          <>Save this request with Ask Trust Hub. It is confirmed here only after it is saved. You can also email <a className="link-inline" href={`mailto:${BRAND.email}`}>{BRAND.email}</a>.</>
        ) : (
          <>This form prepares an email to <a className="link-inline" href={`mailto:${BRAND.email}`}>{BRAND.email}</a>. Please send it from your email application to complete your request.</>
        )}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Include your contact details and an approximate vendor count. Leave vendor lists, insurance documents, and sensitive numbers out of this first message.
      </p>

      <div className="absolute -left-[10000px] h-0 overflow-hidden" aria-hidden="true">
        <label htmlFor={`${formId}-website`}>Leave this field blank</label>
        <input
          id={`${formId}-website`}
          name={RESEARCH_INQUIRY_HONEYPOT}
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </div>

      {errorItems.length > 0 ? (
        <div role="alert" className="mt-6 rounded-lg border border-destructive/40 bg-white p-4">
          <p className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>Check these fields.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {errorItems.map(([name]) => (
              <li key={name}>
                <a className="link-inline" href={`#${formId}-${name}`}>{errors[name]}</a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-name`} className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>Name</label>
          <input
            ref={(node) => { fields.current.name = node; }}
            id={`${formId}-name`}
            name="name"
            autoComplete="name"
            required
            maxLength={80}
            value={values.name}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `${formId}-name-error` : undefined}
            onChange={(event) => update('name', event.target.value)}
            className={controlClass}
          />
          {errors.name ? <p id={`${formId}-name-error`} className="mt-1 text-sm text-destructive">{errors.name}</p> : null}
        </div>
        <div>
          <label htmlFor={`${formId}-email`} className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>Work email</label>
          <input
            ref={(node) => { fields.current.email = node; }}
            id={`${formId}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={120}
            value={values.email}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? `${formId}-email-error` : undefined}
            onChange={(event) => update('email', event.target.value)}
            className={controlClass}
          />
          {errors.email ? <p id={`${formId}-email-error`} className="mt-1 text-sm text-destructive">{errors.email}</p> : null}
        </div>
        <div>
          <label htmlFor={`${formId}-organization`} className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>Organization</label>
          <input
            ref={(node) => { fields.current.organization = node; }}
            id={`${formId}-organization`}
            name="organization"
            autoComplete="organization"
            required
            maxLength={120}
            value={values.organization}
            aria-invalid={errors.organization ? true : undefined}
            aria-describedby={errors.organization ? `${formId}-organization-error` : undefined}
            onChange={(event) => update('organization', event.target.value)}
            className={controlClass}
          />
          {errors.organization ? <p id={`${formId}-organization-error`} className="mt-1 text-sm text-destructive">{errors.organization}</p> : null}
        </div>
        <div>
          <label htmlFor={`${formId}-role`} className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>Role</label>
          <select
            ref={(node) => { fields.current.role = node; }}
            id={`${formId}-role`}
            name="role"
            required
            value={values.role}
            aria-invalid={errors.role ? true : undefined}
            aria-describedby={errors.role ? `${formId}-role-error` : undefined}
            onChange={(event) => update('role', event.target.value)}
            className={controlClass}
          >
            <option value="">Choose a role</option>
            {RESEARCH_SERVICE_ROLES.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
          {errors.role ? <p id={`${formId}-role-error`} className="mt-1 text-sm text-destructive">{errors.role}</p> : null}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${formId}-vendorCount`} className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>Approximate vendor count</label>
          <select
            ref={(node) => { fields.current.vendorCount = node; }}
            id={`${formId}-vendorCount`}
            name="vendorCount"
            required
            value={values.vendorCount}
            aria-invalid={errors.vendorCount ? true : undefined}
            aria-describedby={errors.vendorCount ? `${formId}-vendorCount-error` : undefined}
            onChange={(event) => update('vendorCount', event.target.value)}
            className={controlClass}
          >
            <option value="">Choose a range</option>
            {RESEARCH_SERVICE_VENDOR_COUNTS.map((count) => (
              <option key={count} value={count}>{count}</option>
            ))}
          </select>
          {errors.vendorCount ? <p id={`${formId}-vendorCount-error`} className="mt-1 text-sm text-destructive">{errors.vendorCount}</p> : null}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={`${formId}-message`} className="text-sm font-semibold" style={{ color: ASK_BRAND.navy }}>Message</label>
          <p id={`${formId}-message-hint`} className="mt-1 text-sm text-muted-foreground">Optional.</p>
          <textarea
            ref={(node) => { fields.current.message = node; }}
            id={`${formId}-message`}
            name="message"
            rows={5}
            maxLength={1000}
            value={values.message}
            aria-invalid={errors.message ? true : undefined}
            aria-describedby={errors.message ? `${formId}-message-error` : `${formId}-message-hint`}
            onChange={(event) => update('message', event.target.value)}
            className={`${controlClass} h-auto min-h-32 py-3`}
          />
          {errors.message ? <p id={`${formId}-message-error`} className="mt-1 text-sm text-destructive">{errors.message}</p> : null}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button type="submit" className="btn-primary w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-60" disabled={!interactive || submitting} aria-busy={!interactive || submitting || undefined}>
          {storageEnabled ? (submitting ? 'Saving request' : 'Save this request') : 'Email this request'}
        </button>
        <a className="btn-secondary w-full sm:w-auto" href={`mailto:${BRAND.email}`}>Email {BRAND.email}</a>
        {requestDetails ? <button type="button" className="btn-secondary w-full sm:w-auto" onClick={copyRequestDetails}>Copy request details</button> : null}
      </div>

      <p id="sample-request-status" ref={statusRef} tabIndex={-1} role="status" aria-live="polite" className="mt-4 break-words text-sm leading-relaxed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5]" style={{ color: ASK_BRAND.ink }}>
        {mailto ? (
          <>
            Your request is ready as an email to {BRAND.email}. It is delivered only when you send the email.{' '}
            <a className="link-inline" href={mailto}>Open the email again</a>.
          </>
        ) : statusText}
      </p>
      {copyStatus ? <p role="status" aria-live="polite" className="mt-2 text-sm leading-relaxed" style={{ color: ASK_BRAND.ink }}>{copyStatus}</p> : null}
      {requestDetails ? <details className="mt-4 rounded-lg border border-border p-4">
        <summary className="cursor-pointer font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F46E5]">View request details to copy manually</summary>
        <pre className="mt-3 max-w-full overflow-x-auto whitespace-pre-wrap break-words text-sm">{requestDetails}</pre>
      </details> : null}
    </form>
  );
}
