import {
  handleResearchInquiryPost,
  handleResearchInquiryRead,
} from '@/lib/research-services/http';
import { researchInquiryDeps } from '@/lib/research-services/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return handleResearchInquiryRead();
}

export function PUT() {
  return handleResearchInquiryRead();
}

export function DELETE() {
  return handleResearchInquiryRead();
}

export function POST(request: Request) {
  return handleResearchInquiryPost(request, researchInquiryDeps());
}
