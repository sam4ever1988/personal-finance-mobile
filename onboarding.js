(function () {
  'use strict';

  const VERSION = 'v1';
  const STEPS = [
    ['Welcome to My Finance', 'The guide will open each page and point to a useful place to start. Nothing is changed or saved while you follow it. You can skip at any time.', 'executive', ''],
    ['Dashboard', 'Start here each day. Review the cash flow and upcoming payments, then check the account and card summaries below.', 'executive', '#execUpcoming'],
    ['Cash & Credit', 'Check your bank accounts and available card credit. Use Transfer Between Accounts only after choosing the actual source and destination.', 'accounts', '#cashBankGrid'],
    ['Transactions', 'This is your register of income, spending, and transfers. Try the date and account filters; use Add Transaction when an item is missing.', 'transactions', '.txFiltersCore'],
    ['Monthly Income & Payment Plan', 'Enter the income you expect and the payments you plan. Save a plan for the correct month; mark a payment only when it really happens.', 'incomeplan', '#saveIncomePlan'],
    ['Cash & Other Outgoings', 'Add bills and other payments here. You can record a partial payment and track what remains.', 'outgoings', ''],
    ['Installments', 'Add an installment plan with the correct card and schedule. Review its remaining payments before confirming one.', 'installments', ''],
    ['Import Statements', 'Choose the correct bank or card before importing. Review dates, duplicates, and uncategorized items after the import.', 'importstatements', ''],
    ['Investments', 'Record holdings and trades here. A dividend waits for your confirmation before cash changes. Automatic Saudi announcement discovery is not yet active.', 'investments', ''],
    ['Personal Assets', 'Add assets such as gold and review their contribution to your financial position.', 'assets', ''],
    ['Airbnb / Rental', 'Add a unit and booking here. Enter the guest payment currency, inspect the SAR rate, and mark payment received only after it arrives.', 'rental', '#rentalBookingBtn'],
    ['Reports', 'Choose dates, account, card, category, or type to focus the charts. Press Reset when you want the complete view again.', 'reports', '.reportFilters'],
    ['Settings and sync', 'Set up your accounts and cards in Settings. On another device, inspect Data Reconciliation before replacing local changes.', 'financeSettings', '#addCustomBank']
  ];
  let current = 0;
  let visible = false;
  let pending = false;
  let dialog;
  let guideButton;
  let previousFocus;
  let highlight;
  let highlightTimer;

  const userId = () => window.financeActiveUserId;
  const client = () => typeof cloudClient !== 'undefined' ? cloudClient : null;
  const key = () => 'pf_onboarding_' + VERSION + '_' + userId();
  const ready = () => !!userId() && !!document.querySelector('#financeAccessGate.financeGateHidden') && !document.body.classList.contains('financeAccessLocked');
  const completedInCloud = () => !!window.__financeTourUserMetadata?.['my_finance_tour_' + VERSION];

  function render() {
    if (!dialog) return;
    const [title, description, page] = STEPS[current];
    dialog.querySelector('#financeTourCount').textContent = 'Step ' + (current + 1) + ' of ' + STEPS.length;
    dialog.querySelector('#financeTourTitle').textContent = title;
    dialog.querySelector('#financeTourDescription').textContent = description;
    dialog.classList.toggle('financeTourIntro', current === 0);
    dialog.querySelector('#financeTourBack').disabled = current === 0;
    dialog.querySelector('#financeTourNext').textContent = current === STEPS.length - 1 ? 'Finish' : 'Next';
    clearTimeout(highlightTimer);
    highlight.hidden = true;
    if (current === 0 || (typeof window.financeCanViewPage === 'function' && !window.financeCanViewPage(page))) return;
    if (typeof window.nav === 'function') window.nav(page);
    else document.querySelector('[data-page-jump="' + page + '"]')?.click();
    highlightTimer = setTimeout(() => positionHighlight(true), 180);
  }

  function positionHighlight(shouldScroll = false) {
    if (!visible || current === 0) return;
    const [, , page, selector] = STEPS[current];
    const active = document.querySelector('#' + page + '.view.active');
    const target = (selector && active?.querySelector(selector)) || active?.querySelector('h1,h2,.sectionTitle,.panelTitle') || active;
    if (!target) { highlight.hidden = true; return; }
    if (shouldScroll === true) target.scrollIntoView({ block: 'center', behavior: 'instant' });
    const box = target.getBoundingClientRect();
    if (!box.width || !box.height) { highlight.hidden = true; return; }
    highlight.hidden = false;
    highlight.style.cssText = 'top:' + Math.max(4, box.top - 5) + 'px;left:' + Math.max(4, box.left - 5) + 'px;width:' + Math.min(innerWidth - Math.max(4, box.left - 5) - 4, box.width + 10) + 'px;height:' + Math.min(innerHeight - Math.max(4, box.top - 5) - 4, box.height + 10) + 'px';
  }

  async function remember() {
    if (!userId()) return;
    try { window.localStorage.setItem(key(), '1'); } catch (_) {}
    // Supabase Auth user metadata follows the person across devices. A failed
    // metadata write keeps the local completion and can be retried on replay.
    try {
      if (client()) {
        const { error } = await client().auth.updateUser({ data: { ['my_finance_tour_' + VERSION]: true } });
        if (error) throw error;
        window.__financeTourUserMetadata = { ...(window.__financeTourUserMetadata || {}), ['my_finance_tour_' + VERSION]: true };
      }
    } catch (error) { console.warn('Tour completion could not sync to account', error); }
  }

  function close(save) {
    visible = false;
    dialog.hidden = true;
    highlight.hidden = true;
    clearTimeout(highlightTimer);
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', positionHighlight);
    window.removeEventListener('scroll', positionHighlight, true);
    if (save) void remember();
    (previousFocus?.isConnected ? previousFocus : guideButton)?.focus();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
  }

  function open() {
    if (!ready()) return;
    previousFocus = document.activeElement;
    current = 0;
    visible = true;
    dialog.hidden = false;
    render();
    dialog.querySelector('#financeTourSkip').focus();
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', positionHighlight);
    window.addEventListener('scroll', positionHighlight, true);
  }

  function mount() {
    if (dialog) return;
    const css = document.createElement('style');
    css.textContent = `
      .financeGuideButton{position:fixed;right:18px;bottom:18px;z-index:9000;border:1px solid #83cbbd;border-radius:999px;background:#0c3b4a;color:white;padding:10px 16px;font:700 14px system-ui;box-shadow:0 6px 20px #0004;cursor:pointer}
      .financeGuideButton[hidden],.financeTourBackdrop[hidden],.financeTourHighlight[hidden]{display:none!important}
      .financeTourBackdrop{position:fixed;inset:0;z-index:100000;pointer-events:none;display:flex;align-items:flex-end;justify-content:center;padding:18px}
      .financeTourBackdrop.financeTourIntro{background:#071e2ac9;pointer-events:auto;align-items:center}
      .financeTourHighlight{position:fixed;z-index:99999;border:3px solid #f0b344;border-radius:12px;box-shadow:0 0 0 5px #0b594b77;pointer-events:none;transition:top .15s,left .15s,width .15s,height .15s}
      .financeTourCard{pointer-events:auto;width:min(100%,510px);max-height:calc(100vh - 36px);overflow:auto;background:#fff;color:#173442;border-radius:18px;padding:24px;box-shadow:0 24px 60px #0006;font:15px/1.5 system-ui}
      .financeTourCard h2{font:700 25px/1.2 system-ui;margin:8px 0 12px}.financeTourCard p{margin:0 0 20px}
      .financeTourCount{font-size:13px;color:#477365;font-weight:700}.financeTourActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .financeTourActions button{border:1px solid #9cbab5;background:#fff;color:#123c41;border-radius:9px;padding:9px 13px;font:700 14px system-ui;cursor:pointer}
      .financeTourActions button.primary{background:#0c665d;border-color:#0c665d;color:white}.financeTourActions button:disabled{opacity:.5;cursor:default}
      .financeTourActions button:focus-visible,.financeGuideButton:focus-visible{outline:3px solid #e9ae34;outline-offset:2px}
      @media(max-width:600px){.financeGuideButton{right:12px;bottom:12px}.financeTourCard{padding:18px}.financeTourBackdrop{padding:10px}}
    `;
    document.head.appendChild(css);
    guideButton = document.createElement('button');
    guideButton.className = 'financeGuideButton';
    guideButton.type = 'button';
    guideButton.textContent = 'Guide';
    guideButton.setAttribute('aria-label', 'Open new user guide');
    guideButton.hidden = true;
    guideButton.onclick = open;
    document.body.appendChild(guideButton);
    highlight = document.createElement('div');
    highlight.className = 'financeTourHighlight';
    highlight.setAttribute('aria-hidden', 'true');
    highlight.hidden = true;
    document.body.appendChild(highlight);
    dialog = document.createElement('div');
    dialog.className = 'financeTourBackdrop';
    dialog.hidden = true;
    dialog.innerHTML = '<section class="financeTourCard" role="dialog" aria-modal="false" aria-labelledby="financeTourTitle" aria-describedby="financeTourDescription"><div class="financeTourCount" id="financeTourCount"></div><h2 id="financeTourTitle"></h2><p id="financeTourDescription"></p><div class="financeTourActions"><button type="button" id="financeTourSkip">Skip guide</button><button type="button" id="financeTourBack">Back</button><button type="button" class="primary" id="financeTourNext">Next</button></div></section>';
    dialog.querySelector('#financeTourSkip').onclick = () => close(true);
    dialog.querySelector('#financeTourBack').onclick = () => { current--; render(); };
    dialog.querySelector('#financeTourNext').onclick = () => current === STEPS.length - 1 ? close(true) : (current++, render());
    document.body.appendChild(dialog);
  }

  async function check() {
    mount();
    guideButton.hidden = !ready();
    if (!ready() || visible || pending || window.localStorage.getItem(key()) === '1') return;
    pending = true;
    try {
      if (client()) {
        const { data } = await client().auth.getUser();
        if (!ready() || data?.user?.id !== userId()) return;
        window.__financeTourUserMetadata = data.user.user_metadata || {};
      }
      if (!completedInCloud() && window.localStorage.getItem(key()) !== '1') open();
      else window.localStorage.setItem(key(), '1');
    } finally { pending = false; }
  }

  const observer = new MutationObserver(() => { void check(); });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  observer.observe(document.getElementById('financeAccessGate'), { attributes: true, attributeFilter: ['class'] });
  void check();
})();
