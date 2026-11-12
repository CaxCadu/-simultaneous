import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@simultaneous/core", "@simultaneous/catalog"],
};

export default config;
