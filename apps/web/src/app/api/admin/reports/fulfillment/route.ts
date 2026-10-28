import { NextResponse } from "next/server";
import { reportToCsv } from "@workspace/domain/order-timing";
import { loadFulfillmentReport, parseReportQuery } from "@/lib/fulfillment-report";
import { authorizeAdmin } from "../../_lib/authorize-admin";
import { domainErrorResponse } from "../../_lib/domain-error-response";

export async function GET(req: Request): Promise<Response> {
  const denied = await authorizeAdmin();
  if (denied) return denied;
  const query = parseReportQuery(new URL(req.url).searchParams);
  if (!query) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  try {
    const report = await loadFulfillmentReport(query);
    if (query.format === "csv") {
      return new Response(reportToCsv(report), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="fulfillment-report.csv"',
        },
      });
    }
    return NextResponse.json({ report });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
