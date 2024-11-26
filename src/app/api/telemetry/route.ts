// app/api/telemetry/route.ts
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'smallestbirdmk2.csv');
    const fileContents = await fs.readFile(filePath, 'utf8');
    return NextResponse.json({ data: fileContents });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load telemetry data' }, { status: 500 });
  }
}