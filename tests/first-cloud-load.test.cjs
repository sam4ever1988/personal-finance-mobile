const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../app-06.js'),'utf8');
const start=source.indexOf('function sectionAffectsPage(');
const end=source.indexOf('function applyRecordSyncDeltaRows(',start);
assert.ok(start>=0&&end>start);
let rendered=0;
const context={
 activeViewId:()=> 'executive',
 captureReviewState:()=>({x:0,y:0}),
 renderExecutiveDashboard:()=>{rendered++},
 restoreReviewControls:()=>{},
 requestAnimationFrame:()=>{},
 window:{scrollTo:()=>{}}
};
vm.createContext(context);
vm.runInContext(source.slice(start,end),context);
assert.equal(context.renderCurrentPageForSections(['income_plan','custom_banks','investments_holdings']),true);
assert.equal(rendered,1,'cloud data should repaint the active Executive Overview');
assert.equal(context.renderCurrentPageForSections(['import_history']),false);
assert.equal(rendered,1,'unrelated records should not cause a redraw');

const auth=fs.readFileSync(path.join(__dirname,'../app-07.js'),'utf8');
assert.match(auth,/field\.addEventListener\('keydown',event=>\{\s*if\(event\.key!=='Enter'\|\|event\.isComposing\)return;\s*event\.preventDefault\(\);\s*signIn\?\.click\(\)/);
console.log('Cloud load repaints Executive Overview; Enter invokes sign-in.');
