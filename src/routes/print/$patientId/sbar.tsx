import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type SbarEntry } from "@/lib/db";
import { PrintShell, usePrintPatient } from "@/components/PrintSheet";
import logoKcmh from "@/assets/logo-kcmh.png.asset.json";
import logoMoh from "@/assets/logo-moh.png.asset.json";

export const Route = createFileRoute("/print/$patientId/sbar")({
  head: () => ({
    meta: [
      { title: "Hand Over Sheet (SBAR) — Ward 39" },
      { name: "description", content: "Printable A4 landscape SBAR hand over sheet for Ward 39." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SbarPrint,
});

const SHIFT_ROWS: Array<{ key: string; label: string }> = [
  { key: "morning", label: "07:AM\nTO\n02:PM" },
  { key: "evening", label: "02:PM\nTO\n10:PM" },
  { key: "night", label: "10:PM\nTO\n7:AM" },
];

function SbarPrint() {
  const { id, patient } = usePrintPatient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [printMode, setPrintMode] = useState<"full" | "data">("full");
  const all = useLiveQuery(() => db.sbar.where("patientId").equals(id).sortBy("date"), [id]);
  const entries = (all ?? []).filter((e) => e.date === date);
  const availableDates = [...new Set((all ?? []).map((e) => e.date))].sort().reverse();

  const byShift = (shift: string): SbarEntry | undefined => entries.find((e) => e.shift === shift);

  return (
    <PrintShell title="Hand Over Sheet (SBAR)" patient={patient} landscape>
      {patient && (
        <>
          <div className="mx-auto mb-3 flex max-w-2xl flex-wrap items-center justify-center gap-3 print:hidden">
            <fieldset className="flex flex-wrap items-center gap-3 rounded-md border border-input px-3 py-2 font-sans text-sm">
              <legend className="px-1 font-medium">Print option</legend>
              <label className="flex items-center gap-2"><input type="radio" name="sbar-print-mode" checked={printMode === "full"} onChange={() => setPrintMode("full")} /> Print on White Paper</label>
              <label className="flex items-center gap-2"><input type="radio" name="sbar-print-mode" checked={printMode === "data"} onChange={() => setPrintMode("data")} /> Print on Form</label>
            </fieldset>
          </div>
          <div className="mx-auto mb-4 flex max-w-xs items-center gap-2 print:hidden">
            <label className="font-sans text-sm font-medium">Date:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 flex-1 rounded-md border border-input px-2 font-sans text-sm"
              list="sbar-dates"
            />
            <datalist id="sbar-dates">
              {availableDates.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>

          <div className={printMode === "full" ? "border-2 border-black" : "border-2 border-transparent"}>
            {/* Keep the original layout dimensions for overlay printing on pre-printed SBAR paper. */}
            <div className={`flex items-center justify-between px-2 py-1 ${printMode === "data" ? "invisible" : ""}`}>
              <img src={logoKcmh.url} alt="Kuwait Center for Mental Health" className="h-14 w-auto" />
              <h1 className="text-lg font-bold underline">Hand Over Sheet(SBAR)</h1>
              <img src={logoMoh.url} alt="Ministry of Health" className="h-14 w-auto" />
            </div>

            {/* Header info grid */}
            <table className="w-full border-collapse text-[11px]" style={{ tableLayout: "fixed" }}>
              <tbody>
                <tr>
                  <td rowSpan={2} className={`w-[7%] border px-1 py-1 text-center align-middle font-bold ${printMode === "full" ? "border-black" : "border-transparent"}`}>
                    <span className={printMode === "data" ? "invisible" : ""}>DATE</span>
                    <div className="font-normal">{date}</div>
                  </td>
                  <HCell label="Name:" value={patient.name} width="22%" dataOnly={printMode === "data"} />
                  <HCell label="FILE#" value={patient.fileNo} width="17%" dataOnly={printMode === "data"} />
                  <HCell label="DOB/AGE:" value={[patient.dob, patient.age].filter(Boolean).join(" / ")} width="19%" dataOnly={printMode === "data"} />
                  <td className={`w-[27%] border px-1 py-1 text-center font-bold ${printMode === "full" ? "border-black" : "border-transparent"}`}><span className={printMode === "data" ? "invisible" : ""}>Diagnosis</span></td>
                  <td rowSpan={2} className={`w-[8%] border px-1 py-1 text-center align-middle font-bold ${printMode === "full" ? "border-black" : "border-transparent"}`}>
                    <span className={printMode === "data" ? "invisible" : ""}>Ward:39</span>
                  </td>
                </tr>
                <tr>
                  <HCell label="CID" value={patient.cid} dataOnly={printMode === "data"} />
                  <HCell label="D.O.A:" value={patient.doa} dataOnly={printMode === "data"} />
                  <HCell label="Nationality" value={patient.nationality} dataOnly={printMode === "data"} />
                  <td className={`border px-1 py-1 text-center font-bold ${printMode === "full" ? "border-black" : "border-transparent"}`}>
                    {patient.diagnosis?.toUpperCase() || (printMode === "full" ? "—" : "")}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* SBAR grid */}
            <table className="w-full border-collapse text-[11px]" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th className={`w-[7%] border px-1 py-0.5 ${printMode === "full" ? "border-black" : "border-transparent"}`}><span className={printMode === "data" ? "invisible" : ""}>Shift</span></th>
                  <th className={`w-[21%] border px-1 py-0.5 ${printMode === "full" ? "border-black" : "border-transparent"}`}><span className={printMode === "data" ? "invisible" : ""}>Situation</span></th>
                  <th className={`w-[18%] border px-1 py-0.5 ${printMode === "full" ? "border-black" : "border-transparent"}`}><span className={printMode === "data" ? "invisible" : ""}>Background</span></th>
                  <th className={`w-[21%] border px-1 py-0.5 ${printMode === "full" ? "border-black" : "border-transparent"}`}><span className={printMode === "data" ? "invisible" : ""}>Assessment</span></th>
                  <th className={`w-[24%] border px-1 py-0.5 ${printMode === "full" ? "border-black" : "border-transparent"}`}><span className={printMode === "data" ? "invisible" : ""}>Recommendation</span></th>
                  <th className={`w-[9%] border px-1 py-0.5 ${printMode === "full" ? "border-black" : "border-transparent"}`}><span className={printMode === "data" ? "invisible" : ""}>Signature</span></th>
                </tr>
              </thead>
              <tbody>
                {SHIFT_ROWS.map(({ key, label }) => {
                  const e = byShift(key);
                  return (
                    <tr key={key}>
                      <td className={`h-[52mm] border px-1 py-1 text-center align-middle text-[11px] font-bold whitespace-pre-line ${printMode === "full" ? "border-black" : "border-transparent"}`}>
                        <span className={printMode === "data" ? "invisible" : ""}>{label}</span>
                      </td>
                      <BCell dataOnly={printMode === "data"}>{e?.situation}</BCell>
                      <BCell dataOnly={printMode === "data"}>{e?.background}</BCell>
                      <BCell dataOnly={printMode === "data"}>{e?.assessment}</BCell>
                      <BCell dataOnly={printMode === "data"}>{e?.recommendation}</BCell>
                      <BCell dataOnly={printMode === "data"}>{e?.signature}</BCell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PrintShell>
  );
}

function HCell({ label, value, width, dataOnly = false }: { label: string; value: string; width?: string; dataOnly?: boolean }) {
  return (
    <td className={`border px-1 py-1 align-top ${dataOnly ? "border-transparent" : "border-black"}`} style={width ? { width } : undefined}>
      <span className={`font-bold ${dataOnly ? "invisible" : ""}`}>{label} </span>
      <span>{value || (dataOnly ? "" : "—")}</span>
    </td>
  );
}

function BCell({ children, dataOnly = false }: { children: string | undefined; dataOnly?: boolean }) {
  return (
    <td className={`border px-1.5 py-1 align-top text-[11px] whitespace-pre-wrap ${dataOnly ? "border-transparent" : "border-black"}`}>{children ?? ""}</td>
  );
}
