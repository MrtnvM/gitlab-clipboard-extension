const ControlKeyObserver = createControlKeyObserver();

chrome.runtime.sendMessage({ action: 'activate' }, (response) => {
    if (!response.result) {
        return;
    }

    observeChangesInBoard();
    setupMergeRequestsList();
    setupTicketDetails();
    setupMergeRequestDetails();
});

// MARK: Control Key Observer

function createControlKeyObserver() {
    const controlKeys = ['ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight'];
    const isControlKey = (code) => controlKeys.indexOf(code) !== 0;

    let isMultiSelectionModeEnabled = false;
    let keyUpObservers = [];
    let contentItems = [];

    const enableMultiSelectionMode = () => {
        isMultiSelectionModeEnabled = true;

        keyUpObservers.forEach(listener => listener());

        keyUpObservers = [];
        contentItems = [];
    };

    const disableMultiSelectionMode = () => {
        if (!isMultiSelectionModeEnabled) {
            return;
        }

        isMultiSelectionModeEnabled = false;

        keyUpObservers.forEach(listener => listener());

        if (contentItems.length > 0) {
            const content = contentItems.join('\n');
            copyStringToClipboard(content);
        }

        keyUpObservers = [];
        contentItems = [];
    };

    document.addEventListener('keydown', (event) => {
        if (isControlKey(event.code)) {
            enableMultiSelectionMode();
        }
    });

    document.addEventListener('keyup', (event) => {
        if (isMultiSelectionModeEnabled && isControlKey(event.code)) {
            disableMultiSelectionMode();
        }
    });

    return {
        isMultiSelectionEnabled: () => isMultiSelectionModeEnabled,
        addOnKeyUpListener: (listener) => {
            if (typeof listener === 'function') {
                keyUpObservers.push(listener);
            }
        },
        addTicketDescription: (contentItem) => {
            if (isMultiSelectionModeEnabled && typeof contentItem === 'string') {
                contentItems.push(contentItem);
            }
        }
    };
}

// MARK: Clipboard

