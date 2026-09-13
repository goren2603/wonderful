import { NextResponse } from "next/server";
import { execSync } from "node:child_process";

export const dynamic = "force-dynamic";

// So a visitor (or you) can confirm what's actually deployed matches a
// specific commit, rather than trusting a claim.
export async function GET() {
  let commit = "unknown";
  let committedAt: string | null = null;
  try {
    commit = execSync("git rev-parse --short HEAD", { cwd: process.cwd() }).toString().trim();
    committedAt = execSync("git log -1 --format=%cI", { cwd: process.cwd() }).toString().trim();
  } catch {
    // Not a git checkout (e.g. a packaged deploy without .git) — honestly report unknown, don't guess.
  }
  return NextResponse.json({ commit, committedAt });
}
