import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
    // No auth requirement; handled by /api/coach itself.
    return NextResponse.next();
}

export const config = {
    matcher: ['/api/coach/:path*'],
};