function copyStringToClipboard(content) {
    if (typeof content !== 'string') {
        return;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const data = new ClipboardItem({ 'text/plain': blob });

    navigator.clipboard.write([data]).then(() => {
        console.log(`Copied:\n${content}`);
    }, function (error) {
        console.error("Unable to write to clipboard: " + error);
    });
}

function createCopyButton(getContentCallback) {
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
        if (typeof getContentCallback !== 'function') {
            return;
        }

        const content = getContentCallback();

        img.src = chrome.extension.getURL('images/copied.svg');

        const dropSelectionMode = () => {
            setTimeout(() => img.src = chrome.extension.getURL('images/copy.svg'), 1000);
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

function createLargeCopyButton(getContentCallback) {
    const btn = document.createElement('button');
    const img = document.createElement('img');
    btn.appendChild(img);

    const attributes = {
        'type': 'button',
    };

    for (const key in attributes) {
        btn.setAttribute(key, attributes[key]);
    }

    img.src = chrome.extension.getURL('images/copy.svg');
    img.style.width = '16px';
    img.style.height = '16px';
    img.style.marginTop = '-2.5px';

    btn.className = 'btn btn-default clipboard-btn';
    btn.style.cssText = `
        :hover { background: #3374C2; }
        :focus { outline: none; }
        margin-left: auto;
        margin-right: 12px;
        height: 32px;
        border-radius: 4px;
        border-color: #e5e5e5;
    `;

    btn.addEventListener('click', () => {
        if (typeof getContentCallback !== 'function') {
            return;
        }

        const content = getContentCallback();

        img.src = chrome.extension.getURL('images/copied.svg');

        const dropSelectionMode = () => {
            setTimeout(() => {
                img.src = chrome.extension.getURL('images/copy.svg');
                btn.blur();
            }, 1000);
        };

        copyStringToClipboard(content);
        dropSelectionMode();
    });

    return btn;
}

function addCopyButtonToItems(config) {
    const {
        itemSelector,
        copyBtnContainerSelector,
        itemsContainer,
        getContentCallback
    } = config;

    const items = itemsContainer.querySelectorAll(itemSelector);
    items.forEach((item) => {
        const container = item.querySelector(copyBtnContainerSelector);

        if (container.querySelector('.clipboard-btn')) {
            return;
        }

        const copyBtn = createCopyButton(getContentCallback(item));
        container.prepend(copyBtn);
    });
}

function addCopyButtonToItem(config) {
    const {
        item,
        copyBtnContainerSelector,
        getContentCallback
    } = config;

    const container = item.querySelector(copyBtnContainerSelector);

    if (container.querySelector('.clipboard-btn')) {
        return;
    }

    const copyBtn = createCopyButton(getContentCallback(item));
    container.prepend(copyBtn);
}

// MARK: Gitlab Board

function observeChangesInBoard() {
    const boardSelector = '.boards-list';
    const board = document.querySelector(boardSelector);
    if (!board) {
        return;
    }

    const callback = (mutationsList, observer) => {
        addCopyButtonToTickets(board);
    };

    const config = { attributes: false, childList: true, subtree: true };
    const observer = new MutationObserver(callback);

    observer.observe(board, config);
}

function addCopyButtonToTickets(board) {
    addCopyButtonToItems({
        itemSelector: '.board-card',
        copyBtnContainerSelector: '.board-card-header',
        itemsContainer: board,
        getContentCallback: (ticket) => () => getTicketDescription(ticket),
    });
}

function getTicketDescription(ticket) {
    const tiketLinkSelector = '.board-card-title a';
    const linkTag = ticket.querySelector(tiketLinkSelector);

    const title = linkTag.title;
    const link = linkTag.href;

    const content = `*${title}*\n${link.replace('https://', '')}`;
    return content;
}

// MARK: Gitlab Task Details

function setupTicketDetails() {
    if (window.location.href.indexOf('issues') < 0) {
        return;
    }

    const ticketTitleContainerSelector = '.detail-page-description';
    const ticketTitleContainer = document.querySelector(ticketTitleContainerSelector);

    if (!ticketTitleContainer) {
        return;
    }

    const callback = (mutationsList, observer) => {
        addCopyButtonToTicketDetails(ticketTitleContainer);
    };

    const config = { attributes: false, childList: true, subtree: true };
    const observer = new MutationObserver(callback);

    observer.observe(ticketTitleContainer, config);
}

function addCopyButtonToTicketDetails(ticketTitleContainer) {
    const item = ticketTitleContainer;
    const copyBtnContainerSelector = '.title-container';
    const getContentCallback = getTicketDetailsDescription;
    const beforeItem = document.querySelector('.btn-edit');

    const container = item.querySelector(copyBtnContainerSelector);

    if (container.querySelector('.clipboard-btn')) {
        return;
    }

    const copyBtn = createLargeCopyButton(() => getContentCallback(item));
    container.insertBefore(copyBtn, beforeItem);
}

function getTicketDetailsDescription(ticketTitleContainer) {
    const tiketTitleSelector = 'h2.title';
    const titleTag = ticketTitleContainer.querySelector(tiketTitleSelector);

    const title = titleTag.innerHTML;
    const link = window.location.href;

    const content = `*${title}*\n${link.replace('https://', '')}`;
    return content;
}

// MARK: Merge Requests

function setupMergeRequestsList() {
    const mrListSelector = '.mr-list';
    const mrList = document.querySelector(mrListSelector);
    if (!mrList) {
        return;
    }

    addCopyButtonToMRs(mrList);
}

function addCopyButtonToMRs(mrList) {
    addCopyButtonToItems({
        itemSelector: '.merge-request',
        copyBtnContainerSelector: '.merge-request-title',
        itemsContainer: mrList,
        getContentCallback: (mr) => () => getMRDescription(mr),
    });
}

function getMRDescription(mr) {
    const mrLinkSelector = '.merge-request-title-text a';
    const linkTag = mr.querySelector(mrLinkSelector);

    const title = linkTag.innerHTML;
    const link = linkTag.href;

    const content = `*${'MR: ' + title}*\n${link.replace('https://', '')}`;
    return content;
}

// MARK: Gitlab Merge Request Details

function setupMergeRequestDetails() {
    if (window.location.href.indexOf('merge_requests') < 0) {
        return;
    }

    const ticketTitleContainerSelector = '.detail-page-description';
    const ticketTitleContainer = document.querySelector(ticketTitleContainerSelector);

    if (!ticketTitleContainer) {
        return;
    }

    addCopyButtonToMergeRequestDetails(ticketTitleContainer);
}

function addCopyButtonToMergeRequestDetails(ticketTitleContainer) {
    const item = ticketTitleContainer;

    if (item.querySelector('.clipboard-btn')) {
        return;
    }

    const copyBtn = createLargeCopyButton(() => getMergeRequestDetailsDescription(item));
    copyBtn.style.marginRight = '0px';
    copyBtn.style.cssFloat = 'right';

    const title = item.querySelector('.title');
    title.style.paddingRight = '54px';

    item.prepend(copyBtn);
}

function getMergeRequestDetailsDescription(ticketTitleContainer) {
    const tiketTitleSelector = 'h2.title';
    const titleTag = ticketTitleContainer.querySelector(tiketTitleSelector);

    let title = titleTag.innerHTML;
    const link = window.location.href;

    var div = document.createElement("div");
    div.innerHTML = title;
    title = div.textContent || div.innerText || '';

    const content = `*${'MR: ' + title.trim()}*\n${link.replace('https://', '')}`;
    return content;
}