const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

let rendered=[];
const settings=read('app-06.js');
const settingsCode=settings.slice(settings.indexOf('function renderFinanceSettings('),settings.indexOf('function addLoanSetting('));
const settingsContext={financeSettingsEditing:true,financeSettings:{loans:[]},document:{getElementById:()=>({classList:{contains:()=>true}})},
 $:()=>null,rollAllLoansToMonth:()=>{},currentYearMonth:()=>'',renderSavedLoanSummary:()=>{},
 renderCustomBanks:()=>rendered.push('banks'),renderCustomCreditCards:()=>rendered.push('cards')};
vm.createContext(settingsContext);vm.runInContext(settingsCode,settingsContext);
settingsContext.renderFinanceSettings(true);
assert.deepEqual(rendered,['banks','cards']);

const app=read('app-08.js');
const accountCode=app.slice(app.indexOf('function editableFinanceBanks('),app.indexOf('function addCustomBank('));
const bank={id:'existing-2989',bank:'Existing Bank',name:'Current',ending:'2989',type:'bank',balance:400};
const list={innerHTML:'',querySelectorAll:()=>[]};
let action;
const context={accounts:[bank,{id:'cash-wallet',bank:'Cash',type:'bank'}],customBanks:[],
 $:()=>list,escapeHtml:String,money:x=>String(x),adjustedBankBalance:x=>x.balance,
 openUnifiedAction:cfg=>action=cfg,bankWebsiteOrigin:x=>x?'https://bank.example':'',
 localStorage:{setItem(){}},syncCustomAccountsIntoAccounts(){},setTrackedBankBalance(){},saveLocal(){},scheduleRecordPush(){},refreshAccountDependentUI(){}};
vm.createContext(context);vm.runInContext(accountCode,context);
context.renderCustomBanks();assert.match(list.innerHTML,/Existing Bank/);assert.doesNotMatch(list.innerHTML,/Cash \/ Wallet/);
context.editCustomBank(bank.id);
assert.equal(action.fields.find(f=>f.name==='website').label,'Bank Website (optional, for automatic icon)');
action.submit({bank:'Existing Bank',name:'Current',ending:'2989',balance:'400',website:'bank.example'});
assert.equal(context.customBanks.length,1);
assert.equal(context.customBanks[0].id,bank.id);
assert.equal(context.customBanks[0].website,'https://bank.example');
console.log('Settings renders existing banks and cards; editing a legacy bank preserves its ID.');
