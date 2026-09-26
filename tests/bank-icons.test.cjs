const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app-02.js'),'utf8');
const functions=source.slice(source.indexOf('const CENTRAL_BANK_LOGO_BANKS='),source.indexOf('function paymentStatusClass('));
const context={URL,escapeHtml:value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]))};
vm.createContext(context);
vm.runInContext('const BANK_LOGO_URLS={"Al Rajhi Bank":"https://official.example/logo.svg"};\n'+functions,context);

assert.equal(context.bankLogoURL({bank:'STC Bank'}),'https://www.stcbank.com.sa/favicon.ico');
assert.equal(context.bankLogoURL({bank:'New Bank',website:'newbank.example/path'}),'https://newbank.example/favicon.ico');
assert.equal(context.bankLogoURL({bank:'New Bank',logo:'https://newbank.example/brand/logo.png'}),'https://newbank.example/brand/logo.png');
assert.equal(context.bankLogoURL({bank:'New Bank',website:'javascript:alert(1)'}),'');
assert.equal(context.bankLogoURL({bank:'New Bank',website:'https://user:pass@bank.example'}),'');
assert.match(context.bankLogoHTML({bank:'New Bank',website:'newbank.example'}),/domain=newbank\.example&amp;sz=128/);
assert.match(context.bankLogoHTML({bank:'New Bank',website:'newbank.example'}),/this\.style\.display='none'/);
assert.match(context.bankLogoHTML({bank:'<Bank>',website:'javascript:alert(1)'}),/&lt;Bank&gt;/);
console.log('Known banks, custom website icons, saved logos, unsafe URLs and fallback passed.');
