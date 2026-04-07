import { NextResponse } from 'next/server';

/**
 * Health check endpoint for Docker and Cloud Run monitoring
 * GET /api/health
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'Smart Investment AI Frontend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: {
      apiUrl: process.env.NEXT_PUBLIC_API_URL || 'not configured',
      wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'not configured',
    }
  });
}
