// src/app/api/wake-requests/route.ts
import { NextResponse } from 'next/server';
import { getDbPool } from '../db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getDbPool();
    const result = await pool.query(
      'SELECT * FROM wake_requests ORDER BY created_at DESC LIMIT 50'
    );
    return NextResponse.json({ success: true, requests: result.rows });
  } catch (error: any) {
    console.error('Failed to list wake requests:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message } = body;
    
    const pool = getDbPool();
    
    // Check if there is already a pending request in the last 5 minutes to prevent spam
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const checkResult = await pool.query(
      "SELECT id FROM wake_requests WHERE created_at > $1 AND status = 'pending'",
      [fiveMinutesAgo]
    );
    
    if (checkResult.rows.length > 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'A wake request has already been sent recently. Please wait.',
        already_sent: true 
      });
    }
    
    // Insert new request
    const uuid = crypto.randomUUID();
    const now = new Date().toISOString();
    await pool.query(
      'INSERT INTO wake_requests (id, status, message, created_at) VALUES ($1, $2, $3, $4)',
      [uuid, 'pending', message || '', now]
    );
    
    return NextResponse.json({ success: true, message: 'Wake request sent successfully.' });
  } catch (error: any) {
    console.error('Failed to create wake request:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
