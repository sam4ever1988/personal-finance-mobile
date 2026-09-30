const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(require('node:path').join(__dirname,'..','app-08.js'),'utf8');
const section=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
function fixture(admin=false){
 const nodes={},fields={},classes=new Set();let writes=0,sharedWrites=0,fail=false;
 const node=()=>({textContent:'',style:{},hidden:true,disabled:false,scrollIntoView(){this.scrolled=true;},setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];}});
 for(const id of ['unifiedActionModal','unifiedActionTitle','unifiedActionSub','unifiedActionSave','unifiedActionError','unifiedActionFields','unifiedActionForm'])nodes[id]=node();
 const modal=nodes.unifiedActionModal;modal.classList={add:x=>classes.add(x),remove:x=>classes.delete(x)};modal.querySelectorAll=()=>[];
 const form=nodes.unifiedActionForm;form.querySelector=q=>fields[q.match(/name="([^"]+)"/)[1]];form.addEventListener=()=>{};form.removeEventListener=()=>{};
 const ctx=vm.createContext({window:{financeIsOwner:admin},$:id=>nodes[id],escapeHtml:s=>String(s),statementFormats:[],saveV194Data:()=>writes++,renderStatementFormatsV268:()=>{},FormData:class{constructor(f){this.f=f;}entries(){return Object.entries(this.f.values);}},publishSharedStatementTemplate:async()=>{sharedWrites++;if(fail)throw Error('Network test failure');}});
 vm.runInContext(section('function uaField','function editableFinanceBanks'),ctx);
 vm.runInContext(section('function goldActionError','function goldActionSources'),ctx);
 vm.runInContext(section('function openStatementFormatBuilderV268','const _renderStatementFormatsV268Legacy'),ctx);
 function submit(values){form.values=values;for(const k of Object.keys(values))fields[k]??=node();form.onsubmit({preventDefault(){},currentTarget:form});}
 return {ctx,nodes,classes,submit,writes:()=>writes,sharedWrites:()=>sharedWrites,setFail:()=>{fail=true;}};
}
const values={name:'Generic CSV',fileType:'CSV',headerRow:'1',dataStartRow:'2',dateColumn:'A',descriptionColumn:'B',amountColumn:'',debitColumn:'',creditColumn:''};
(async()=>{
 const privateSave=fixture();privateSave.ctx.openStatementFormatBuilderV268();
 privateSave.submit(values);
 assert.equal(privateSave.writes(),0);assert.equal(privateSave.classes.has('open'),true);
 assert.match(privateSave.nodes.unifiedActionError.textContent,/Enter the Amount/);assert.equal(privateSave.nodes.unifiedActionError.hidden,false);assert.equal(privateSave.nodes.unifiedActionError.scrolled,true);
 privateSave.submit({...values,amountColumn:'C'});
 assert.equal(privateSave.writes(),1);assert.equal(privateSave.ctx.statementFormats.length,1);assert.equal(privateSave.classes.has('open'),false);
 privateSave.ctx.openStatementFormatBuilderV268(privateSave.ctx.statementFormats[0]);privateSave.submit({...values,name:'Edited CSV',debitColumn:'C',creditColumn:'D'});
 assert.equal(privateSave.ctx.statementFormats.length,1);assert.equal(privateSave.ctx.statementFormats[0].name,'Edited CSV');
 const shared=fixture(true);shared.ctx.openStatementFormatBuilderV268();shared.submit({...values,amountColumn:'C',visibility:'shared'});
 assert.equal(shared.nodes.unifiedActionSave.disabled,true);assert.equal(shared.nodes.unifiedActionSave.textContent,'Saving…');
 shared.submit({...values,amountColumn:'C',visibility:'shared'});assert.equal(shared.sharedWrites(),1);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(shared.classes.has('open'),false);assert.equal(shared.nodes.unifiedActionSave.disabled,false);
 const rejected=fixture(true);rejected.setFail();rejected.ctx.openStatementFormatBuilderV268();rejected.submit({...values,amountColumn:'C',visibility:'shared'});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(rejected.classes.has('open'),true);assert.equal(rejected.nodes.unifiedActionSave.disabled,false);assert.match(rejected.nodes.unifiedActionError.textContent,/Network test failure/);
 const invalid=fixture();invalid.ctx.openStatementFormatBuilderV268();invalid.submit({...values,amountColumn:'1234'});assert.equal(invalid.writes(),0);assert.match(invalid.nodes.unifiedActionError.textContent,/column letters/);
 console.log('PASS: missing mapping error, private create/edit, shared save, double-click prevention, failed-save recovery and invalid columns');
})().catch(e=>{console.error(e);process.exitCode=1;});
