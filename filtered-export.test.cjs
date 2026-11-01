const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/app-05.js','utf8');
function fn(name){const start=source.indexOf('function '+name+'('),next=source.slice(start+1).search(/\nfunction /);assert(start>=0);return source.slice(start,next<0?source.length:start+1+next);}
const rows=[
 {account:'a',date:'2026-09-28',statementMonth:'2026-11',physicalCardEnding:'9345',description:'متجر, "Coffee"\nsecond line',amount:-17,manual:true},
 {account:'a',date:'2026-10-02',statementMonth:'2026-11',physicalCardEnding:'9345',description:'Refund',amount:3.5,imported:true,importedAt:'2026-10-03T12:00:00Z'},
 {account:'a',date:'2026-10-03',statementMonth:'2026-11',physicalCardEnding:'0955',description:'Other card',amount:-99},
 {account:'a',date:'2026-09-28',statementMonth:'2026-10',physicalCardEnding:'9345',description:'Other month',amount:-88},
 {account:'b',date:'2026-09-28',statementMonth:'2026-11',physicalCardEnding:'9345',description:'Other account',amount:-77}
];
let blob,link,clicked=0,removed=0,revoked=0,alerted=0;
const filter={month:'2026-11',physicalCard:'9345',fromDate:'',toDate:''};
const c={Blob,accountDetailTxFilter:filter,currentAccountDetailId:'a',liveCardTransactions:()=>rows,transactionPhysicalCardEnding:t=>t.physicalCardEnding,cardTransactionStatementMonth:(_,t)=>t.statementMonth,transactionImportedAt:t=>t.importedAt||'',accountName:id=>'Account '+id,account:()=>({ending:'0955'}),physicalCardLabelFor:(_,e)=>'Card •'+e,financeBaseCurrency:()=> 'SAR',URL:{createObjectURL:b=>{blob=b;return 'blob:test';},revokeObjectURL:()=>revoked++},document:{body:{appendChild:a=>link=a},createElement:()=>({click:()=>clicked++,remove:()=>removed++})},setTimeout:f=>f(),alert:()=>alerted++};
vm.createContext(c);for(const name of ['cardTransactionsForDetail','accountTransactionExportCSV','exportAccountFilteredTransactions'])vm.runInContext(fn(name),c);
(async()=>{
 const before=JSON.stringify(rows);
 let selected=c.cardTransactionsForDetail('a');assert.equal(selected.length,2);assert.equal(selected.reduce((s,t)=>s+t.amount,0),-13.5);
 c.exportAccountFilteredTransactions();assert.equal(clicked,1);assert.equal(removed,1);assert.equal(revoked,1);assert(link.download.includes('2026-11_card-9345'));
 const bytes=new Uint8Array(await blob.arrayBuffer());assert.deepEqual([...bytes.slice(0,3)],[239,187,191]);
 const csv=await blob.text();assert(csv.includes('"متجر, ""Coffee""\nsecond line"'));assert(csv.includes(',-17,"SAR"'));assert(csv.includes(',3.5,"SAR"'));assert(!csv.includes('Other card'));assert(!csv.includes('Other month'));assert(!csv.includes('Other account'));
 filter.fromDate='2026-09-28';filter.toDate='2026-09-28';assert.equal(c.cardTransactionsForDetail('a').length,1);c.exportAccountFilteredTransactions();assert(link.download.includes('from-2026-09-28_to-2026-09-28'));
 filter.fromDate='2026-11-01';filter.toDate='2026-11-30';assert.equal(c.cardTransactionsForDetail('a').length,0);const previous=clicked;c.exportAccountFilteredTransactions();assert.equal(clicked,previous);assert.equal(alerted,1);
 Object.assign(filter,{month:'',physicalCard:'',fromDate:'',toDate:''});assert.equal(c.cardTransactionsForDetail('a').length,4);
 const safe=c.accountTransactionExportCSV([{...rows[0],description:'=1+1',reference:'\t@SUM(1)',amount:-17}]);assert(safe.includes('"\'=1+1"'));assert(safe.includes('"\'\t@SUM(1)"'));assert(safe.includes(',-17,"SAR"'));
 assert.equal(JSON.stringify(rows),before);
 assert.equal((source.match(/id="detailTxExportFiltered"/g)||[]).length,2);assert(fn('bindDetailTransactionBulkActions').includes(".onclick=exportAccountFilteredTransactions"));
 console.log('PASS: account/month/card/date filter intersections, inclusive dates, clearing filters, empty results, numeric amounts, Arabic/BOM, quotes/newlines, spreadsheet formula protection, download filename, cleanup and no data mutation');
})().catch(e=>{console.error(e);process.exitCode=1;});
