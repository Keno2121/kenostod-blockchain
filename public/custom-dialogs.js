let dialogResolve = null;

function createCustomDialogModal() {
    if (document.getElementById('customDialogModal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'customDialogModal';
    modal.style.cssText = 'display: none; position: fixed; z-index: 100000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px); align-items: center; justify-content: center;';
    
    modal.innerHTML = `
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; border-radius: 16px; max-width: 420px; width: 90%; text-align: center; box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5); border: 1px solid rgba(255,255,255,0.1);">
            <div id="dialogIcon" style="font-size: 3rem; margin-bottom: 16px;"></div>
            <h3 id="dialogTitle" style="margin-bottom: 12px; color: #fff; font-size: 1.25rem;">Kenostod Academy</h3>
            <p id="dialogMessage" style="color: rgba(255,255,255,0.8); margin-bottom: 24px; line-height: 1.6; white-space: pre-line;"></p>
            <div id="dialogButtons" style="display: flex; gap: 12px; justify-content: center;">
                <button id="dialogCancelBtn" onclick="handleDialogCancel()" style="padding: 12px 28px; border-radius: 8px; border: 2px solid #00d4ff; background: transparent; color: #00d4ff; cursor: pointer; font-size: 1rem; font-weight: 600; display: none;">Cancel</button>
                <button id="dialogOkBtn" onclick="handleDialogOk()" style="padding: 12px 28px; border-radius: 8px; border: none; background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%); color: #000; cursor: pointer; font-size: 1rem; font-weight: 600;">OK</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function showCustomAlert(message, icon = '✅') {
    return new Promise((resolve) => {
        createCustomDialogModal();
        dialogResolve = resolve;
        const modal = document.getElementById('customDialogModal');
        document.getElementById('dialogIcon').textContent = icon;
        document.getElementById('dialogTitle').textContent = 'Kenostod Academy';
        document.getElementById('dialogMessage').textContent = message;
        document.getElementById('dialogCancelBtn').style.display = 'none';
        document.getElementById('dialogOkBtn').textContent = 'OK';
        modal.style.display = 'flex';
    });
}

function showCustomConfirm(message, icon = '❓') {
    return new Promise((resolve) => {
        createCustomDialogModal();
        dialogResolve = resolve;
        const modal = document.getElementById('customDialogModal');
        document.getElementById('dialogIcon').textContent = icon;
        document.getElementById('dialogTitle').textContent = 'Confirm Action';
        document.getElementById('dialogMessage').textContent = message;
        document.getElementById('dialogCancelBtn').style.display = 'inline-block';
        document.getElementById('dialogOkBtn').textContent = 'OK';
        modal.style.display = 'flex';
    });
}

function showCustomPrompt(message, defaultValue = '', icon = '📝') {
    return new Promise((resolve) => {
        let promptModal = document.getElementById('customPromptModal');
        if (!promptModal) {
            promptModal = document.createElement('div');
            promptModal.id = 'customPromptModal';
            promptModal.style.cssText = 'display: none; position: fixed; z-index: 100001; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px); align-items: center; justify-content: center;';
            promptModal.innerHTML = `
                <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; border-radius: 16px; max-width: 420px; width: 90%; text-align: center; box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5); border: 1px solid rgba(255,255,255,0.1);">
                    <div id="promptIcon" style="font-size: 3rem; margin-bottom: 16px;"></div>
                    <h3 style="margin-bottom: 12px; color: #fff; font-size: 1.25rem;">Kenostod Academy</h3>
                    <p id="promptMessage" style="color: rgba(255,255,255,0.8); margin-bottom: 20px; line-height: 1.6;"></p>
                    <input type="text" id="promptInput" style="width: 100%; padding: 12px 16px; border: 2px solid #00d4ff; background: rgba(0,0,0,0.3); color: #fff; border-radius: 8px; font-size: 1rem; margin-bottom: 20px; text-align: center;" />
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button id="promptCancelBtn" style="padding: 12px 28px; border-radius: 8px; border: 2px solid #00d4ff; background: transparent; color: #00d4ff; cursor: pointer; font-size: 1rem; font-weight: 600;">Cancel</button>
                        <button id="promptOkBtn" style="padding: 12px 28px; border-radius: 8px; border: none; background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%); color: #000; cursor: pointer; font-size: 1rem; font-weight: 600;">Submit</button>
                    </div>
                </div>
            `;
            document.body.appendChild(promptModal);
        }
        
        const input = document.getElementById('promptInput');
        document.getElementById('promptIcon').textContent = icon;
        document.getElementById('promptMessage').textContent = message;
        input.value = defaultValue;
        promptModal.style.display = 'flex';
        
        setTimeout(() => input.focus(), 100);
        
        const handleOk = () => {
            promptModal.style.display = 'none';
            resolve(input.value);
            cleanup();
        };
        
        const handleCancel = () => {
            promptModal.style.display = 'none';
            resolve(null);
            cleanup();
        };
        
        const handleKeydown = (e) => {
            if (e.key === 'Enter') handleOk();
            if (e.key === 'Escape') handleCancel();
        };
        
        const cleanup = () => {
            document.getElementById('promptOkBtn').removeEventListener('click', handleOk);
            document.getElementById('promptCancelBtn').removeEventListener('click', handleCancel);
            input.removeEventListener('keydown', handleKeydown);
        };
        
        document.getElementById('promptOkBtn').addEventListener('click', handleOk);
        document.getElementById('promptCancelBtn').addEventListener('click', handleCancel);
        input.addEventListener('keydown', handleKeydown);
    });
}

function handleDialogOk() {
    const modal = document.getElementById('customDialogModal');
    if (modal) modal.style.display = 'none';
    if (dialogResolve) { dialogResolve(true); dialogResolve = null; }
}

function handleDialogCancel() {
    const modal = document.getElementById('customDialogModal');
    if (modal) modal.style.display = 'none';
    if (dialogResolve) { dialogResolve(false); dialogResolve = null; }
}

document.addEventListener('DOMContentLoaded', createCustomDialogModal);
