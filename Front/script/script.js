// start = python -m http.server 3000       (o cmd tem que estar na pasta front)



const examples = {
  phishing: `Prezado cliente,

Identificamos uma atividade suspeita em sua conta. Para evitar o bloqueio imediato, acesse o link abaixo e confirme seus dados bancários em até 24 horas:

🔗 http://banco-seguro-verificacao.xyz/confirmar

Caso não realize a verificação, sua conta será suspensa permanentemente.

Atenciosamente,
Equipe de Segurança — Banco do Brasil`,

  prize: `PARABÉNS!! 🎉🎉

Você foi selecionado como GANHADOR do sorteio de R$15.000,00!

Para receber seu prêmio, envie seus dados (CPF, nome completo, conta bancária) para o WhatsApp: (11) 99999-0000

⚠️ Oferta válida apenas HOJE. Não perca!

— Promoção Nacional 2024`,

  safe: `Olá! Sua encomenda foi despachada com sucesso.

Código de rastreio: BR123456789BR
Previsão de entrega: 3 a 5 dias úteis

Acompanhe pelo site oficial dos Correios: correios.com.br

Em caso de dúvidas, acesse nossa central de atendimento no app ou site.

Obrigado pela compra!
— Loja Magazine`
};

function loadExample(type) {
  document.getElementById('msg-input').value = examples[type];
  document.getElementById('error-msg').classList.remove('visible');
}

async function analyze() {
  const text = document.getElementById('msg-input').value.trim();
  if (!text) {
    showError('Por favor, cole uma mensagem para analisar.');
    return;
  }

  document.getElementById('input-section').style.display = 'none';
  document.getElementById('loading').classList.add('visible');
  document.getElementById('result').classList.remove('visible');
  document.getElementById('error-msg').classList.remove('visible');

  try {
    const response = await fetch("http://localhost:8000/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }) // ✅ variável correta
    });

    if (!response.ok) throw new Error('Erro na API: ' + response.status);

    const result = await response.json(); // ✅ uma vez só, já vem o objeto pronto

    showResult(result);
  } catch (err) {
    document.getElementById('input-section').style.display = 'block';
    document.getElementById('loading').classList.remove('visible');
    showError('Erro ao analisar. Verifique sua conexão e tente novamente.');
    console.error(err);
  }
}

function showResult(r) {
  document.getElementById('loading').classList.remove('visible');

  const isPhish = r.verdict === 'phishing';
  const isSusp = r.verdict === 'suspeito';
  const cls = isPhish ? 'danger' : isSusp ? 'warn' : 'safe';

  const icons = { danger: '🚨', warn: '⚠️', safe: '✅' };
  const labels = { danger: 'PHISHING DETECTADO', warn: 'MENSAGEM SUSPEITA', safe: 'MENSAGEM SEGURA' };

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

