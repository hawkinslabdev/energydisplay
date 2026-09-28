import { connection } from "next/server";

import Dashboard from "./Dashboard";
import { pickLayout } from "./gauges";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const configured = pickLayout(process.env.LAYOUT);
  if (process.env.NEXT_PUBLIC_DEMO === "true") return <Dashboard layout={configured} />;
  await connection();
  const { layout } = await searchParams;
  return <Dashboard layout={pickLayout(typeof layout === "string" ? layout : undefined, configured)} />;
}
