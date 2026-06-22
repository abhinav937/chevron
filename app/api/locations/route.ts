import { NextRequest, NextResponse } from 'next/server';

// TODO: connect to Supabase / Vercel Postgres when database is set up
export async function GET() {
  return NextResponse.json({ locations: [] });
}

export async function POST(_req: NextRequest) {
  return NextResponse.json({ error: 'Not yet implemented' }, { status: 501 });
}
