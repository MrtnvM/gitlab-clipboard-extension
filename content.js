const ControlKeyObserver = createControlKeyObserver();

chrome.runtime.sendMessage({ action: 'activate' }, (response) => {
    if (!response.result) {
        return;
    }

    observeChangesInBoard();
});

function addCopyButtonToTickets() {
    const ticketSelector = '.board-card';

    const tickets = document.querySelectorAll(ticketSelector);
    tickets.forEach(addCopyButtonToTicket);
}

function addCopyButtonToTicket(ticket) {
    const containerSelector = '.board-card-header';
    const container = ticket.querySelector(containerSelector);

    if (container.querySelector('.clipboard-btn')) {
        return;
    }

    const copyBtn = createCopyButton(ticket);
    container.prepend(copyBtn);
}

function createCopyButton(ticket) {
    var span = document.createElement('span');
    var img = document.createElement('img');
    span.appendChild(img);

    img.src = chrome.extension.getURL('images/copy.svg');
    img.style.width = '16px';
    img.style.height = '16px';

    span.className = 'clipboard-btn';
    span.style.marginTop = '-2.5px';
    span.style.marginRight = '4px';

    img.addEventListener('click', () => {
        const content = getTicketDescription(ticket);

        img.src = chrome.extension.getURL('images/copied.svg');

        const dropSelectionMode = () => {
            setTimeout(() => img.src = chrome.extension.getURL('images/copy.svg'), 1300);
        };

        if (ControlKeyObserver.isMultiSelectionEnabled()) {
            ControlKeyObserver.addTicketDescription(content);
            ControlKeyObserver.addOnKeyUpListener(dropSelectionMode);
        } else {
            copyStringToClipboard(content);
            dropSelectionMode();
        }
    });

    return span;
}

function getTicketDescription(ticket) {
    const tiketLinkSelector = '.board-card-title a';
    const linkTag = ticket.querySelector(tiketLinkSelector);

    const title = linkTag.title;
    const link = linkTag.href;

    const content = `*${title}*\n${link.replace('https://', '')}`;
    return content;
}

function copyStringToClipboard(content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const data = new ClipboardItem({ 'text/plain': blob });

    navigator.clipboard.write([data]).then(() => {
        console.log("Copied to clipboard successfully!");
    }, function (error) {
        console.error("Unable to write to clipboard: " + error);
    });
}

function observeChangesInBoard() {
    const targetNode = document.querySelector('.boards-list');
    const config = { attributes: false, childList: true, subtree: true };

    const callback = function (mutationsList, observer) {
        addCopyButtonToTickets();
    };

    const observer = new MutationObserver(callback);

    observer.observe(targetNode, config);
}

function createControlKeyObserver() {
    const controlKeys = ['ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight'];
    const isControlKey = (code) => controlKeys.indexOf(code) !== 0;

    let isMultiSelectionModeEnabled = false;
    let keyUpObservers = [];
    let ticketsDescriptions = [];

    document.addEventListener('keydown', (event) => {
        if (isControlKey(event.code) && !event.isComposing) {
            isMultiSelectionModeEnabled = true;
            keyUpObservers = [];
            ticketsDescriptions = [];
        }
    });

    document.addEventListener('keyup', (event) => {
        if (isMultiSelectionModeEnabled && isControlKey(event.code) && !event.isComposing) {
            isMultiSelectionModeEnabled = false;

            keyUpObservers.forEach(listener => listener());

            if (ticketsDescriptions.length >= 0) {
                const content = ticketsDescriptions.join('\n');
                copyStringToClipboard(content);
            }

            keyUpObservers = [];
            ticketsDescriptions = [];
        }
    });

    return {
        isMultiSelectionEnabled: () => isMultiSelectionModeEnabled,
        addOnKeyUpListener: (listener) => {
            if (typeof listener === 'function') {
                keyUpObservers.push(listener);
            }
        },
        addTicketDescription: (ticketDescription) => {
            if (isMultiSelectionModeEnabled && typeof ticketDescription === 'string') {
                ticketsDescriptions.push(ticketDescription);
            }
        }
    };
}