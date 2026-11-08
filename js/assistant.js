
// Admin token helper (server-side session)
function _getAdminToken() { return sessionStorage.getItem('aether_admin_token') || ''; }
/**
 * AETHERBUILDER - NON-AI DECISION TREE CHATBOT ENGINE
 * Completely standalone, deterministic, zero-API cost interactive support & lead capture bot.
 */

export const DEFAULT_CHATBOT_CONFIG = {
  enabled: true,
  title: 'AI Assistant',
  subtitle: 'Automated 24/7 Guidance & Inquiries',
  avatar: '⚖️',
  bubbleText: 'Need help? Ask us!',
  primaryColor: '#6366f1',
  messengerEnabled: false,
  messengerPageId: '',
  messengerDirectLaunch: false,
  nodes: [
    {
      id: 'start',
      message: 'Hello and Mabuhay! Welcome to the Official Customer Support Portal. How can we help you today, Counsel?',
      options: [
        { label: '📅 Upcoming Seminar Schedules', next: 'schedules' },
        { label: '💳 Registration Fees & Payment', next: 'fees' },
        { label: '📜 Compliance Units & Certificates', next: 'compliance' },
        { label: '📞 Speak with an MCLE Officer', next: 'contact' }
      ]
    },
    {
      id: 'schedules',
      message: 'Our next accredited MCLE Program is open for registration! We offer complete 36-unit compliance tracks, as well as per-day modular sessions covering Legal Ethics, Trial Techniques, and Supreme Court Updates.',
      options: [
        { label: '📝 Reserve a Slot / Register', next: 'lead_form' },
        { label: '💳 View Fee Structure', next: 'fees' },
        { label: '↩️ Return to Main Menu', next: 'start' }
      ]
    },
    {
      id: 'fees',
      message: 'MCLE Program Rates:\n• Full Compliance (36 Units): ₱9,500 (Early Bird)\n• Daily / Modular Pass: ₱2,500 / day\n\nPayment options include BDO Bank Deposit, Online Bank Transfer, and GCash.',
      options: [
        { label: '🏦 Get Bank & Payment Details', next: 'payment_info' },
        { label: '📝 Register Online Now', next: 'lead_form' },
        { label: '↩️ Main Menu', next: 'start' }
      ]
    },
    {
      id: 'payment_info',
      message: 'Bank Details:\n• Account Name: Standard Organization\n• Bank: BDO / Landbank\n• Account No: Available upon slot confirmation\n\nPlease keep your deposit slip or transaction screenshot for official receipt issuance.',
      options: [
        { label: '✍️ Submit My Registration Request', next: 'lead_form' },
        { label: '↩️ Main Menu', next: 'start' }
      ]
    },
    {
      id: 'compliance',
      message: 'Certificates of Attendance and Compliance are electronically certified and submitted directly to the Supreme Court Mandatory Continuing Legal Education Office. Digital copies are emailed to attendees within 3–5 working days post-evaluation.',
      options: [
        { label: '🔍 Inquire on Past Compliance Status', next: 'lead_form' },
        { label: '↩️ Main Menu', next: 'start' }
      ]
    },
    {
      id: 'contact',
      message: 'Our MCLE Secretariat is available Monday to Saturday, 8:00 AM – 5:00 PM. Leave your contact details below, and an officer will reach out to you directly.',
      options: [
        { label: '✍️ Leave Contact Details', next: 'lead_form' },
        { label: '↩️ Main Menu', next: 'start' }
      ]
    },
    {
      id: 'lead_form',
      message: 'Please provide your details below and an MCLE Secretariat coordinator will assist you right away:',
      isLeadCapture: true,
      options: [
        { label: '↩️ Return to Menu', next: 'start' }
      ]
    }
  ]
};

