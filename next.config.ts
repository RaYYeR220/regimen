import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The deployment-proof document must live at the literal well-known path on the
  // same origin as the API. Next cannot route a directory beginning with a dot,
  // so it is served by a normal route handler and rewritten into place.
  async rewrites() {
    return [
      {
        source: '/.well-known/xagent-verification.json',
        destination: '/api/xagent-verification',
      },
    ];
  },
};

export default nextConfig;
