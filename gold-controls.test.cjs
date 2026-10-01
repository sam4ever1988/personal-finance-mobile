const assert=require('assert/strict');const fs=require('fs'),path=require('path'),os=require('os');const {chromium}=require(process.env.FINANCE_TEST_PLAYWRIGHT||'playwright');const folder=fs.mkdtempSync(path.join(os.tmpdir(),'finance-gold-test-'));let html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'');const css=fs.readFileSync(path.join(__dirname,'styles.css'),'utf8')+fs.readFileSync(path.join(__dirname,'layouts.css'),'utf8');const code=Array.from({length:12},(_,i)=>fs.readFileSync(path.join(__dirname,'app-'+String(i+1).padStart(2,'0')+'.js'),'utf8')).join('\n');const setup="window.financeActiveUserId='test';window.financeWorkspaceUserId='test';window.financeWorkspaceChoices=[{id:'test',name:'Test',own:true}];window.financeCanViewPage=()=>true;window.financeCanEditPage=()=>true;window.fetch=async()=>{throw Error('Offline verification')};";const preview=path.join(folder,'preview.html');fs.writeFileSync(preview,html.replace('</head>','<style>'+css+'</style></head>').replace('</body>','<script>'+setup+'</script><script>'+code.replace(/<\/script/gi,'<\\/script')+'</script></body>'));(async()=>{const b=await chromium.launch({executablePath:process.env.FINANCE_TEST_CHROMIUM||undefined,args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1600,height:1100}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('file://'+preview);await p.waitForTimeout(200);await p.evaluate(()=>{document.body.classList.remove('financeAccessLocked');document.getElementById('financeAccessGate')?.remove();document.head.insertAdjacentHTML('beforeend','<style>.app{filter:none!important;pointer-events:auto!important}</style>');window.goldRequestedRanges=[];window.fetch=async(url)=>{window.goldRequestedRanges.push(String(url));return ({ok:true,json:async()=>({points:[{t:'2026-10-01T06:00:00Z',price24k:480,usdOz:3980},{t:'2026-10-01T09:00:00Z',price24k:500,usdOz:4140},{t:'2026-10-01T12:00:00Z',price24k:490,usdOz:4060}],price24k:490,updatedAt:new Date().toISOString(),source:'Test fixture'})});};nav('assets');document.querySelector('#goldRangeControls [data-mode="7d"]').click();});await p.locator('.goldCompareSvg').waitFor();assert.equal(await p.locator('.goldCompareSvg polyline:not(.goldLineHit)').count(),4);const svg=p.locator('.goldCompareSvg'),r=await svg.boundingBox();await p.mouse.move(r.x+r.width*.52,r.y+r.height*.4);await p.waitForTimeout(50);assert(await p.locator('#goldHoverTooltip').isVisible());const text=await p.locator('#goldHoverTooltip').innerText();assert(text.includes('500.00'));assert(text.includes('458.33'));assert(text.includes('437.50'));assert(text.includes('375.00'));assert(text.includes('Riyadh'));await svg.focus();await p.keyboard.press('Home');assert((await p.locator('#goldHoverTooltip').innerText()).includes('480.00'));await p.keyboard.press('End');assert((await p.locator('#goldHoverTooltip').innerText()).includes('490.00'));await p.keyboard.press('Escape');assert(!(await p.locator('#goldHoverTooltip').isVisible()));await p.locator('#goldChartUnit').selectOption('ounce');assert.equal(await p.locator('.goldCompareSvg polyline:not(.goldLineHit)').count(),1);await svg.focus();await p.keyboard.press('Home');assert((await p.locator('#goldHoverTooltip').innerText()).includes('USD 3,980.00'));await p.locator('#goldChartUnit').selectOption('gram');await p.evaluate(()=>hardenAllActionControls());await p.locator('#goldPurityControls [data-mode="18"]').click();assert.equal(await p.locator('#goldPurityControls .selected').getAttribute('data-mode'),'18');assert.equal(await p.locator('.goldCompareSvg polyline:not(.goldLineHit)').count(),4);
await p.evaluate(()=>hardenAllActionControls());
for(const mode of ['24h','7d','1m','1y']){
 await p.locator('#goldRangeControls [data-mode="'+mode+'"]').click();
 assert.equal(await p.locator('#goldRangeControls .selected').getAttribute('data-mode'),mode);
 await p.locator('.goldCompareSvg').waitFor();
 assert(await p.evaluate(mode=>window.goldRequestedRanges.includes('/api/gold?range='+mode),mode));
}
for(const mode of ['24','22','21','18']){
 await p.locator('#goldPurityControls [data-mode="'+mode+'"]').click();
 assert.equal(await p.locator('#goldPurityControls .selected').getAttribute('data-mode'),mode);
 assert.equal(await p.locator('.goldCompareSvg polyline[data-purity="'+mode+'"]:not(.goldLineHit)').getAttribute('stroke-width'),'3.5');
}
for(const mode of ['sales','zakat','active']){
 await p.locator('#goldAssetTabs [data-mode="'+mode+'"]').click();
 assert.equal(await p.locator('#goldAssetTabs .selected').getAttribute('data-mode'),mode);
 assert.equal(await p.locator('.goldHistoryPart:visible').count(),1);
 assert.equal(await p.locator('.goldHistoryPart:visible').getAttribute('data-gold-tab'),mode);
}
await p.evaluate(()=>{renderGoldAssets();hardenAllActionControls();});
await p.locator('#goldAssetTabs [data-mode="sales"]').click();
assert.equal(await p.locator('.goldHistoryPart:visible').getAttribute('data-gold-tab'),'sales');
await p.evaluate(()=>{window.financePagePermissions={assets:'view'};nav('assets');hardenAllActionControls();});
assert.equal(await p.locator('#addGoldAsset').isDisabled(),true);
assert.equal(await p.locator('#manualGoldPrice').isDisabled(),true);
await p.locator('#goldAssetTabs [data-mode="zakat"]').click();
assert.equal(await p.locator('.goldHistoryPart:visible').getAttribute('data-gold-tab'),'zakat');
await p.locator('#goldPurityControls [data-mode="21"]').click();
assert.equal(await p.locator('#goldPurityControls .selected').getAttribute('data-mode'),'21');
await p.locator('#goldRangeControls [data-mode="24h"]').click();
assert.equal(await p.locator('#goldRangeControls .selected').getAttribute('data-mode'),'24h');
await p.evaluate(()=>{window.financeReadOnlyObserver?.disconnect();window.financePagePermissions={};nav('reports');hardenAllActionControls();});
await p.locator('#reportPeriodControls [data-mode="monthly"]').click();
assert.equal(await p.locator('#reportPeriodControls .selected').getAttribute('data-mode'),'monthly');
await p.locator('#reportExploreControls [data-mode="subcategory"]').click();
assert.equal(await p.locator('#reportExploreControls .selected').getAttribute('data-mode'),'subcategory');
await p.evaluate(()=>{nav('transactions');hardenAllActionControls();});
await p.locator('#txPeriodControls [data-mode="daily"]').click();
assert.equal(await p.locator('#txPeriodControls .selected').getAttribute('data-mode'),'daily');
await p.evaluate(()=>nav('assets'));
await p.setViewportSize({width:390,height:850});await p.locator('#goldAssetTabs [data-mode="active"]').click();assert.equal(await p.locator('.goldHistoryPart:visible').getAttribute('data-gold-tab'),'active');await p.locator('#goldPurityControls [data-mode="18"]').click();assert.equal(await p.locator('#goldPurityControls .selected').getAttribute('data-mode'),'18');await p.locator('#goldRangeControls [data-mode="7d"]').click();assert.equal(await p.locator('#goldRangeControls .selected').getAttribute('data-mode'),'7d');await svg.dispatchEvent('pointerdown',{clientX:100,clientY:300,pointerType:'touch'});assert(await p.locator('#goldHoverTooltip').isVisible());await svg.dispatchEvent('pointerleave',{pointerType:'touch'});assert(await p.locator('#goldHoverTooltip').isVisible());assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);await p.setViewportSize({width:1600,height:1100});console.log('PASS: real hardened-button clicks for all four ranges, four purities, three history tabs, rerender, view-only mutation locks, Reports/Transactions filters, hover prices and mobile interaction; no browser errors');await b.close();fs.rmSync(folder,{recursive:true,force:true});})().catch(error=>{console.error(error);process.exitCode=1;});