export function renderChatbotAvatar(avatarStr) {
  if (!avatarStr) return '💬';
  const str = String(avatarStr).trim();
  if (
    str.startsWith('http://') ||
    str.startsWith('https://') ||
    str.startsWith('assets/') ||
    str.startsWith('/') ||
    /\.(png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i.test(str)
  ) {
    return `<img src="${str}" alt="Chatbot" onerror="this.onerror=null; this.parentElement.innerHTML='⚖️';" style="width:100%;height:100%;object-fit:cover;display:block;" />`;
  }
  return str;
}

/**
 * Initializes and mounts the floating chatbot widget on the live public site.
 * @param {Object} customConfig - User-configured chatbot settings
 */
export function initPublicChatbot(customConfig = {}) {
  // Check if chatbot is disabled
  if (customConfig.enabled === false) {
    document.getElementById('aether-chatbot-root')?.remove();
    return;
  }

  const config = {
    ...DEFAULT_CHATBOT_CONFIG,
    ...customConfig,
    nodes: Array.isArray(customConfig.nodes) && customConfig.nodes.length > 0 
           ? customConfig.nodes 
           : DEFAULT_CHATBOT_CONFIG.nodes
  };

  // Remove stale instance if re-initializing
  document.getElementById('aether-chatbot-root')?.remove();

  const root = document.createElement('div');
  root.id = 'aether-chatbot-root';
  root.innerHTML = `
    <!-- Floating Launcher Bubble -->
    <div id="aether-chatbot-launcher" class="aether-chatbot-launcher" title="Open Chat Assistance">
      <span class="aether-chatbot-launcher-avatar">${renderChatbotAvatar(config.avatar)}</span>
      <span class="aether-chatbot-launcher-badge"></span>
      <div class="aether-chatbot-launcher-tooltip">${config.bubbleText || 'Need help? Ask us!'}</div>
    </div>

    <!-- Chatbot Window Panel -->
    <div id="aether-chatbot-window" class="aether-chatbot-window" style="display: none;">
      <!-- Window Header -->
      <div class="aether-chat-header">
        <div class="aether-chat-header-info">
          <div class="aether-chat-avatar-badge">${renderChatbotAvatar(config.avatar)}</div>
          <div>
            <div class="aether-chat-title">${config.title || 'AI Assistant'}</div>
            <div class="aether-chat-subtitle">
              <span class="aether-chat-status-dot"></span>
              <span>${config.subtitle || '24/7 Automated Guidance'}</span>
            </div>
          </div>
        </div>
        <div class="aether-chat-header-actions">
          <button class="aether-chat-action-btn" id="aether-chat-restart" title="Restart Conversation">🔄</button>
          <button class="aether-chat-action-btn" id="aether-chat-close" title="Close Chat">✕</button>
        </div>
      </div>

      <!-- Messages Stream -->
      <div class="aether-chat-body" id="aether-chat-messages">
        <!-- Messages appended here -->
      </div>

      <!-- Quick-Reply Options Tray -->
      <div class="aether-chat-footer" id="aether-chat-options">
        <!-- Interactive chips appended here -->
      </div>
    </div>
  `;

  document.body.appendChild(root);

  // Inject Styles if not already present
  injectChatbotStyles();

  // Internal Chat State
  let currentNodeId = 'start';
  let isWindowOpen = false;
  let chatHistory = [];

  const launcherEl = document.getElementById('aether-chatbot-launcher');
  const windowEl   = document.getElementById('aether-chatbot-window');
  const messagesEl = document.getElementById('aether-chat-messages');
  const optionsEl  = document.getElementById('aether-chat-options');
  const restartBtn = document.getElementById('aether-chat-restart');
  const closeBtn   = document.getElementById('aether-chat-close');

  const toggleWindow = (open) => {
    isWindowOpen = typeof open === 'boolean' ? open : !isWindowOpen;
    windowEl.style.display = isWindowOpen ? 'flex' : 'none';
    launcherEl.classList.toggle('active', isWindowOpen);
    if (isWindowOpen && chatHistory.length === 0) {
      goToNode('start');
    }
  };

  launcherEl.addEventListener('click', () => {
    if (config.messengerDirectLaunch && (config.messengerPageId || config.messengerUrl)) {
      const pId = (config.messengerPageId || '').replace(/^@/, '').trim();
      const msgrUrl = config.messengerUrl || ('https://m.me/' + encodeURIComponent(pId));
      window.open(msgrUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    toggleWindow();
  });
  closeBtn.addEventListener('click', () => toggleWindow(false));
  restartBtn.addEventListener('click', () => {
    chatHistory = [];
    messagesEl.innerHTML = '';
    goToNode('start');
  });

  const nodeMap = new Map();
  (config.nodes || []).forEach(n => nodeMap.set(n.id, n));

  const formatText = (txt) => {
    if (!txt) return '';
    return txt.replace(/\n/g, '<br/>')
              .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#38bdf8;text-decoration:underline;">$1</a>');
  };

  const scrollToBottom = () => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  const appendBotMessage = (text, delayMs = 220) => {
    // Show typing dots indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'aether-chat-msg aether-chat-bot typing';
    typingIndicator.innerHTML = `
      <div class="aether-chat-bubble">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
    messagesEl.appendChild(typingIndicator);
    scrollToBottom();

    setTimeout(() => {
      typingIndicator.remove();
      const msgEl = document.createElement('div');
      msgEl.className = 'aether-chat-msg aether-chat-bot animate-fade-in';
      msgEl.innerHTML = `
        <div class="aether-chat-bubble">
          ${formatText(text)}
        </div>
      `;
      messagesEl.appendChild(msgEl);
      scrollToBottom();
    }, delayMs);
  };

  const appendUserMessage = (text) => {
    const msgEl = document.createElement('div');
    msgEl.className = 'aether-chat-msg aether-chat-user animate-fade-in';
    msgEl.innerHTML = `
      <div class="aether-chat-bubble user">
        ${formatText(text)}
      </div>
    `;
    messagesEl.appendChild(msgEl);
    scrollToBottom();
  };

  const goToNode = (nodeId) => {
    currentNodeId = nodeId;
    const node = nodeMap.get(nodeId) || config.nodes[0];
    if (!node) return;

    chatHistory.push({ from: 'bot', text: node.message, nodeId: node.id });
    appendBotMessage(node.message, 240);

    setTimeout(() => {
      renderOptions(node);
    }, 280);
  };

  const renderOptions = (node) => {
    optionsEl.innerHTML = '';

    // If node is a Lead Capture Form
    if (node.isLeadCapture) {
      const formBox = document.createElement('div');
      formBox.className = 'aether-chat-lead-box animate-fade-in';
      formBox.innerHTML = `
        <div style="font-size:0.75rem;font-weight:700;color:#f8fafc;margin-bottom:6px;">✍️ Quick Inquiry & Registration</div>
        <form id="aether-chat-lead-form" style="display:flex;flex-direction:column;gap:6px;">
          <input type="text" name="name" placeholder="Full Name (e.g. Atty. Juan Dela Cruz)" required class="aether-chat-input" />
          <input type="text" name="email_or_phone" placeholder="Email Address or Mobile Number" required class="aether-chat-input" />
          <textarea name="note" rows="2" placeholder="Roll of Attorneys No. / Question (optional)" class="aether-chat-input" style="resize:none;"></textarea>
          <!-- Anti-spam Honeypot -->
          <input type="text" name="_hp" style="display:none;" tabindex="-1" autocomplete="off" />
          <button type="submit" class="aether-chat-submit-btn">
            <span>Send Details</span> <span>✓</span>
          </button>
        </form>
      `;

      formBox.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = formBox.querySelector('.aether-chat-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        const fd = new FormData(e.target);
        const contactVal = fd.get('email_or_phone') || '';
        const isEmail = contactVal.includes('@');

        const payload = {
          type: 'chatbot',
          name: fd.get('name') || 'Anonymous Lawyer',
          email: isEmail ? contactVal : '',
          phone: !isEmail ? contactVal : '',
          message: fd.get('note') || 'Chatbot inquiry received',
          page: window.location.search || 'home',
          _hp: fd.get('_hp') || ''
        };

        try {
          const res = await fetch('api.php?action=submit_form', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json',
          'X-Admin-Token': _getAdminToken(), },
            body: JSON.stringify(payload)
          });
          const result = await res.json();
          if (result.success) {
            formBox.innerHTML = `
              <div style="text-align:center;padding:12px 6px;">
                <div style="font-size:1.8rem;margin-bottom:4px;">🎉</div>
                <div style="font-weight:700;font-size:0.85rem;color:#38bdf8;">Thank you, Counsel!</div>
                <div style="font-size:0.73rem;color:var(--text-muted);margin-top:2px;">Our MCLE coordinator has received your details and will contact you promptly.</div>
                <button type="button" id="chat-back-to-menu" style="margin-top:10px;padding:5px 12px;font-size:0.72rem;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);color:#a5b4fc;border-radius:6px;cursor:pointer;">
                  ↩️ Return to Main Menu
                </button>
              </div>
            `;
            formBox.querySelector('#chat-back-to-menu')?.addEventListener('click', () => {
              goToNode('start');
            });
            return;
          }
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Try Again';
        }
      });

      optionsEl.appendChild(formBox);
      scrollToBottom();
      return;
    }

    // Standard Choice Buttons / Quick Replies
    const opts = node.options || [];
    if (opts.length === 0) {
      const resetChip = document.createElement('button');
      resetChip.className = 'aether-chat-chip';
      resetChip.innerHTML = '↩️ Start Over';
      resetChip.addEventListener('click', () => goToNode('start'));
      optionsEl.appendChild(resetChip);
      return;
    }

    // Facebook Messenger Bridge Button
    if (config.messengerEnabled && (config.messengerPageId || config.messengerUrl)) {
      const pId = (config.messengerPageId || '').replace(/^@/, '').trim();
      const msgrUrl = config.messengerUrl || ('https://m.me/' + encodeURIComponent(pId));
      const msgrPill = document.createElement('a');
      msgrPill.className = 'aether-chat-messenger-pill';
      msgrPill.href = msgrUrl;
      msgrPill.target = '_blank';
      msgrPill.rel = 'noopener noreferrer';
      msgrPill.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#0084FF" style="flex-shrink:0;"><path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.914 1.455 5.518 3.735 7.18v3.562l3.42-1.877c.905.251 1.865.387 2.845.387 5.523 0 10-4.145 10-9.252C22 6.145 17.523 2 12 2zm1.066 12.443l-2.613-2.787-5.097 2.787 5.607-5.952 2.68 2.787 5.03-2.787-5.607 5.952z"/></svg>
        <span>Chat on Facebook Messenger</span>
      `;
      optionsEl.appendChild(msgrPill);
    }

    opts.forEach(opt => {
      const chip = document.createElement('button');
      chip.className = 'aether-chat-chip animate-fade-in';
      chip.innerHTML = opt.label;
      chip.addEventListener('click', () => {
        appendUserMessage(opt.label);
        goToNode(opt.next || 'start');
      });
      optionsEl.appendChild(chip);
    });

    scrollToBottom();
  };
}

/**
 * Injects responsive CSS rules for the chatbot widget.
 */
function injectChatbotStyles() {
  if (document.getElementById('aether-chatbot-styles')) return;
  const style = document.createElement('style');
  style.id = 'aether-chatbot-styles';
  style.textContent = `
    /* Messenger Bridge Link in Chat Window */
    .aether-chat-messenger-pill {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      margin-bottom: 8px;
      padding: 7px 12px;
      background: rgba(0, 132, 255, 0.1);
      border: 1px solid rgba(0, 132, 255, 0.3);
      border-radius: 8px;
      color: #60a5fa;
      font-size: 0.74rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      box-sizing: border-box;
      cursor: pointer;
    }
    .aether-chat-messenger-pill:hover {
      background: #0084FF;
      color: #ffffff;
      border-color: #0084FF;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 132, 255, 0.3);
    }
    .aether-chat-messenger-pill:hover svg {
      fill: #ffffff;
    }

    /* Chatbot Root */
    #aether-chatbot-root {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
    }

    /* Floating Launcher Button */
    .aether-chatbot-launcher {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #0ea5e9);
      box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4), 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
      position: relative;
      user-select: none;
    }
    .aether-chatbot-launcher:hover {
      transform: scale(1.08) translateY(-2px);
      box-shadow: 0 12px 28px rgba(99, 102, 241, 0.55), 0 3px 8px rgba(0,0,0,0.4);
    }
    .aether-chatbot-launcher.active {
      transform: scale(0.92);
    }
    .aether-chatbot-launcher-avatar {
      font-size: 1.65rem;
      line-height: 1;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      overflow: hidden;
    }
    .aether-chatbot-launcher-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .aether-chatbot-launcher-badge {
      position: absolute;
      top: 3px;
      right: 3px;
      width: 13px;
      height: 13px;
      background: #10b981;
      border: 2px solid #0b0f19;
      border-radius: 50%;
      animation: pulse-badge 2s infinite;
    }
    @keyframes pulse-badge {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { box-shadow: 0 0 0 7px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    .aether-chatbot-launcher-tooltip {
      position: absolute;
      right: 68px;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #f8fafc;
      font-size: 0.76rem;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 8px;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      opacity: 0.95;
      transition: all 0.2s ease;
    }

    /* Chat Window Container */
    .aether-chatbot-window {
      position: absolute;
      bottom: 72px;
      right: 0;
      width: 375px;
      max-width: calc(100vw - 32px);
      height: 540px;
      max-height: calc(100vh - 120px);
      background: rgba(11, 15, 25, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 18px;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(99, 102, 241, 0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: chat-slide-up 0.26s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes chat-slide-up {
      from { opacity: 0; transform: translateY(16px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Window Header */
    .aether-chat-header {
      padding: 12px 14px;
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95));
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .aether-chat-header-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .aether-chat-avatar-badge {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, #6366f1, #38bdf8);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      overflow: hidden;
      flex-shrink: 0;
    }
    .aether-chat-avatar-badge img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .aether-chat-title {
      font-size: 0.88rem;
      font-weight: 700;
      color: #f8fafc;
      letter-spacing: -0.01em;
    }
    .aether-chat-subtitle {
      font-size: 0.68rem;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 1px;
    }
    .aether-chat-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
    }
    .aether-chat-header-actions {
      display: flex;
      gap: 6px;
    }
    .aether-chat-action-btn {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.05);
      color: #cbd5e1;
      font-size: 0.8rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s;
    }
    .aether-chat-action-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }

    /* Chat Messages Stream */
    .aether-chat-body {
      flex: 1;
      padding: 14px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      scroll-behavior: smooth;
    }
    .aether-chat-msg {
      display: flex;
      max-width: 86%;
    }
    .aether-chat-msg.aether-chat-bot {
      align-self: flex-start;
    }
    .aether-chat-msg.aether-chat-user {
      align-self: flex-end;
    }
    .aether-chat-bubble {
      padding: 9px 13px;
      border-radius: 14px;
      font-size: 0.8rem;
      line-height: 1.48;
      word-break: break-word;
      background: rgba(30, 41, 59, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: #f1f5f9;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    }
    .aether-chat-bubble.user {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #ffffff;
      border: none;
      border-bottom-right-radius: 3px;
    }

    /* Typing Animation */
    .aether-chat-msg.typing .aether-chat-bubble {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 10px 14px;
    }
    .typing-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #94a3b8;
      animation: typing-blink 1.2s infinite ease-in-out;
    }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing-blink {
      0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1.15); }
    }

    /* Options & Quick Reply Chips Tray */
    .aether-chat-footer {
      padding: 10px 12px;
      background: rgba(15, 23, 42, 0.8);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      max-height: 165px;
      overflow-y: auto;
    }
    .aether-chat-chip {
      font-size: 0.74rem;
      font-weight: 500;
      padding: 6px 11px;
      border-radius: 20px;
      border: 1px solid rgba(99, 102, 241, 0.4);
      background: rgba(99, 102, 241, 0.12);
      color: #e0e7ff;
      cursor: pointer;
      transition: all 0.18s ease;
      text-align: left;
      line-height: 1.3;
    }
    .aether-chat-chip:hover {
      background: rgba(99, 102, 241, 0.3);
      border-color: #818cf8;
      color: #ffffff;
      transform: translateY(-1px);
    }

    /* Lead Capture Form */
    .aether-chat-lead-box {
      width: 100%;
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 10px;
      padding: 10px;
    }
    .aether-chat-input {
      width: 100%;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: rgba(11, 15, 25, 0.8);
      color: #f8fafc;
      font-size: 0.75rem;
      outline: none;
      box-sizing: border-box;
    }
    .aether-chat-input:focus {
      border-color: #6366f1;
    }
    .aether-chat-submit-btn {
      width: 100%;
      padding: 7px;
      border-radius: 6px;
      border: none;
      background: linear-gradient(135deg, #6366f1, #0ea5e9);
      color: #ffffff;
      font-weight: 600;
      font-size: 0.76rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: opacity 0.2s;
    }
    .aether-chat-submit-btn:hover {
      opacity: 0.92;
    }

    @media (max-width: 480px) {
      #aether-chatbot-root {
        bottom: 16px;
        right: 16px;
      }
      .aether-chatbot-window {
        bottom: 68px;
        right: -8px;
        width: calc(100vw - 32px);
        height: calc(100vh - 110px);
      }
    }
  `;
  document.head.appendChild(style);
}
