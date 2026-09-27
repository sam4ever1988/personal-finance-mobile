(function () {
  'use strict';

  const VERSION = 'v1';
  const STEPS = [
    ['Welcome to My Finance', 'This short tour shows where to find each function. You can skip it at any time and reopen it with the Guide button.', 'executive'],
    ['Dashboard', 'See your cash flow, upcoming payments, available credit, investments, assets, and overall financial position.', 'executive'],
    ['Cash & Credit', 'Review bank balances, credit card usage, statement obligations, and transfers between accounts.', 'accounts'],
    ['Transactions', 'Add or correct income, spending, transfers, and card payments. Check the account and card before saving.', 'transactions'],
    ['Monthly plan and outgoings', 'Plan monthly income and payments, track bills and partial payments, and confirm each payment when it happens.', 'incomeplan'],
    ['Installments', 'Track installment schedules, remaining payments, and the credit card linked to each plan.', 'installments'],
    ['Import Statements', 'Import a bank or card statement, then review the account, dates, duplicates, and uncategorized transactions.', 'importstatements'],
    ['Investments', 'Record holdings, trades, and corporate actions. Confirm dividends or bonus shares before they change your balances. Automatic Saudi announcement discovery is not yet active.', 'investments'],
    ['Personal Assets', 'Track assets such as gold and see how they contribute to your financial position.', 'assets'],
    ['Airbnb / Rental', 'Manage units, bookings, expenses, payment status, and PHP, USD, or SAR booking values with an editable exchange rate.', 'rental'],
    ['Reports', 'Filter spending and income by date, account, card, category, subcategory, or type. Use Reset to return to the full view.', 'reports'],
    ['Settings and sync', 'Set up accounts and cards in Settings. On another device, inspect Data Reconciliation before replacing local changes with cloud data.', 'financeSettings']
  ];
  let current = 0;
  let visible = false;
  let pending = false;
  let dialog;
  let guideButton;
  let previousFocus;

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
    const pageButton = dialog.querySelector('#financeTourPage');
    pageButton.hidden = current === 0 || (typeof window.financeCanViewPage === 'function' && !window.financeCanViewPage(page));
    dialog.querySelector('#financeTourBack').disabled = current === 0;
    dialog.querySelector('#financeTourNext').textContent = current === STEPS.length - 1 ? 'Finish' : 'Next';
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
    document.removeEventListener('keydown', onKeyDown);
    if (save) void remember();
    (previousFocus?.isConnected ? previousFocus : guideButton)?.focus();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button:not([hidden]):not(:disabled)')];
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function open() {
    if (!ready()) return;
    previousFocus = document.activeElement;
    current = 0;
    visible = true;
    render();
    dialog.hidden = false;
    dialog.querySelector('#financeTourSkip').focus();
    document.addEventListener('keydown', onKeyDown);
  }

  function mount() {
    if (dialog) return;
    const css = document.createElement('style');
    css.textContent = `
      .financeGuideButton{position:fixed;right:18px;bottom:18px;z-index:9000;border:1px solid #83cbbd;border-radius:999px;background:#0c3b4a;color:white;padding:10px 16px;font:700 14px system-ui;box-shadow:0 6px 20px #0004;cursor:pointer}
      .financeGuideButton[hidden],.financeTourBackdrop[hidden]{display:none!important}
      .financeTourBackdrop{position:fixed;inset:0;z-index:100000;background:#071e2ac9;display:grid;place-items:center;padding:18px}
      .financeTourCard{width:min(100%,510px);max-height:calc(100vh - 36px);overflow:auto;background:#fff;color:#173442;border-radius:18px;padding:24px;box-shadow:0 24px 60px #0006;font:15px/1.5 system-ui}
      .financeTourCard h2{font:700 25px/1.2 system-ui;margin:8px 0 12px}.financeTourCard p{margin:0 0 20px}
      .financeTourCount{font-size:13px;color:#477365;font-weight:700}.financeTourActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      .financeTourActions button{border:1px solid #9cbab5;background:#fff;color:#123c41;border-radius:9px;padding:9px 13px;font:700 14px system-ui;cursor:pointer}
      .financeTourActions button.primary{background:#0c665d;border-color:#0c665d;color:white}.financeTourActions button:disabled{opacity:.5;cursor:default}
      .financeTourActions button:focus-visible,.financeGuideButton:focus-visible{outline:3px solid #e9ae34;outline-offset:2px}
      @media(max-width:600px){.financeGuideButton{right:12px;bottom:12px}.financeTourCard{padding:20px}}
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
    dialog = document.createElement('div');
    dialog.className = 'financeTourBackdrop';
    dialog.hidden = true;
    dialog.innerHTML = '<section class="financeTourCard" role="dialog" aria-modal="true" aria-labelledby="financeTourTitle" aria-describedby="financeTourDescription"><div class="financeTourCount" id="financeTourCount"></div><h2 id="financeTourTitle"></h2><p id="financeTourDescription"></p><div class="financeTourActions"><button type="button" id="financeTourSkip">Skip guide</button><button type="button" id="financeTourPage">Open this page</button><button type="button" id="financeTourBack">Back</button><button type="button" class="primary" id="financeTourNext">Next</button></div></section>';
    dialog.querySelector('#financeTourSkip').onclick = () => close(true);
    dialog.querySelector('#financeTourBack').onclick = () => { current--; render(); };
    dialog.querySelector('#financeTourNext').onclick = () => current === STEPS.length - 1 ? close(true) : (current++, render());
    dialog.querySelector('#financeTourPage').onclick = () => {
      const page = STEPS[current][2];
      if (typeof window.nav === 'function') window.nav(page);
      else document.querySelector('[data-page-jump="' + page + '"]')?.click();
    };
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
