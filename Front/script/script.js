// start = python -m http.server 3000       (o cmd tem que estar na pasta front)



const examples = {
  phishing: `Dear customer,

We have identified suspicious activity on your account. To avoid immediate blocking, please access the link below and confirm your bank details within 24 hours:
🔗 http://banco-seguro-verificacao.xyz/confirmar

If you do not complete the verification, your account will be permanently suspended.

Sincerely,
Security Team — Banco do Brasil`,

  prize: `CONGRATULATIONS!! 🎉🎉

You have been selected as the WINNER of the R$15,000.00 raffle!

To receive your prize, send your information (ID, full name, bank account) to WhatsApp: (11) 99999-0000

⚠️ Offer valid only TODAY. Don't miss out!

— National Promotion 2024`,

  safe: `Hello! Your order has been successfully shipped.

Tracking code: BR123456789BR
Estimated delivery: 3 to 5 business days

Track your order on the official Correios website: correios.com.br

If you have any questions, please access our customer service center on the app or website.

Thank you for your purchase!

— Magazine Store`
};

function loadExample(type) {
  document.getElementById('msg-input').value = examples[type];
  document.getElementById('error-msg').classList.remove('visible');
}

async function analyze() {
  const text = document.getElementById('msg-input').value.trim();
  if (!text) {
    showError('Please paste a message for review.');
    return;
  }

  document.getElementById('input-section').style.display = 'none';
  document.getElementById('loading').classList.add('visible');
  document.getElementById('result').classList.remove('visible');
  document.getElementById('error-msg').classList.remove('visible');

  try {
    const response = await fetch("https://phishdetector-5rk0.onrender.com/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }) //correct variable
    });

    if (!response.ok) throw new Error('API error: ' + response.status);

    const result = await response.json(); // One time only, and the item arrives ready-made.

    showResult(result);
  } catch (err) {
    document.getElementById('input-section').style.display = 'block';
    document.getElementById('loading').classList.remove('visible');
    showError('Error. Please check your connection and try again.');
    console.error(err);
  }
}

function showResult(r) {
  document.getElementById('loading').classList.remove('visible');

  const isPhish = r.verdict === 'phishing';
  const isSusp = r.verdict === 'suspeito';
  const cls = isPhish ? 'danger' : isSusp ? 'warn' : 'safe';

  const icons = { danger: '🚨', warn: '⚠️', safe: '✅' };
  const labels = { danger: 'PHISHING DETECTED', warn: 'SUSPICIOUS MESSAGE', safe: 'SECURE MESSAGE' };

  document.getElementById('verdict-indicator').className = `verdict-indicator ${cls}`;
  document.getElementById('verdict-tag').className = `verdict-tag ${cls}`;
  document.getElementById('verdict-tag').textContent = labels[cls];
  document.getElementById('verdict-title').textContent = `${icons[cls]} ${r.title}`;
  document.getElementById('verdict-summary').textContent = r.summary;

  const score = Math.min(100, Math.max(0, r.risk_score));
  const barClass = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  const pctEl = document.getElementById('risk-pct');
  const fillEl = document.getElementById('risk-bar-fill');

  pctEl.className = `risk-pct ${barClass}`;
  fillEl.className = `risk-bar-fill ${barClass}`;

  // Animate
  setTimeout(() => {
    fillEl.style.width = score + '%';
    let current = 0;
    const step = score / 40;
    const timer = setInterval(() => {
      current = Math.min(score, current + step);
      pctEl.textContent = Math.round(current) + '%';
      if (current >= score) clearInterval(timer);
    }, 20);
  }, 100);

  // Signals
  const signalEmojis = { danger: '🔴', warn: '🟡', safe: '🟢' };
  const emoji = signalEmojis[cls];
  const ul = document.getElementById('signal-list');
  ul.innerHTML = (r.signals || []).map(s => `
    <li class="signal-item">
      <span class="signal-icon">${emoji}</span>
      <span>${s}</span>
    </li>
  `).join('');

  document.getElementById('tips-text').textContent = r.recommendation;

  document.getElementById('result').classList.add('visible');
}

function reset() {
  document.getElementById('result').classList.remove('visible');
  document.getElementById('input-section').style.display = 'block';
  document.getElementById('msg-input').value = '';
  document.getElementById('risk-bar-fill').style.width = '0%';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = '⚠ ' + msg;
  el.classList.add('visible');
}

