// Copyright 2018 Maxim Martynov. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  switch (message.action) {

    case 'activate':
      sendResponse({ 'result': true });
      chrome.tabs.query({ active: true });
      break;

    default:
      sendResponse({ 'result': false });
  }
});