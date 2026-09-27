// DEMO=true builds a static export with generated data, e.g. for GitHub Pages.
// pageExtensions ["tsx"] leaves out the API route and proxy, which need a server.
const demo = process.env.DEMO === "true";

/** @type {import('next').NextConfig} */
const nextConfig = demo
  ? {
      output: "export",
      basePath: process.env.BASE_PATH || "",
      pageExtensions: ["tsx"],
      env: { NEXT_PUBLIC_DEMO: "true" },
    }
  : {
      output: "standalone",
      poweredByHeader: false,
    };

export default nextConfig;
