import { mcpHandler } from '@/lib/mcp/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * The MCP endpoint.
 *
 * Under revision 2026-07-28 a server exposes ONE path that accepts POST; GET and
 * DELETE must be refused with 405 so a client can tell this apart from a legacy
 * HTTP+SSE server. The SDK handler implements that, so both verbs go straight to it.
 */
export function POST(request: Request): Promise<Response> {
  return mcpHandler.fetch(request);
}

export function GET(request: Request): Promise<Response> {
  return mcpHandler.fetch(request);
}

export function DELETE(request: Request): Promise<Response> {
  return mcpHandler.fetch(request);
}
