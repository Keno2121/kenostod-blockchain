class AISupportWidget {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.init();
    }

    init() {
        this.injectStyles();
        this.createWidget();
        this.attachEventListeners();
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .ai-support-fab {
                position: fixed;
                bottom: 30px;
                right: 30px;
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                border-radius: 50%;
                box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 28px;
                z-index: 9998;
                transition: all 0.3s ease;
                border: none;
                color: white;
            }

            .ai-support-fab:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 25px rgba(16, 185, 129, 0.6);
            }

            .ai-support-fab.open {
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            }

            .ai-support-widget {
                position: fixed;
                bottom: 100px;
                right: 30px;
                width: 380px;
                height: 550px;
                background: white;
                border-radius: 15px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                display: none;
                flex-direction: column;
                z-index: 9999;
                overflow: hidden;
            }

            .ai-support-widget.open {
                display: flex;
            }

            .ai-support-header {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                padding: 20px;
                font-weight: 700;
                font-size: 1.1rem;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .ai-support-status {
                width: 10px;
                height: 10px;
                background: #10b981;
                border-radius: 50%;
                animation: pulse 2s ease-in-out infinite;
            }

            .ai-support-messages {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                background: #f8fafc;
            }

            .ai-message {
                margin-bottom: 15px;
                animation: fadeInUp 0.3s ease-out;
            }

            .ai-message-bubble {
                padding: 12px 16px;
                border-radius: 12px;
                max-width: 85%;
                word-wrap: break-word;
                line-height: 1.5;
            }

            .ai-message.user .ai-message-bubble {
                background: #10b981;
                color: white;
                margin-left: auto;
                border-bottom-right-radius: 4px;
            }

            .ai-message.assistant .ai-message-bubble {
                background: white;
                color: #1e293b;
                border: 1px solid #e2e8f0;
                border-bottom-left-radius: 4px;
            }

            .ai-message.assistant .ai-icon {
                display: inline-block;
                margin-right: 8px;
            }

            .ai-typing-indicator {
                display: flex;
                gap: 4px;
                padding: 12px 16px;
                background: white;
                border-radius: 12px;
                width: fit-content;
                border: 1px solid #e2e8f0;
            }

            .ai-typing-dot {
                width: 8px;
                height: 8px;
                background: #94a3b8;
                border-radius: 50%;
                animation: typing 1.4s ease-in-out infinite;
            }

            .ai-typing-dot:nth-child(2) {
                animation-delay: 0.2s;
            }

            .ai-typing-dot:nth-child(3) {
                animation-delay: 0.4s;
            }

            .ai-support-input-container {
                padding: 15px;
                background: white;
                border-top: 1px solid #e2e8f0;
                display: flex;
                gap: 10px;
            }

            .ai-support-input {
                flex: 1;
                padding: 12px 16px;
                border: 2px solid #e2e8f0;
                border-radius: 25px;
                font-size: 0.95rem;
                outline: none;
                transition: all 0.3s ease;
            }

            .ai-support-input:focus {
                border-color: #10b981;
            }

            .ai-support-send-btn {
                width: 45px;
                height: 45px;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                border: none;
                border-radius: 50%;
                color: white;
                font-size: 1.2rem;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .ai-support-send-btn:hover:not(:disabled) {
                transform: scale(1.1);
            }

            .ai-support-send-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .ai-welcome-message {
                text-align: center;
                padding: 30px 20px;
                color: #64748b;
            }

            .ai-welcome-icon {
                font-size: 3rem;
                margin-bottom: 15px;
            }

            .ai-quick-questions {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-top: 20px;
            }

            .ai-quick-question-btn {
                background: white;
                border: 2px solid #e2e8f0;
                padding: 12px 16px;
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.3s ease;
                text-align: left;
                font-size: 0.9rem;
                color: #475569;
            }

            .ai-quick-question-btn:hover {
                border-color: #10b981;
                background: #f0fdf4;
                transform: translateX(5px);
            }

            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            @keyframes typing {
                0%, 60%, 100% {
                    transform: translateY(0);
                }
                30% {
                    transform: translateY(-10px);
                }
            }

            @keyframes pulse {
                0%, 100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.5;
                }
            }

            @media (max-width: 768px) {
                .ai-support-widget {
                    bottom: 90px;
                    right: 15px;
                    left: 15px;
                    width: auto;
                    height: 500px;
                }

                .ai-support-fab {
                    bottom: 20px;
                    right: 20px;
                    width: 55px;
                    height: 55px;
                    font-size: 24px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    createWidget() {
        const widgetHTML = `
            <button class="ai-support-fab" id="aiSupportFab">
                🤖
            </button>
            
            <div class="ai-support-widget" id="aiSupportWidget">
                <div class="ai-support-header">
                    <div class="ai-support-status"></div>
                    🤖 AI Support Assistant
                </div>
                
                <div class="ai-support-messages" id="aiSupportMessages">
                    <div class="ai-welcome-message">
                        <div class="ai-welcome-icon">👋</div>
                        <h3 style="margin: 0 0 10px 0; color: #1e293b;">Hi! I'm your AI assistant</h3>
                        <p style="margin: 0; line-height: 1.6;">I'm here to help you with any questions about Kenostod Blockchain Academy, wallets, transactions, mining, or the ICO!</p>
                        
                        <div class="ai-quick-questions">
                            <button class="ai-quick-question-btn" data-question="How do I create a wallet?">
                                💼 How do I create a wallet?
                            </button>
                            <button class="ai-quick-question-btn" data-question="How can I buy KENO tokens?">
                                🪙 How can I buy KENO tokens?
                            </button>
                            <button class="ai-quick-question-btn" data-question="What is the ICO Private Sale?">
                                🔥 What is the ICO Private Sale?
                            </button>
                            <button class="ai-quick-question-btn" data-question="How does transaction reversal work?">
                                ↩️ How does transaction reversal work?
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="ai-support-input-container">
                    <input 
                        type="text" 
                        class="ai-support-input" 
                        id="aiSupportInput" 
                        placeholder="Ask me anything..."
                        autocomplete="off"
                    />
                    <button class="ai-support-send-btn" id="aiSupportSend">
                        ➤
                    </button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', widgetHTML);
    }

    attachEventListeners() {
        const fab = document.getElementById('aiSupportFab');
        const input = document.getElementById('aiSupportInput');
        const sendBtn = document.getElementById('aiSupportSend');

        fab.addEventListener('click', () => this.toggleWidget());
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        sendBtn.addEventListener('click', () => this.sendMessage());

        const quickQuestions = document.querySelectorAll('.ai-quick-question-btn');
        quickQuestions.forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.getAttribute('data-question');
                this.askQuickQuestion(question);
            });
        });
    }

    toggleWidget() {
        this.isOpen = !this.isOpen;
        const widget = document.getElementById('aiSupportWidget');
        const fab = document.getElementById('aiSupportFab');
        
        if (this.isOpen) {
            widget.classList.add('open');
            fab.classList.add('open');
            fab.textContent = '✕';
            document.getElementById('aiSupportInput').focus();
        } else {
            widget.classList.remove('open');
            fab.classList.remove('open');
            fab.textContent = '🤖';
        }
    }

    async askQuickQuestion(question) {
        const messagesContainer = document.getElementById('aiSupportMessages');
        const welcome = messagesContainer.querySelector('.ai-welcome-message');
        if (welcome) welcome.remove();

        this.addMessage('user', question);
        this.showTypingIndicator();

        try {
            const response = await fetch('/api/support/quick-question', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question })
            });

            const data = await response.json();
            this.removeTypingIndicator();

            if (data.success) {
                this.addMessage('assistant', data.message);
                this.messages.push(
                    { role: 'user', content: question },
                    { role: 'assistant', content: data.message }
                );
            } else {
                this.addMessage('assistant', 'I apologize, but I encountered an error. Please try again.');
            }
        } catch (error) {
            console.error('AI Support error:', error);
            this.removeTypingIndicator();
            this.addMessage('assistant', 'Sorry, I\'m having trouble connecting. Please try again in a moment.');
        }
    }

    async sendMessage() {
        const input = document.getElementById('aiSupportInput');
        const message = input.value.trim();

        if (!message) return;

        const messagesContainer = document.getElementById('aiSupportMessages');
        const welcome = messagesContainer.querySelector('.ai-welcome-message');
        if (welcome) welcome.remove();

        this.addMessage('user', message);
        input.value = '';
        input.disabled = true;

        this.messages.push({ role: 'user', content: message });
        this.showTypingIndicator();

        try {
            const response = await fetch('/api/support/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: this.messages })
            });

            const data = await response.json();
            this.removeTypingIndicator();

            if (data.success) {
                this.addMessage('assistant', data.message);
                this.messages.push({ role: 'assistant', content: data.message });
            } else {
                this.addMessage('assistant', 'I apologize, but I encountered an error. Please try again.');
            }
        } catch (error) {
            console.error('AI Support error:', error);
            this.removeTypingIndicator();
            this.addMessage('assistant', 'Sorry, I\'m having trouble connecting. Please try again in a moment.');
        }

        input.disabled = false;
        input.focus();
    }

    addMessage(role, content) {
        const messagesContainer = document.getElementById('aiSupportMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${role}`;
        
        const icon = role === 'assistant' ? '<span class="ai-icon">🤖</span>' : '';
        messageDiv.innerHTML = `
            <div class="ai-message-bubble">
                ${icon}${this.formatMessage(content)}
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    formatMessage(message) {
        return message
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('aiSupportMessages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'ai-message assistant';
        typingDiv.id = 'aiTypingIndicator';
        typingDiv.innerHTML = `
            <div class="ai-typing-indicator">
                <div class="ai-typing-dot"></div>
                <div class="ai-typing-dot"></div>
                <div class="ai-typing-dot"></div>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    removeTypingIndicator() {
        const indicator = document.getElementById('aiTypingIndicator');
        if (indicator) indicator.remove();
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        new AISupportWidget();
    });
}
