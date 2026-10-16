import MalariaDashboard from "@/src/App";
import { syncKPIsFromGoogleSheets } from "@/src/lib/sheetsService";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { updatedKPIs, terms, bigPushPillars } = await syncKPIsFromGoogleSheets([]);

  return (
    <MalariaDashboard
      initialKPIs={updatedKPIs}
      initialTerms={terms}
      initialBigPushPillars={bigPushPillars}
    />
  );
}
