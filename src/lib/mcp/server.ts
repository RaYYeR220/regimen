import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import * as z from 'zod';
import { REGIME_FACTOR_KEYS } from '@/lib/sources/nexus/adapter';
import { toRegimenError } from '@/lib/errors';

/**
 * Regimen's MCP surface.
 *
 * Written against MCP revision 2026-07-28, which is stateless: there is no
 * `initialize` handshake and no session id. Anything that must persist between calls
 * is carried as an explicit, server-minted handle passed back as an ordinary tool
 * argument — the pattern the current spec prescribes in place of sessions.
 *
 * Conventions applied to every tool here, because they are what makes a tool usable
 * by a model rather than merely callable:
 *  - an `outputSchema`, so results arrive as validated `structuredContent` instead of
 *    a wall of text the client has to re-parse;
 *  - annotations declaring the tool read-only and closed-world, since nothing in this
 *    service writes, trades, or touches funds;
 *  - a description long enough to say what the tool is FOR and when not to use it;
 *  - failures returned as tool-execution errors, not protocol errors, so the model can
 *    read the reason and correct itself.
 *
 * The handler keeps the SDK's default legacy fallback on, so 2025-era clients that
 * still send `initialize` are answered from the same factory.
 */

/** Tool names: lowercase, underscore-separated, namespaced. Safe for every client. */
export const TOOL_NAMES = [
  'regimen_describe_factors',
  'regimen_evaluate_track_record',
  'regimen_regime_map',
  'regimen_self_attack',
  'regimen_today',
  'regimen_stability_start',
  'regimen_stability_poll',
] as const;

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

/** Tools that reach a third-party data service are open-world; results can change. */
const READ_ONLY_OPEN_WORLD = { ...READ_ONLY, idempotentHint: false, openWorldHint: true } as const;

const factorDescriptionSchema = z.object({
  factors: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      unit: z.string(),
      description: z.string(),
      source: z.string(),
      pointInTime: z.boolean(),
    }),
  ),
  coverage: z.object({
    note: z.string(),
  }),
});

const FACTOR_CATALOGUE: Record<
  (typeof REGIME_FACTOR_KEYS)[number],
  { label: string; unit: string; description: string; source: string }
> = {
  vix: {
    label: 'VIX',
    unit: 'index',
    description: 'CBOE volatility index close. The standard proxy for how much fear is priced into equities.',
    source: 'get_macro',
  },
  us10y: {
    label: 'US 10-year yield',
    unit: 'percent',
    description: 'Ten-year Treasury yield. Moves in it reprice every risk asset, crypto included.',
    source: 'get_macro',
  },
  fedFunds: {
    label: 'Effective fed funds rate',
    unit: 'percent',
    description: 'The policy rate actually transacted. Separates tightening regimes from easing ones.',
    source: 'get_macro',
  },
  fundingRate: {
    label: 'Perpetual funding rate',
    unit: 'fraction per interval',
    description:
      'What longs pay shorts on the perpetual. Persistently positive funding marks crowded long positioning.',
    source: 'get_historical_funding',
  },
  openInterestUsd: {
    label: 'Open interest',
    unit: 'USD',
    description: 'Notional open on the perpetual. Rising open interest into a move means leverage is building.',
    source: 'get_open_interest',
  },
  longShortRatio: {
    label: 'Long/short ratio',
    unit: 'ratio',
    description: 'Account positioning skew. Extremes mark one-sided books that unwind violently.',
    source: 'get_open_interest',
  },
  fearGreed: {
    label: 'Fear & Greed index',
    unit: '0-100',
    description: 'Composite retail sentiment gauge. Included because many strategies are implicitly sentiment bets.',
    source: 'get_fear_greed',
  },
  trendTemplatePassed: {
    label: 'Trend-template gates passed',
    unit: 'count',
    description:
      'How many Minervini trend-template conditions held that day. A compact description of whether price was in an established uptrend.',
    source: 'get_vcp',
  },
};

/**
 * Build a server instance. Called once per request by the handler, which is what
 * keeps the deployment horizontally scalable with no shared state.
 */
export function buildServer(): McpServer {
  const server = new McpServer({ name: 'regimen', version: '1.0.0' });

  server.registerTool(
    'regimen_describe_factors',
    {
      title: 'Describe regime factors',
      description:
        'List the market-condition factors Regimen slices performance by, with the units, the upstream operation each is read from, and whether it is point-in-time. Call this before regimen_regime_map when you need to know which factor keys exist, what a value means, or how to describe a bucket to a user. It takes no arguments, reaches no network, and never changes.',
      inputSchema: z.object({}),
      outputSchema: factorDescriptionSchema,
      annotations: { ...READ_ONLY, title: 'Describe regime factors' },
    },
    () => {
      const output = {
        factors: REGIME_FACTOR_KEYS.map((key) => ({
          key,
          label: FACTOR_CATALOGUE[key].label,
          unit: FACTOR_CATALOGUE[key].unit,
          description: FACTOR_CATALOGUE[key].description,
          source: FACTOR_CATALOGUE[key].source,
          pointInTime: true,
        })),
        coverage: {
          note: 'Every factor is read with an explicit as_of date, so a regime map contains only what was knowable on the day. Call regimen_regime_map for the dates actually covered by a given strategy.',
        },
      };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  );

  return server;
}

export const mcpHandler = createMcpHandler(() => buildServer());

/** Shared error shaping so MCP tool failures read the same as REST failures. */
export function toolError(error: unknown) {
  const normalised = toRegimenError(error);
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: JSON.stringify(normalised.toJSON(), null, 2) }],
  };
}

export { READ_ONLY, READ_ONLY_OPEN_WORLD };
