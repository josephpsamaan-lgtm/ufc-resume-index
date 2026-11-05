const clean = (v) => String(v ?? "").trim();
const keyName = (v) => clean(v).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function parseCsv(text) {
  const rows=[]; let row=[]; let cell=""; let quoted=false;
  for (let i=0;i<text.length;i++) {
    const c=text[i], next=text[i+1];
    if (quoted) {
      if (c === '"' && next === '"') { cell+='"'; i++; }
      else if (c === '"') quoted=false;
      else cell+=c;
    } else if (c === '"' && cell.length===0) quoted=true;
    else if (c === ',') { row.push(cell); cell=""; }
    else if (c === '\n') { row.push(cell.replace(/\r$/,"")); if(row.some(x=>x.trim()!=="")) rows.push(row); row=[]; cell=""; }
    else cell+=c;
  }
  if (quoted) throw new Error("CSV ends inside a quoted field.");
  if (cell.length || row.length) { row.push(cell.replace(/\r$/,"")); if(row.some(x=>x.trim()!=="")) rows.push(row); }
  if (!rows.length) return [];
  const headers=rows.shift().map(clean);
  return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i] ?? ""])));
}

function dateOnly(v) {
  const s=clean(v);
  const m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
  const d=new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0,10);
}

function winnerSide(row, a, b, schema) {
  const winner=clean(row[schema.winner]);
  const wa=keyName(winner), ka=keyName(a), kb=keyName(b);
  if (wa && (wa===ka || ["a","agent a","red","fighter a","1"].includes(wa))) return "fighter_a_win";
  if (wa && (wa===kb || ["b","agent b","blue","fighter b","2"].includes(wa))) return "fighter_b_win";
  if (/^(draw|tie|majority draw|split draw)$/i.test(winner)) return "draw";
  if (/no contest|no-contest|overturned|^nc$/i.test(winner)) return "no_contest";
  const oa=clean(row[schema.outcomeA]).toLowerCase(), ob=clean(row[schema.outcomeB]).toLowerCase();
  if (oa==="w" || oa==="win" || oa==="winner") return "fighter_a_win";
  if (ob==="w" || ob==="win" || ob==="winner") return "fighter_b_win";
  if (oa==="d" || ob==="d" || oa==="draw" || ob==="draw") return "draw";
  if (/^(nc|no contest)$/i.test(oa) || /^(nc|no contest)$/i.test(ob)) return "no_contest";
  return "unknown";
}

export const SCHEMAS = {
  irw: {
    fighterA:"agent_a", fighterB:"agent_b", date:"date", winner:"winner",
    method:"method", round:"finish_round", time:null, division:"weight_class",
    title:"title_fight", event:null, url:null
  },
  bair: {
    fighterA:"header_fighter_a_name", fighterB:"header_fighter_b_name",
    date:"event_date_iso", winner:"header_winner_name",
    outcomeA:"header_fighter_a_outcome", outcomeB:"header_fighter_b_outcome",
    method:"header_finish_details_detailed", round:"header_round_detailed",
    time:"header_time_detailed", division:"weight_class",
    title:"title_fight", event:"event_name", url:"fight_stats_page_url"
  }
};

export function normalizeBout(row, schemaName, sourceName, sourceLicense, rowNumber) {
  const schema=SCHEMAS[schemaName];
  if (!schema) throw new Error(`Unknown CSV schema: ${schemaName}`);
  const sourceA=clean(row[schema.fighterA]), sourceB=clean(row[schema.fighterB]);
  const date=dateOnly(row[schema.date]);
  if (!sourceA || !sourceB || !date || keyName(sourceA)===keyName(sourceB)) {
    return {error:"missing_or_invalid_identity_or_date",rowNumber,row};
  }
  const ordered=[{name:sourceA,key:keyName(sourceA)},{name:sourceB,key:keyName(sourceB)}]
    .sort((x,y)=>x.key.localeCompare(y.key));
  const fighterA=ordered[0].name, fighterB=ordered[1].name;
  const division=clean(row[schema.division]);
  const canonicalKey=[date,...ordered.map(x=>x.key),keyName(division)].join("|");
  const sourceOutcome=winnerSide(row,sourceA,sourceB,schema);
  const outcomeCategory=keyName(sourceA)===keyName(fighterA)
    ? sourceOutcome
    : sourceOutcome==="fighter_a_win"?"fighter_b_win"
    : sourceOutcome==="fighter_b_win"?"fighter_a_win":sourceOutcome;
  const winnerFighterName=sourceOutcome==="fighter_a_win"?sourceA:sourceOutcome==="fighter_b_win"?sourceB:null;
  const sourceUrl=schema.url?clean(row[schema.url]):"";
  const roundText=clean(row[schema.round]);
  const roundMatch=roundText.match(/\d+/);
  const titleText=clean(row[schema.title]);
  return {
    canonicalKey,eventName:schema.event?clean(row[schema.event])||null:null,eventDate:date,
    fighterA,fighterB,winnerFighterName,outcomeCategory,
    method:clean(row[schema.method])||null,finishRound:roundMatch?Number(roundMatch[0]):null,
    finishTime:schema.time?clean(row[schema.time])||null:null,
    weightClass:division||null,
    titleFight:titleText?(/^(true|1|yes|y)$/i.test(titleText)):null,
    sourceName,sourceLicense,sourceUrl:sourceUrl||null,
    sourceRecordId:sourceUrl||canonicalKey,
    rawPayload:row,rowNumber
  };
}

export function buildImportReport(csvText,schemaName,sourceName,sourceLicense) {
  const rows=parseCsv(csvText);
  const normalized=rows.map((r,i)=>normalizeBout(r,schemaName,sourceName,sourceLicense,i+2));
  const errors=normalized.filter(x=>x.error);
  const bouts=normalized.filter(x=>!x.error);
  const duplicateKeys=new Map();
  for (const bout of bouts) duplicateKeys.set(bout.canonicalKey,(duplicateKeys.get(bout.canonicalKey)||0)+1);
  const duplicates=[...duplicateKeys].filter(([,n])=>n>1).map(([key,count])=>({key,count}));
  const unknownOutcomes=bouts.filter(b=>b.outcomeCategory==="unknown");
  const missingMethod=bouts.filter(b=>!b.method);
  return {
    schema:schemaName,sourceName,totalRows:rows.length,validRows:bouts.length,
    invalidRows:errors.length,duplicateCanonicalKeys:duplicates.length,
    unknownOutcomes:unknownOutcomes.length,missingMethods:missingMethod.length,
    errors,duplicates,
    unknownOutcomeRows:unknownOutcomes.map(b=>({rowNumber:b.rowNumber,fighterA:b.fighterA,fighterB:b.fighterB,date:b.eventDate})),
    bouts
  };
}
