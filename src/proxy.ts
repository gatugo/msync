import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
    // Basic Edge Protection: Ensure API requests have authorization headers
    if (req.nextUrl.pathname.startsWith('/api/coach')) {
        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.warn('Blocked unauthorized access attempt at Edge to /api/coach');
            return NextResponse.json({ error: 'Unauthorized: Edge blocked' }, { status: 401 });
        }
    }
    
    return NextResponse.next();
}

export const config = {
    matcher: ['/api/coach/:path*'],
};
