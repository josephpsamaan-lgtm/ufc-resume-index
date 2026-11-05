import { describe, expect, it } from "vitest";
import { parseCsv, buildImportReport, normalizeBout } from "./ufc-csv.js";

describe("CSV parsing",()=>{
  it("handles quoted commas and escaped quotes",()=>{
    const rows=parseCsv('name,details\n"A, B","He said ""yes"""\n');
    expect(rows[0]).toEqual({name:"A, B",details:'He said "yes"'});
  });
  it("rejects unterminated quoted fields",()=>{
    expect(()=>parseCsv('a,b\n"broken,x')).toThrow();
  });
});
describe("IRW dataset adapter",()=>{
  it("normalizes a fight and preserves raw source fields",()=>{
    const b=normalizeBout({agent_a:"Fighter A",agent_b:"Fighter B",date:"2020-01-01",winner:"Fighter A",method:"Decision",finish_round:"3",weight_class:"Lightweight",title_fight:"0"},"irw","IRW","CC0 1.0",2);
    expect(b.outcomeCategory).toBe("fighter_a_win");
    expect(b.fighterA).toBe("Fighter A");
    expect(b.rawPayload.agent_b).toBe("Fighter B");
    expect(b.titleFight).toBe(false);
  });
  it("flags missing identities and unknown outcomes instead of guessing",()=>{
    const r=buildImportReport("agent_a,agent_b,date,winner\nA,B,2020-01-01,?\n,,2020-01-02,A","irw","IRW","CC0");
    expect(r.unknownOutcomes).toHaveLength(1);
    expect(r.invalidRows).toBe(1);
  });
});
