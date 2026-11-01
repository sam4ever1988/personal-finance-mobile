const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync(__dirname+'/app-05.js','utf8');
const start=source.indexOf('function statementWorkbookBytes('),end=source.indexOf('\nfunction workbookRows(',start);
const c={Uint8Array,DataView};vm.createContext(c);vm.runInContext(source.slice(start,end),c);
function archive(){
 const local=Buffer.alloc(31);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(1,26);local[30]=97;
 const directory=Buffer.alloc(47);directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(1,28);directory[46]=97;
 const footer=Buffer.alloc(22);footer.writeUInt32LE(0x06054b50);footer.writeUInt16LE(1,8);footer.writeUInt16LE(1,10);footer.writeUInt32LE(directory.length,12);footer.writeUInt32LE(local.length,16);
 return Buffer.concat([local,directory,footer]);
}
const good=archive(),parse=b=>Buffer.from(c.statementWorkbookBytes(b));
assert.deepEqual(parse(good),good);
const damaged=Buffer.concat([good,Buffer.alloc(4085),Buffer.from('504b0506000000000e000e','hex')]);
assert.deepEqual(parse(damaged),good);
const offset=Buffer.concat([Buffer.alloc(10),damaged,Buffer.alloc(10)]).subarray(10,10+damaged.length);assert.deepEqual(parse(offset),good);
const truncated=good.subarray(0,good.length-10);assert.deepEqual(parse(truncated),truncated);
const bad=Buffer.from(damaged);bad.writeUInt32LE(9999,31+42);assert.deepEqual(parse(bad),bad);
const badDirectory=Buffer.from(damaged);badDirectory.writeUInt32LE(99,good.length-22+12);assert.deepEqual(parse(badDirectory),badDirectory);
const legacy=Buffer.from('d0cf11e0a1b11ae1','hex');assert.deepEqual(parse(legacy),legacy);
const commented=Buffer.concat([good,Buffer.from('valid comment PK\x05\x06')]);commented.writeUInt16LE(commented.length-good.length,good.length-2);assert.deepEqual(parse(commented),commented);
console.log('PASS: appended duplicate tail, clean ZIP, ZIP comment, offset buffer, truncated ZIP, invalid directory/local entry and legacy XLS');
if(process.argv[2]){
 const XLSX=require(process.argv[3]),input=fs.readFileSync(process.argv[2]);
 assert.throws(()=>XLSX.read(input,{type:'buffer'}),/ZIP/);
 const repaired=parse(input),wb=XLSX.read(repaired,{type:'buffer',cellDates:true});
 assert(repaired.length<input.length);assert(wb.SheetNames.length>0);
 console.log('Uploaded workbook: original ZIP failure reproduced; recovered',wb.SheetNames.length,'sheets; ignored',input.length-repaired.length,'trailing bytes');
}
