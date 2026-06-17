// src/app/api/server-status/route.ts
import { NextResponse } from 'next/server';
import { getDbPool } from '../db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getDbPool();
    const result = await pool.query('SELECT * FROM server_status WHERE id = $1', ['current']);
    if (result.rows.length === 0) {
      return NextResponse.json({
        status: 'offline',
        tunnel_url: null,
        cpu_usage: 0,
        ram_usage: 0,
        active_tasks: 0,
        active_users: 0,
        max_concurrent_tasks: 1,
        max_concurrent_users: 5,
        last_ping: new Date().toISOString()
      });
    }
    return NextResponse.json(result.rows[0]);
  } catch (error: any) {
    console.error('Failed to get server status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { max_concurrent_tasks, max_concurrent_users } = body;
    
    const pool = getDbPool();
    await pool.query(
      `UPDATE server_status 
       SET max_concurrent_tasks = COALESCE($1, max_concurrent_tasks), 
           max_concurrent_users = COALESCE($2, max_concurrent_users)
       WHERE id = $3`,
      [
        max_concurrent_tasks !== undefined ? parseInt(max_concurrent_tasks) : null,
        max_concurrent_users !== undefined ? parseInt(max_concurrent_users) : null,
        'current'
      ]
    );
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to update server settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
