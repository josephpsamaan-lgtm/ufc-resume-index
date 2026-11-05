#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildImportReport } from "../src/import/ufc-csv.js";

const args=process.argv.slice(2);
const value=(flag)=>{const i=args.indexOf(flag);return i>=0?args[i+1]:null;};
const input=value("--file"), schema=value("--schema")||"irw";
const sourceName=value("--source")|| (schema==="irw"?"Item Response Warehouse — ufc_1993_2026":"Bair — UFC Data 2013–2026");
const sourceLicense=value("--license")||(schema==="irw"?"CC0 1.0":"CC BY 4.0");
const commit=args.includes("--commit");
if (!input) {
  console.error("Usage: node scripts/import-ufc-fights.mjs --file path.csv --schema irw|bair [--commit]");
  process.exit(1);
}
const csv=fs.readFileSync(path.resolve(input),"utf8");
const report=buildImportReport(csv,schema,sourceName,sourceLicense);
const {bouts,...summary}=report;
console.log(JSON.stringify(summary,null,2));
if (!commit) {
  console.log("\nDry run only. Add --commit with Supabase credentials to stage records.");
  process.exit(0);
}

const supabaseUrl=process.env.SUPABASE_URL;
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --commit.");
const base=supabaseUrl.replace(/\/$/,"")+"/rest/v1";
async function request(table,method,body,query="",prefer="resolution=merge-duplicates,return=representation") {
  const response=await fetch(`${base}/${table}${query}`,{
    method,headers:{
      apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,
      "Content-Type":"application/json",
      Prefer:prefer
    },body:body?JSON.stringify(body):undefined
  });
  if(!response.ok) throw new Error(`${table} ${response.status}: ${await response.text()}`);
  return response.status===204?[]:response.json();
}
const uniqueNames=[...new Set(bouts.flatMap(b=>[b.fighterA,b.fighterB]))];
for(let i=0;i<uniqueNames.length;i+=500){
  await request("fighters","POST",uniqueNames.slice(i,i+500).map(name=>({
    canonical_name:name,slug:name.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")
  })),"?on_conflict=canonical_name");
}
const fighterRows=await request("fighters","GET",null,`?select=id,canonical_name&canonical_name=in.(${uniqueNames.map(n=>encodeURIComponent(n)).join(",")})`);
const fighterIds=new Map(fighterRows.map(f=>[f.canonical_name,f.id]));
if(fighterIds.size!==uniqueNames.length) throw new Error("Not all fighter identities resolved after upsert.");
let inserted=0, sourceRecords=0, reviewFlags=0;
for(let i=0;i<bouts.length;i+=200){
  const chunk=bouts.slice(i,i+200);
  const payload=chunk.map(b=>({
    canonical_key:b.canonicalKey,event_date:b.eventDate,
    fighter_a_id:fighterIds.get(b.fighterA),fighter_b_id:fighterIds.get(b.fighterB),
    winner_fighter_id:b.winnerFighterName?fighterIds.get(b.winnerFighterName):null,
    outcome_category:b.outcomeCategory,method:b.method,finish_round:b.finishRound,
    finish_time:b.finishTime,weight_class:b.weightClass,title_fight:b.titleFight,
    record_status:"needs_review"
  }));
  const created=await request("canonical_fights","POST",payload,"?on_conflict=canonical_key","resolution=ignore-duplicates,return=representation");
  inserted+=created.length;
  const keys=chunk.map(b=>b.canonicalKey);
  const existing=await request("canonical_fights","GET",null,`?select=id,canonical_key,outcome_category,method,finish_round&canonical_key=in.(${keys.map(encodeURIComponent).join(",")})`);
  const fightByKey=new Map(existing.map(f=>[f.canonical_key,f]));
  const sourcePayload=[],issues=[];
  for(const b of chunk){
    const f=fightByKey.get(b.canonicalKey); if(!f) continue;
    sourcePayload.push({fight_id:f.id,source_name:b.sourceName,source_url:b.sourceUrl,source_record_id:b.sourceRecordId,source_license:b.sourceLicense,raw_payload:b.rawPayload,match_confidence:1});
    if(f.outcome_category!==b.outcomeCategory || (f.method&&b.method&&f.method!==b.method) || (f.finish_round&&b.finishRound&&f.finish_round!==b.finishRound)){
      issues.push({fight_id:f.id,issue_type:"source_conflict",severity:"blocking",details:{incoming:{source:b.sourceName,outcome:b.outcomeCategory,method:b.method,round:b.finishRound},existing:{outcome:f.outcome_category,method:f.method,round:f.finish_round}}});
    }
  }
  for(let j=0;j<sourcePayload.length;j+=500) {
    const records=await request("fight_source_records","POST",sourcePayload.slice(j,j+500),"","resolution=ignore-duplicates,return=representation");
    sourceRecords+=records.length;
  }
  for(let j=0;j<issues.length;j+=500) {
    const records=await request("fight_data_review_queue","POST",issues.slice(j,j+500),"");
    reviewFlags+=records.length;
  }
}
console.log(JSON.stringify({stagedFights:inserted,sourceRecords,reviewFlags,verified:false,published:false},null,2));
