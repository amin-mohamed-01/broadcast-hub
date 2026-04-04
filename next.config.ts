import type { NextConfig } from "next";

// React requires 'unsafe-eval' in dev mode for call-stack reconstruction.
// We never allow it in production.
const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // ── Remote image hosts ────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
    ],
  },

  // ── Security headers ──────────────────────────────────────────────────────
  async headers() {
    return [
      {
        // Apply to every route
        source: "/:path*",
        headers: [
          // Prevent the site from being embedded in iframes (clickjacking)
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Stop MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Force HTTPS for 2 years, include subdomains
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Limit referrer info sent to third parties
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          // Disable sensitive browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          // Enable DNS prefetching for performance
          { key: "X-DNS-Prefetch-Control", value: "on" },
          // Content Security Policy
          // NOTE: Firebase + Google Auth requires specific origins.
          // 'unsafe-inline' kept for styles (Tailwind runtime injection).
          // 'unsafe-eval' only in dev (React debugging / Turbopack HMR).
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts: self + Firebase + Google Identity Services
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://apis.google.com https://www.gstatic.com https://www.googletagmanager.com`,
              // Styles: self + inline (Tailwind)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Fonts
              "font-src 'self' https://fonts.gstatic.com",
              // Images: self + data URIs + picsum (portfolio) + Firebase storage
              "img-src 'self' data: https://picsum.photos https://firebasestorage.googleapis.com",
              // Connections: Firebase Auth, Firestore, Resend (via server-side API route)
              "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
              // Popups (Google sign-in popup)
              "frame-src https://accounts.google.com https://broadcast-hub-db114.firebaseapp.com",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
