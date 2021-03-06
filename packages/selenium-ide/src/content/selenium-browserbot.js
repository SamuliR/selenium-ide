/*
 * Copyright 2011 Software Freedom Conservancy
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 */

/*
 * This script provides the Javascript API to drive the test application contained within
 * a Browser Window.
 * TODO:
 *    Add support for more events (keyboard and mouse)
 *    Allow to switch "user-entry" mode from mouse-based to keyboard-based, firing different
 *          events in different modes.
 */

import _Selenium from './selenium-api'
import SeleniumError from './SeleniumError'
import { selenium } from './commands-api'
import goog, { bot, core } from './closure-polyfill'
import { getTagName, parse_locator } from './utils'
import PatternMatcher from './PatternMatcher'

export const browserVersion = new window.global.BrowserVersion()
window.global.browserVersion = browserVersion

// The window to which the commands will be sent.  For example, to click on a
// popup window, first select that window, and then do a normal click command.
export default class BrowserBot {
  constructor(topLevelApplicationWindow) {
    this.topWindow = topLevelApplicationWindow
    this.topFrame = this.topWindow
    this.baseUrl = window.location.href
    bot.setWindow(window)

    //UnnamedWinIFrameExt, Jie-Lin You, SELAB, CSIE, NCKU, 2016/05/26
    this.count = 1

    // the buttonWindow is the Selenium window
    // it contains the Run/Pause buttons... this should *not* be the AUT window
    this.buttonWindow = window
    this.currentWindow = this.topWindow
    this.currentWindowName = null
    this.allowNativeXpath = true
    this.xpathEvaluator = new XPathEvaluator('ajaxslt') // change to "javascript-xpath" for the newer, faster engine

    // We need to know this in advance, in case the frame closes unexpectedly
    this.isSubFrameSelected = false

    this.altKeyDown = false
    this.controlKeyDown = false
    this.shiftKeyDown = false
    this.metaKeyDown = false

    this.modalDialogTest = null
    this.recordedAlerts = new Array()
    this.recordedConfirmations = new Array()
    this.recordedPrompts = new Array()
    this.openedWindows = {}
    //UnnamedWinIFrameExt, Jie-Lin You, SELAB, CSIE, NCKU, 2016/05/26
    this.openedWindows['win_ser_local'] = this.topWindow

    this.nextConfirmResult = true
    this.nextPromptResult = ''
    this.newPageLoaded = false
    this.pageLoadError = null

    this.ignoreResponseCode = false
    this.xhr = null
    this.abortXhr = false
    this.isXhrSent = false
    this.isXhrDone = false
    this.xhrOpenLocation = null
    this.xhrResponseCode = null
    this.xhrStatusText = null

    this.shouldHighlightLocatedElement = false

    this.uniqueId = 'seleniumMarker' + new Date().getTime()
    this.pollingForLoad = new Object()
    this.permDeniedCount = new Object()
    this.windowPollers = new Array()
    // DGF for backwards compatibility
    this.browserbot = this

    let self = this

    Object.assign(this, PageBot.prototype)
    this._registerAllLocatorFunctions()

    this.recordPageLoad = function() {
      self.newPageLoaded = true
    }

    this.isNewPageLoaded = function() {
      let e

      if (this.pageLoadError) {
        e = this.pageLoadError
        this.pageLoadError = null
        throw e
      }

      if (self.ignoreResponseCode) {
        return self.newPageLoaded
      } else {
        if (self.isXhrSent && self.isXhrDone) {
          if (
            !(
              (self.xhrResponseCode >= 200 && self.xhrResponseCode <= 399) ||
              self.xhrResponseCode == 0
            )
          ) {
            // TODO: for IE status like: 12002, 12007, ... provide corresponding statusText messages also.
            e =
              'XHR ERROR: URL = ' +
              self.xhrOpenLocation +
              ' Response_Code = ' +
              self.xhrResponseCode +
              ' Error_Message = ' +
              self.xhrStatusText
            self.abortXhr = false
            self.isXhrSent = false
            self.isXhrDone = false
            self.xhrResponseCode = null
            self.xhrStatusText = null
            throw new SeleniumError(e)
          }
        }
        return (
          self.newPageLoaded &&
          (self.isXhrSent ? self.abortXhr || self.isXhrDone : true)
        )
      }
    }

    this.setAllowNativeXPath = function(allow) {
      this.xpathEvaluator.setAllowNativeXPath(allow)
    }

    this.setIgnoreAttributesWithoutValue = function(ignore) {
      this.xpathEvaluator.setIgnoreAttributesWithoutValue(ignore)
    }

    this.setXPathEngine = function(engineName) {
      this.xpathEvaluator.setCurrentEngine(engineName)
    }

    this.getXPathEngine = function() {
      return this.xpathEvaluator.getCurrentEngine()
    }
  }
}

// DGF PageBot exists for backwards compatibility with old user-extensions
const PageBot = function() {}

BrowserBot.createForWindow = function(window, proxyInjectionMode) {
  let browserbot
  if (browserVersion.isIE) {
    browserbot = new IEBrowserBot(window)
  } else if (browserVersion.isKonqueror) {
    browserbot = new KonquerorBrowserBot(window)
  } else if (browserVersion.isOpera) {
    browserbot = new OperaBrowserBot(window)
  } else if (browserVersion.isSafari) {
    browserbot = new SafariBrowserBot(window)
  } else {
    // Use mozilla by default
    browserbot = new MozillaBrowserBot(window)
  }
  // getCurrentWindow has the side effect of modifying it to handle page loads etc
  browserbot.proxyInjectionMode = proxyInjectionMode
  browserbot.getCurrentWindow() // for modifyWindow side effect.  This is not a transparent style
  return browserbot
}

// todo: rename?  This doesn't actually "do" anything.
BrowserBot.prototype.doModalDialogTest = function(test) {
  this.modalDialogTest = test
}

BrowserBot.prototype.cancelNextConfirmation = function(result) {
  this.nextConfirmResult = result
}

//BrowserBot.prototype.setNextPromptResult = function(result) {
//this.nextResult = result;
//};

BrowserBot.prototype.hasAlerts = function() {
  return this.recordedAlerts.length > 0
}

BrowserBot.prototype.relayBotToRC = function(s) {
  // DGF need to do this funny trick to see if we're in PI mode, because
  // "this" might be the window, rather than the browserbot (e.g. during window.alert)
  let piMode = this.proxyInjectionMode
  if (!piMode) {
    if (typeof selenium != 'undefined') {
      piMode = selenium.browserbot && selenium.browserbot.proxyInjectionMode
    }
  }
  if (piMode) {
    this.relayToRC('selenium.' + s)
  }
}

BrowserBot.prototype.relayToRC = function() {
  return null
}

BrowserBot.prototype.resetPopups = function() {
  this.recordedAlerts = []
  this.recordedConfirmations = []
  this.recordedPrompts = []
}

BrowserBot.prototype.getNextAlert = function() {
  let t = this.recordedAlerts.shift()
  if (t) {
    t = t.replace(/\n/g, ' ') // because Selenese loses \n's when retrieving text from HTML table
  }
  this.relayBotToRC('browserbot.recordedAlerts')
  return t
}

BrowserBot.prototype.hasConfirmations = function() {
  return this.recordedConfirmations.length > 0
}

BrowserBot.prototype.getNextConfirmation = function() {
  let t = this.recordedConfirmations.shift()
  this.relayBotToRC('browserbot.recordedConfirmations')
  return t
}

BrowserBot.prototype.hasPrompts = function() {
  return this.recordedPrompts.length > 0
}

BrowserBot.prototype.getNextPrompt = function() {
  let t = this.recordedPrompts.shift()
  this.relayBotToRC('browserbot.recordedPrompts')
  return t
}

/* Fire a mouse event in a browser-compatible manner */

BrowserBot.prototype.triggerMouseEvent = function(
  element,
  eventType,
  canBubble,
  clientX,
  clientY,
  button
) {
  clientX = clientX ? clientX : 0
  clientY = clientY ? clientY : 0

  //LOG.debug("triggerMouseEvent assumes setting screenX and screenY to 0 is ok");
  let screenX = 0
  let screenY = 0

  canBubble = typeof canBubble == undefined ? true : canBubble
  let doc = goog.dom.getOwnerDocument(element)
  let view = goog.dom.getWindow(doc)

  let evt = doc.createEvent('MouseEvents')
  if (evt.initMouseEvent) {
    // see http://developer.mozilla.org/en/docs/DOM:event.button and
    // http://developer.mozilla.org/en/docs/DOM:event.initMouseEvent for button ternary logic logic
    //Safari
    evt.initMouseEvent(
      eventType,
      canBubble,
      true,
      view,
      1,
      screenX,
      screenY,
      clientX,
      clientY,
      this.controlKeyDown,
      this.altKeyDown,
      this.shiftKeyDown,
      this.metaKeyDown,
      button ? button : 0,
      null
    )
  } else {
    //LOG.warn("element doesn't have initMouseEvent; firing an event which should -- but doesn't -- have other mouse-event related attributes here, as well as controlKeyDown, altKeyDown, shiftKeyDown, metaKeyDown");
    evt.initEvent(eventType, canBubble, true)

    evt.shiftKey = this.shiftKeyDown
    evt.metaKey = this.metaKeyDown
    evt.altKey = this.altKeyDown
    evt.ctrlKey = this.controlKeyDown
    if (button) {
      evt.button = button
    }
  }
  element.dispatchEvent(evt)
}

BrowserBot.prototype.scroll = function(target, value) {
  const scrollHeight = window.document.body.scrollHeight
  const scrollY = (scrollHeight / 100) * value
  window.scrollBy(0, scrollY)
}

//DragAndDropExt, Shuo-Heng Shih, SELAB, CSIE, NCKU, 2016/10/17
BrowserBot.prototype.triggerDragEvent = function(element, target) {
  const getXpathOfElement = function(element) {
    if (element == null) {
      return 'null'
    }
    if (element.parentElement == null) {
      return '/' + element.tagName
    }

    let siblingElement = element.parentElement.children
    let tagCount = 0
    let totalTagCount = 0
    let isFound = false

    for (let i = 0; i < siblingElement.length; i++) {
      if (siblingElement[i].tagName == element.tagName && !isFound) {
        tagCount++
        totalTagCount++
      } else if (siblingElement[i].tagName == element.tagName) {
        totalTagCount++
      }
      if (siblingElement[i] == element) {
        isFound = true
      }
    }

    if (totalTagCount > 1) {
      return (
        getXpathOfElement(element.parentElement) +
        '/' +
        element.tagName +
        '[' +
        tagCount +
        ']'
      )
    }

    return getXpathOfElement(element.parentElement) + '/' + element.tagName
  }
  let script =
    "                                              \
        function simulateDragDrop(sourceNode, destinationNode){\
        function createCustomEvent(type) {                     \
            var event = new CustomEvent('CustomEvent');        \
            event.initCustomEvent(type, true, true, null);     \
            event.dataTransfer = {                             \
                data: {                                        \
                },                                             \
                setData: function(type, val) {                 \
                    this.data[type] = val;                     \
                },                                             \
                getData: function(type) {                      \
                    return this.data[type];                    \
                }                                              \
            };                                                 \
            return event;                                      \
        }                                                      \
        function dispatchEvent(node, type, event) {            \
            if (node.dispatchEvent) {                          \
                return node.dispatchEvent(event);              \
            }                                                  \
            if (node.fireEvent) {                              \
                return node.fireEvent('on' + type, event);     \
            }                                                  \
        }                                                      \
        var event = createCustomEvent('dragstart');            \
        dispatchEvent(sourceNode, 'dragstart', event);         \
                                                               \
        var dropEvent = createCustomEvent('drop');             \
        dropEvent.dataTransfer = event.dataTransfer;           \
        dispatchEvent(destinationNode, 'drop', dropEvent);     \
                                                               \
        var dragEndEvent = createCustomEvent('dragend');       \
        dragEndEvent.dataTransfer = event.dataTransfer;        \
        dispatchEvent(sourceNode, 'dragend', dragEndEvent);    \
    }                                                          \
    simulateDragDrop(document.evaluate('" +
    getXpathOfElement(element) +
    "', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue, document.evaluate('" +
    getXpathOfElement(target) +
    "', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue);\
    "
  let win = this.browserbot.getCurrentWindow()
  let doc = win.document
  let scriptTag = doc.createElement('script')
  scriptTag.type = 'text/javascript'
  scriptTag.text = script
  doc.body.appendChild(scriptTag)
}

BrowserBot.prototype._windowClosed = function(win) {
  try {
    let c = win.closed
    if (c == null) return true
    return c
  } catch (ignored) {
    // Firefox 15+ may already have marked the win dead. Accessing it
    // causes an exception to be thrown. That exception tells us the window
    // is closed.
    return true
  }
}

BrowserBot.uniqueKey = 1

BrowserBot.prototype._modifyWindow = function(win) {
  // In proxyInjectionMode, have to suppress //LOG calls in _modifyWindow to avoid an infinite loop
  if (this._windowClosed(win)) {
    if (!this.proxyInjectionMode) {
      //LOG.error("modifyWindow: Window was closed!");
    }
    return null
  }
  if (!this.proxyInjectionMode) {
    //LOG.debug('modifyWindow ' + this.uniqueId + ":" + win[this.uniqueId]);
  }

  // Assign a unique label for this window. We set this on a known attribute so we can reliably
  // find it later. This is slightly different from uniqueId.
  win.seleniumKey = BrowserBot.uniqueKey++

  try {
    this.modifyWindowToRecordPopUpDialogs(win, this)
  } catch (ex) {
    console.error(ex) // eslint-disable-line no-console
  }

  //Commenting out for issue 1854
  //win[this.uniqueId] = 1;

  // In proxyInjection mode, we have our own mechanism for detecting page loads
  if (!this.proxyInjectionMode) {
    this.modifySeparateTestWindowToDetectPageLoads(win)
  }
  if (win.frames && win.frames.length && win.frames.length > 0) {
    for (let i = 0; i < win.frames.length; i++) {
      try {
        this._modifyWindow(win.frames[i])
      } catch (e) {} // eslint-disable-line no-empty
      // we're just trying to be opportunistic; don't worry if this doesn't work out
    }
  }
  return win
}

BrowserBot.prototype.selectWindow = function(target) {
  if (!target || target == 'null') {
    this._selectTopWindow()
    return
  }
  let result = target.match(/^([a-zA-Z]+)=(.*)/)
  if (!result) {
    this._selectWindowByWindowId(target)
    return
  }
  let locatorType = result[1]
  let locatorValue = result[2]
  if (locatorType == 'title') {
    this._selectWindowByTitle(locatorValue)
  }
  // TODO separate name and var into separate functions
  else if (locatorType == 'name') {
    this._selectWindowByName(locatorValue)
  } else if (locatorType == 'var') {
    let win = this.getCurrentWindow().eval(locatorValue)
    if (win) {
      this._selectWindowByName(win.name)
    } else {
      throw new SeleniumError('Window not found by var: ' + locatorValue)
    }
  } else {
    throw new SeleniumError('Window locator not recognized: ' + locatorType)
  }
}

BrowserBot.prototype.selectPopUp = function(windowId) {
  if (!windowId || windowId == 'null') {
    this._selectFirstNonTopWindow()
  } else {
    this._selectWindowByWindowId(windowId)
  }
}

BrowserBot.prototype._selectTopWindow = function() {
  this.currentWindowName = null
  this.currentWindow = this.topWindow
  this.topFrame = this.topWindow
  this.isSubFrameSelected = false
}

BrowserBot.prototype._selectWindowByWindowId = function(windowId) {
  try {
    this._selectWindowByName(windowId)
  } catch (e) {
    this._selectWindowByTitle(windowId)
  }
}

BrowserBot.prototype._selectWindowByName = function(target) {
  this.currentWindow = this.getWindowByName(target, false)
  this.topFrame = this.currentWindow
  this.currentWindowName = target
  this.isSubFrameSelected = false
}

BrowserBot.prototype._selectWindowByTitle = function(target) {
  let windowName = this.getWindowNameByTitle(target)
  if (!windowName) {
    this._selectTopWindow()
  } else {
    this._selectWindowByName(windowName)
  }
}

BrowserBot.prototype._selectFirstNonTopWindow = function() {
  let names = this.getNonTopWindowNames()
  if (names.length) {
    this._selectWindowByName(names[0])
  }
}

BrowserBot.prototype.selectFrame = function(target) {
  let frame

  if (target.indexOf('index=') == 0) {
    target = target.substr(6)
    frame = this.getCurrentWindow().frames[target]
    if (frame == null) {
      throw new SeleniumError('Not found: frames[' + target + ']')
    }
    if (!frame.document) {
      throw new SeleniumError('frames[' + target + '] is not a frame')
    }
    this.currentWindow = frame
    this.isSubFrameSelected = true
  } else if (target == 'relative=up' || target == 'relative=parent') {
    this.currentWindow = this.getCurrentWindow().parent
    this.isSubFrameSelected = this._getFrameElement(this.currentWindow) != null
  } else if (target == 'relative=top') {
    this.currentWindow = this.topFrame
    this.isSubFrameSelected = false
  } else {
    frame = this.findElement(target)
    if (frame == null) {
      throw new SeleniumError('Not found: ' + target)
    }
    // now, did they give us a frame or a frame ELEMENT?
    let match = false
    if (frame.contentWindow) {
      // this must be a frame element
      if (browserVersion.isHTA) {
        // stupid HTA bug; can't get in the front door
        target = frame.contentWindow.name
      } else {
        this.currentWindow = frame.contentWindow
        this.isSubFrameSelected = true
        match = true
      }
    } else if (frame.document && frame.location) {
      // must be an actual window frame
      this.currentWindow = frame
      this.isSubFrameSelected = true
      match = true
    }

    if (!match) {
      // neither, let's loop through the frame names
      let win = this.getCurrentWindow()

      if (win && win.frames && win.frames.length) {
        for (let i = 0; i < win.frames.length; i++) {
          if (win.frames[i].name == target) {
            this.currentWindow = win.frames[i]
            this.isSubFrameSelected = true
            match = true
            break
          }
        }
      }
      if (!match) {
        throw new SeleniumError('Not a frame: ' + target)
      }
    }
  }
  // modifies the window
  this.getCurrentWindow()
}

BrowserBot.prototype.doesThisFrameMatchFrameExpression = function(
  currentFrameString,
  target
) {
  let isDom = false
  if (target.indexOf('dom=') == 0) {
    target = target.substr(4)
    isDom = true
  } else if (target.indexOf('index=') == 0) {
    target = 'frames[' + target.substr(6) + ']'
    isDom = true
  }
  let t
  //Evalinsandbox
  // eslint-disable-next-line no-undef
  let mySandbox = new Components.utils.Sandbox(this.currentWindow.location.href)
  mySandbox.currentFrameString = currentFrameString
  mySandbox.target = target
  try {
    // eslint-disable-next-line no-undef
    t = Components.utils.evalInSandbox(
      currentFrameString + '.' + target,
      mySandbox
    )
    //eval("t=" + currentFrameString + "." + target);
  } catch (e) {} // eslint-disable-line no-empty
  let autWindow = this.browserbot.getCurrentWindow()
  if (t != null) {
    try {
      if (t.window == autWindow) {
        return true
      }
      if (t.window.uniqueId == autWindow.uniqueId) {
        return true
      }
      return false
    } catch (permDenied) {
      // DGF if the windows are incomparable, they're probably not the same...
    }
  }
  if (isDom) {
    return false
  }
  // eslint-disable-next-line no-undef
  let currentFrame = Components.utils.evalInSandbox(
    currentFrameString,
    mySandbox
  )
  //var currentFrame;
  //eval("currentFrame=" + currentFrameString);
  if (target == 'relative=up') {
    if (currentFrame.window.parent == autWindow) {
      return true
    }
    return false
  }
  if (target == 'relative=top') {
    if (currentFrame.window.top == autWindow) {
      return true
    }
    return false
  }
  if (currentFrame.window == autWindow.parent) {
    if (autWindow.name == target) {
      return true
    }
    try {
      let element = this.findElement(target, currentFrame.window)
      if (element.contentWindow == autWindow) {
        return true
      }
    } catch (e) {} // eslint-disable-line no-empty
  }
  return false
}

BrowserBot.prototype.abortXhrRequest = function() {
  if (this.ignoreResponseCode) {
    //LOG.debug("XHR response code being ignored. Nothing to abort.");
  } else {
    if (this.abortXhr == false && this.isXhrSent && !this.isXhrDone) {
      //LOG.info("abortXhrRequest(): aborting request");
      this.abortXhr = true
      this.xhr.abort()
    }
  }
}

BrowserBot.prototype.onXhrStateChange = function(method) {
  //LOG.info("onXhrStateChange(): xhr.readyState = " + this.xhr.readyState + " method = " + method + " time = " + new Date().getTime());
  if (this.xhr.readyState == 4) {
    // check if the request got aborted.
    if (this.abortXhr == true) {
      this.xhrResponseCode = 0
      this.xhrStatusText = 'Request Aborted'
      this.isXhrDone = true
      return
    }

    try {
      if (
        method == 'HEAD' &&
        (this.xhr.status == 501 || this.xhr.status == 405)
      ) {
        //LOG.info("onXhrStateChange(): HEAD ajax returned 501 or 405, retrying with GET");
        // handle 501 response code from servers that do not support 'HEAD' method.
        // send GET ajax request with range 0-1.
        this.xhr = new XMLHttpRequest()
        this.xhr.onreadystatechange = this.onXhrStateChange.bind(this, 'GET')
        this.xhr.open('GET', this.xhrOpenLocation, true)
        this.xhr.setRequestHeader('Range', 'bytes:0-1')
        this.xhr.send('')
        this.isXhrSent = true
        return
      }
      this.xhrResponseCode = this.xhr.status
      this.xhrStatusText = this.xhr.statusText
    } catch (ex) {
      //LOG.info("encountered exception while reading xhrResponseCode." + ex.message);
      this.xhrResponseCode = -1
      this.xhrStatusText = 'Request Error'
    }

    this.isXhrDone = true
  }
}

BrowserBot.prototype.openWindow = function(url, windowID) {
  if (url != '') {
    url = 'https://www.google.com'
  }
  if (browserVersion.isHTA) {
    // in HTA mode, calling .open on the window interprets the url relative to that window
    // we need to absolute-ize the URL to make it consistent
    let child = this.getCurrentWindow().open(url, windowID, 'resizable=yes')
    selenium.browserbot.openedWindows[windowID] = child
  } else {
    this.getCurrentWindow().open(url, windowID, 'resizable=yes')
  }
}

BrowserBot.prototype.setIFrameLocation = function(iframe, location) {
  iframe.src = location
}

BrowserBot.prototype.getCurrentPage = function() {
  return this
}

BrowserBot.prototype.windowNeedsModifying = function(win, uniqueId) {
  // On anything but Firefox, checking the unique id is enough.
  // Firefox 4 introduces a race condition which selenium regularly loses.

  try {
    // eslint-disable-next-line no-undef
    let appInfo = Components.classes['@mozilla.org/xre/app-info;1'].getService(
      // eslint-disable-next-line no-undef
      Components.interfaces.nsIXULAppInfo
    )
    // eslint-disable-next-line no-undef
    let versionChecker = Components.classes[
      '@mozilla.org/xpcom/version-comparator;1'
      // eslint-disable-next-line no-undef
    ].getService(Components.interfaces.nsIVersionComparator)

    if (versionChecker.compare(appInfo.version, '4.0b1') >= 0) {
      return win.alert.toString().indexOf('native code') != -1
    }
  } catch (ignored) {} // eslint-disable-line no-empty
  return !win[uniqueId]
}

BrowserBot.prototype.modifyWindowToRecordPopUpDialogs = function(
  originalWindow,
  browserBot
) {
  let self = this

  // Apparently, Firefox 4 makes it possible to unwrap an object to find that
  // there's nothing in it.
  let windowToModify = core.firefox.unwrap(originalWindow)
  if (!windowToModify) {
    windowToModify = originalWindow
  }

  windowToModify.seleniumAlert = windowToModify.alert

  if (!self.windowNeedsModifying(windowToModify, browserBot.uniqueId)) {
    return
  }

  windowToModify.alert = function(alert) {
    browserBot.recordedAlerts.push(alert)
    self.relayBotToRC.call(self, 'browserbot.recordedAlerts')
  }

  windowToModify.confirm = function(message) {
    browserBot.recordedConfirmations.push(message)
    let result = browserBot.nextConfirmResult
    browserBot.nextConfirmResult = true
    self.relayBotToRC.call(self, 'browserbot.recordedConfirmations')
    return result
  }

  windowToModify.prompt = function(message) {
    browserBot.recordedPrompts.push(message)
    let result = !browserBot.nextConfirmResult
      ? null
      : browserBot.nextPromptResult
    browserBot.nextConfirmResult = true
    browserBot.nextPromptResult = ''
    self.relayBotToRC.call(self, 'browserbot.recordedPrompts')
    return result
  }

  // Keep a reference to all popup windows by name
  // note that in IE the "windowName" argument must be a valid javascript identifier, it seems.
  let originalOpen = windowToModify.open
  let originalOpenReference
  if (browserVersion.isHTA) {
    originalOpenReference = 'selenium_originalOpen' + new Date().getTime()
    windowToModify[originalOpenReference] = windowToModify.open
  }

  let isHTA = browserVersion.isHTA

  let newOpen = function(url, windowName, windowFeatures, replaceFlag) {
    let myOriginalOpen = originalOpen
    if (isHTA) {
      myOriginalOpen = this[originalOpenReference]
    }

    //UnnamedWinIFrameExt, Jie-Lin You, SELAB, CSIE, NCKU, 2016/05/26
    if (
      windowName == '' ||
      windowName == '_blank' ||
      typeof windowName === 'undefined'
    ) {
      windowName = 'win_ser_' + self.count
      self.count += 1
    }

    let openedWindow = myOriginalOpen(
      url,
      windowName,
      windowFeatures,
      replaceFlag
    )
    //LOG.debug("window.open call intercepted; window ID (which you can use with selectWindow()) is \"" +  windowName + "\"");
    if (windowName != null) {
      openedWindow['seleniumWindowName'] = windowName
    }
    selenium.browserbot.openedWindows[windowName] = openedWindow
    return openedWindow
  }

  if (browserVersion.isHTA) {
    originalOpenReference = 'selenium_originalOpen' + new Date().getTime()
    const newOpenReference = 'selenium_newOpen' + new Date().getTime()
    let setOriginalRef = "this['" + originalOpenReference + "'] = this.open;"

    if (windowToModify.eval) {
      windowToModify.eval(setOriginalRef)
      windowToModify.open = newOpen
    } else {
      // DGF why can't I eval here?  Seems like I'm querying the window at a bad time, maybe?
      setOriginalRef += "this.open = this['" + newOpenReference + "'];"
      windowToModify[newOpenReference] = newOpen
      windowToModify.setTimeout(setOriginalRef, 0)
    }
  } else {
    windowToModify.open = newOpen
  }
}

/**
 * Call the supplied function when a the current page unloads and a new one loads.
 * This is done by polling continuously until the document changes and is fully loaded.
 */
BrowserBot.prototype.modifySeparateTestWindowToDetectPageLoads = function(
  windowObject
) {
  // Since the unload event doesn't fire in Safari 1.3, we start polling immediately
  if (!windowObject) {
    //LOG.warn("modifySeparateTestWindowToDetectPageLoads: no windowObject!");
    return
  }
  if (this._windowClosed(windowObject)) {
    //LOG.info("modifySeparateTestWindowToDetectPageLoads: windowObject was closed");
    return
  }
  let oldMarker = this.isPollingForLoad(windowObject)
  if (oldMarker) {
    //LOG.debug("modifySeparateTestWindowToDetectPageLoads: already polling this window: " + oldMarker);
    return
  }

  let marker = 'selenium' + new Date().getTime()
  //LOG.debug("Starting pollForLoad (" + marker + "): " + windowObject.location);
  this.pollingForLoad[marker] = true
  // if this is a frame, add a load listener, otherwise, attach a poller
  let frameElement = this._getFrameElement(windowObject)
  // DGF HTA mode can't attach load listeners to subframes (yuk!)
  let htaSubFrame = this._isHTASubFrame(windowObject)
  if (frameElement && !htaSubFrame) {
    //LOG.debug("modifySeparateTestWindowToDetectPageLoads: this window is a frame; attaching a load listener");
    //addLoadListener(frameElement, this.recordPageLoad); TODO: check if this is necessary
    frameElement[marker] = true
    frameElement['frame' + this.uniqueId] = marker
    //LOG.debug("dgf this.uniqueId="+this.uniqueId);
    //LOG.debug("dgf marker="+marker);
    //LOG.debug("dgf frameElement['frame'+this.uniqueId]="+frameElement['frame'+this.uniqueId]);
    frameElement[this.uniqueId] = marker
    //LOG.debug("dgf frameElement[this.uniqueId]="+frameElement[this.uniqueId]);
  } else {
    windowObject.location[marker] = true
    windowObject[this.uniqueId] = marker
    this.pollForLoad(
      this.recordPageLoad,
      windowObject,
      windowObject.document,
      windowObject.location,
      windowObject.location.href,
      marker
    )
  }
}

BrowserBot.prototype._isHTASubFrame = function() {
  if (!browserVersion.isHTA) return false
  // DGF this is wrong! what if "win" isn't the selected window?
  return this.isSubFrameSelected
}

BrowserBot.prototype._getFrameElement = function(win) {
  let frameElement = null
  let caught
  try {
    frameElement = win.frameElement
  } catch (e) {
    caught = true
  }
  if (caught) {
    // on IE, checking frameElement in a pop-up results in a "No such interface supported" exception
    // but it might have a frame element anyway!
    let parentContainsIdenticallyNamedFrame = false
    try {
      parentContainsIdenticallyNamedFrame = win.parent.frames[win.name]
    } catch (e) {} // eslint-disable-line no-empty
    // this may fail if access is denied to the parent; in that case, assume it's not a pop-up

    if (parentContainsIdenticallyNamedFrame) {
      // it can't be a coincidence that the parent has a frame with the same name as myself!
      let result
      try {
        result = parentContainsIdenticallyNamedFrame.frameElement
        if (result) {
          return result
        }
      } catch (e) {} // eslint-disable-line no-empty
      // it was worth a try! _getFrameElementsByName is often slow
      result = this._getFrameElementByName(win.name, win.parent.document, win)
      return result
    }
  }
  //LOG.debug("_getFrameElement: frameElement="+frameElement);
  if (frameElement) {
    //LOG.debug("frameElement.name="+frameElement.name);
  }
  return frameElement
}

BrowserBot.prototype._getFrameElementByName = function(name, doc, win) {
  let frames
  let frame
  let i
  frames = doc.getElementsByTagName('iframe')
  for (i = 0; i < frames.length; i++) {
    frame = frames[i]
    if (frame.name === name) {
      return frame
    }
  }
  frames = doc.getElementsByTagName('frame')
  for (i = 0; i < frames.length; i++) {
    frame = frames[i]
    if (frame.name === name) {
      return frame
    }
  }
  // DGF weird; we only call this function when we know the doc contains the frame
  //LOG.warn("_getFrameElementByName couldn't find a frame or iframe; checking every element for the name " + name);
  return BrowserBot.prototype.locateElementByName(win.name, win.parent.document)
}

/**
 * Set up a polling timer that will keep checking the readyState of the document until it's complete.
 * Since we might call this before the original page is unloaded, we first check to see that the current location
 * or href is different from the original one.
 */
BrowserBot.prototype.pollForLoad = function(
  loadFunction,
  windowObject,
  originalDocument,
  originalLocation,
  originalHref,
  marker
) {
  //LOG.debug("pollForLoad original (" + marker + "): " + originalHref);
  try {
    //Samit: Fix: open command sometimes fails if current url is chrome and new is not
    windowObject = core.firefox.unwrap(windowObject)
    if (this._windowClosed(windowObject)) {
      //LOG.debug("pollForLoad WINDOW CLOSED (" + marker + ")");
      delete this.pollingForLoad[marker]
      return
    }

    let isSamePage = this._isSamePage(
      windowObject,
      originalDocument,
      originalLocation,
      originalHref,
      marker
    )
    let rs = this.getReadyState(windowObject, windowObject.document)

    if (!isSamePage && rs == 'complete') {
      let currentHref = windowObject.location.href
      //LOG.debug("pollForLoad FINISHED (" + marker + "): " + rs + " (" + currentHref + ")");
      delete this.pollingForLoad[marker]
      this._modifyWindow(windowObject)
      let newMarker = this.isPollingForLoad(windowObject)
      if (!newMarker) {
        //LOG.debug("modifyWindow didn't start new poller: " + newMarker);
        this.modifySeparateTestWindowToDetectPageLoads(windowObject)
      }
      newMarker = this.isPollingForLoad(windowObject)
      let currentlySelectedWindow
      let currentlySelectedWindowMarker
      currentlySelectedWindow = this.getCurrentWindow(true)
      currentlySelectedWindowMarker = currentlySelectedWindow[this.uniqueId]

      //LOG.debug("pollForLoad (" + marker + ") restarting " + newMarker);
      if (/(TestRunner-splash|Blank)\.html\?start=true$/.test(currentHref)) {
        //LOG.debug("pollForLoad Oh, it's just the starting page.  Never mind!");
      } else if (currentlySelectedWindowMarker == newMarker) {
        loadFunction(currentlySelectedWindow)
      } else {
        //LOG.debug("pollForLoad page load detected in non-current window; ignoring (currentlySelected="+currentlySelectedWindowMarker+", detection in "+newMarker+")");
      }
      return
    }
    //LOG.debug("pollForLoad continue (" + marker + "): " + currentHref);
    this.reschedulePoller(
      loadFunction,
      windowObject,
      originalDocument,
      originalLocation,
      originalHref,
      marker
    )
  } catch (e) {
    //LOG.debug("Exception during pollForLoad; this should get noticed soon (" + e.message + ")!");
    //DGF this is supposed to get logged later; log it at debug just in case
    ////LOG.exception(e);
    this.pageLoadError = e
  }
}

BrowserBot.prototype._isSamePage = function(
  windowObject,
  originalDocument,
  originalLocation,
  originalHref,
  marker
) {
  let currentDocument = windowObject.document
  let currentLocation = windowObject.location
  let currentHref = currentLocation.href

  let sameDoc = this._isSameDocument(originalDocument, currentDocument)

  let sameLoc = originalLocation === currentLocation

  // hash marks don't meant the page has loaded, so we need to strip them off if they exist...
  let currentHash = currentHref.indexOf('#')
  if (currentHash > 0) {
    currentHref = currentHref.substring(0, currentHash)
  }
  let originalHash = originalHref.indexOf('#')
  if (originalHash > 0) {
    originalHref = originalHref.substring(0, originalHash)
  }
  //LOG.debug("_isSamePage: currentHref: " + currentHref);
  //LOG.debug("_isSamePage: originalHref: " + originalHref);

  let sameHref = originalHref === currentHref
  let markedLoc = currentLocation[marker]

  if (browserVersion.isKonqueror || browserVersion.isSafari) {
    // the mark disappears too early on these browsers
    markedLoc = true
  }

  // since this is some _very_ important logic, especially for PI and multiWindow mode, we should log all these out
  //LOG.debug("_isSamePage: sameDoc: " + sameDoc);
  //LOG.debug("_isSamePage: sameLoc: " + sameLoc);
  //LOG.debug("_isSamePage: sameHref: " + sameHref);
  //LOG.debug("_isSamePage: markedLoc: " + markedLoc);

  return sameDoc && sameLoc && sameHref && markedLoc
}

BrowserBot.prototype._isSameDocument = function(
  originalDocument,
  currentDocument
) {
  return originalDocument === currentDocument
}

BrowserBot.prototype.getReadyState = function(windowObject, currentDocument) {
  let rs = currentDocument.readyState
  if (rs == null) {
    if (
      (this.buttonWindow != null &&
        this.buttonWindow.document.readyState == null) || // not proxy injection mode (and therefore buttonWindow isn't null)
      top.document.readyState == null
    ) {
      // proxy injection mode (and therefore everything's in the top window, but buttonWindow doesn't exist)
      // uh oh!  we're probably on Firefox with no readyState extension installed!
      // We'll have to just take a guess as to when the document is loaded; this guess
      // will never be perfect. :-(
      if (
        typeof currentDocument.getElementsByTagName != 'undefined' &&
        typeof currentDocument.getElementById != 'undefined' &&
        (currentDocument.getElementsByTagName('body')[0] != null ||
          currentDocument.body != null)
      ) {
        if (
          windowObject.frameElement &&
          windowObject.location.href == 'about:blank' &&
          windowObject.frameElement.src != 'about:blank'
        ) {
          //LOG.info("getReadyState not loaded, frame location was about:blank, but frame src = " + windowObject.frameElement.src);
          return null
        }
        //LOG.debug("getReadyState = windowObject.frames.length = " + windowObject.frames.length);
        for (let i = 0; i < windowObject.frames.length; i++) {
          //LOG.debug("i = " + i);
          if (
            this.getReadyState(
              windowObject.frames[i],
              windowObject.frames[i].document
            ) != 'complete'
          ) {
            //LOG.debug("getReadyState aha! the nested frame " + windowObject.frames[i].name + " wasn't ready!");
            return null
          }
        }

        rs = 'complete'
      } else {
        //LOG.debug("pollForLoad readyState was null and DOM appeared to not be ready yet");
      }
    }
  } else if (rs == 'loading' && browserVersion.isIE) {
    //LOG.debug("pageUnloading = true!!!!");
    this.pageUnloading = true
  }
  //LOG.debug("getReadyState returning " + rs);
  return rs
}

/** This function isn't used normally, but was the way we used to schedule pollers:
 asynchronously executed autonomous units.  This is deprecated, but remains here
 for future reference.
 */
BrowserBot.prototype.XXXreschedulePoller = function(
  loadFunction,
  windowObject,
  originalDocument,
  originalLocation,
  originalHref,
  marker
) {
  let self = this
  window.setTimeout(function() {
    self.pollForLoad(
      loadFunction,
      windowObject,
      originalDocument,
      originalLocation,
      originalHref,
      marker
    )
  }, 500)
}

/** This function isn't used normally, but is useful for debugging asynchronous pollers
 * To enable it, rename it to "reschedulePoller", so it will override the
 * existing reschedulePoller function
 */
BrowserBot.prototype.XXXreschedulePoller = function(
  loadFunction,
  windowObject,
  originalDocument,
  originalLocation,
  originalHref,
  marker
) {
  let doc = this.buttonWindow.document
  let button = doc.createElement('button')
  let buttonName = doc.createTextNode(marker + ' - ' + windowObject.name)
  button.appendChild(buttonName)
  let tools = doc.getElementById('tools')
  let self = this
  button.onclick = function() {
    tools.removeChild(button)
    self.pollForLoad(
      loadFunction,
      windowObject,
      originalDocument,
      originalLocation,
      originalHref,
      marker
    )
  }
  tools.appendChild(button)
  window.setTimeout(button.onclick, 500)
}

BrowserBot.prototype.reschedulePoller = function(
  loadFunction,
  windowObject,
  originalDocument,
  originalLocation,
  originalHref,
  marker
) {
  let self = this
  let pollerFunction = function() {
    self.pollForLoad(
      loadFunction,
      windowObject,
      originalDocument,
      originalLocation,
      originalHref,
      marker
    )
  }
  this.windowPollers.push(pollerFunction)
}

BrowserBot.prototype.runScheduledPollers = function() {
  //LOG.debug("runScheduledPollers");
  let oldPollers = this.windowPollers
  this.windowPollers = new Array()
  for (let i = 0; i < oldPollers.length; i++) {
    oldPollers[i].call()
  }
  //LOG.debug("runScheduledPollers DONE");
}

BrowserBot.prototype.isPollingForLoad = function(win) {
  let marker
  let frameElement = this._getFrameElement(win)
  let htaSubFrame = this._isHTASubFrame(win)
  if (frameElement && !htaSubFrame) {
    marker = frameElement['frame' + this.uniqueId]
  } else {
    marker = win[this.uniqueId]
  }
  if (!marker) {
    //LOG.debug("isPollingForLoad false, missing uniqueId " + this.uniqueId + ": " + marker);
    return false
  }
  if (!this.pollingForLoad[marker]) {
    //LOG.debug("isPollingForLoad false, this.pollingForLoad[" + marker + "]: " + this.pollingForLoad[marker]);
    return false
  }
  return marker
}

BrowserBot.prototype.getWindowByName = function(windowName, doNotModify) {
  //LOG.debug("getWindowByName(" + windowName + ")");
  // First look in the map of opened windows
  let targetWindow = this.openedWindows[windowName]
  if (!targetWindow) {
    targetWindow = this.topWindow[windowName]
  }
  if (!targetWindow && windowName == '_blank') {
    for (let winName in this.openedWindows) {
      // _blank can match selenium_blank*, if it looks like it's OK (valid href, not closed)
      if (/^selenium_blank/.test(winName)) {
        targetWindow = this.openedWindows[winName]
        let ok
        try {
          if (!this._windowClosed(targetWindow)) {
            ok = targetWindow.location.href
          }
        } catch (e) {} // eslint-disable-line no-empty
        if (ok) break
      }
    }
  }
  if (!targetWindow) {
    throw new SeleniumError(
      'Window does not exist. If this looks like a Selenium bug, make sure to read http://seleniumhq.org/docs/02_selenium_ide.html#alerts-popups-and-multiple-windows for potential workarounds.'
    )
  }
  if (browserVersion.isHTA) {
    try {
      targetWindow.location.href
    } catch (e) {
      targetWindow = window.open('', targetWindow.name)
      this.openedWindows[targetWindow.name] = targetWindow
    }
  }
  if (!doNotModify) {
    this._modifyWindow(targetWindow)
  }
  return targetWindow
}

/**
 * Find a window name from the window title.
 */
BrowserBot.prototype.getWindowNameByTitle = function(windowTitle) {
  //LOG.debug("getWindowNameByTitle(" + windowTitle + ")");

  // First look in the map of opened windows and iterate them
  for (let windowName in this.openedWindows) {
    let targetWindow = this.openedWindows[windowName]

    // If the target window's title is our title
    try {
      // TODO implement Pattern Matching here
      if (
        !this._windowClosed(targetWindow) &&
        targetWindow.document.title == windowTitle
      ) {
        return windowName
      }
    } catch (e) {
      // You'll often get Permission Denied errors here in IE
      // eh, if we can't read this window's title,
      // it's probably not available to us right now anyway
    }
  }

  try {
    if (this.topWindow.document.title == windowTitle) {
      return ''
    }
  } catch (e) {} // eslint-disable-line no-empty
  // IE Perm denied

  throw new SeleniumError('Could not find window with title ' + windowTitle)
}

BrowserBot.prototype.getNonTopWindowNames = function() {
  let nonTopWindowNames = []

  for (let windowName in this.openedWindows) {
    let win = this.openedWindows[windowName]
    if (!this._windowClosed(win) && win != this.topWindow) {
      nonTopWindowNames.push(windowName)
    }
  }

  return nonTopWindowNames
}

BrowserBot.prototype.getCurrentWindow = function(doNotModify) {
  if (this.proxyInjectionMode) {
    return window
  }
  let testWindow = core.firefox.unwrap(this.currentWindow)
  if (!doNotModify) {
    this._modifyWindow(testWindow)
    //LOG.debug("getCurrentWindow newPageLoaded = false");
    this.newPageLoaded = false
  }
  testWindow = this._handleClosedSubFrame(testWindow, doNotModify)
  bot.window_ = testWindow
  return core.firefox.unwrap(testWindow)
}

/**
 * Offer a method the end-user can reliably use to retrieve the current window.
 * This should work even for windows with an XPCNativeWrapper. Returns the
 * current window object.
 */
BrowserBot.prototype.getUserWindow = function() {
  let userWindow = this.getCurrentWindow(true)
  return userWindow
}

BrowserBot.prototype._handleClosedSubFrame = function(testWindow, doNotModify) {
  if (this.proxyInjectionMode) {
    return testWindow
  }

  if (this.isSubFrameSelected) {
    let missing = true
    if (
      testWindow.parent &&
      testWindow.parent.frames &&
      testWindow.parent.frames.length
    ) {
      for (let i = 0; i < testWindow.parent.frames.length; i++) {
        let frame = testWindow.parent.frames[i]
        if (
          frame == testWindow ||
          frame.seleniumKey == testWindow.seleniumKey
        ) {
          missing = false
          break
        }
      }
    }
    if (missing) {
      //LOG.warn("Current subframe appears to have closed; selecting top frame");
      this.selectFrame('relative=top')
      return this.getCurrentWindow(doNotModify)
    }
  } else if (this._windowClosed(testWindow)) {
    //UnnamedWinIFrameExt, Jie-Lin You, SELAB, CSIE, NCKU, 2016/11/25
    /*var closedError = new SeleniumError("Current window or frame is closed!");
        closedError.windowClosed = true;
        throw closedError;*/
    testWindow = this.topWindow //select live object
  }
  return testWindow
}

BrowserBot.prototype.setShouldHighlightElement = function(shouldHighlight) {
  this.shouldHighlightLocatedElement = shouldHighlight
}

/*****************************************************************/
/* BROWSER-SPECIFIC FUNCTIONS ONLY AFTER THIS LINE */

BrowserBot.prototype._registerAllLocatorFunctions = function() {
  // TODO - don't do this in the constructor - only needed once ever
  this.locationStrategies = {}
  for (let functionName in this) {
    let result = /^locateElementBy([A-Z].+)$/.exec(functionName)
    if (result != null) {
      let locatorFunction = this[functionName]
      if (typeof locatorFunction != 'function') {
        continue
      }
      // Use a specified prefix in preference to one generated from
      // the function name
      let locatorPrefix = locatorFunction.prefix || result[1].toLowerCase()
      this.locationStrategies[locatorPrefix] = locatorFunction
    }
  }

  /**
   * Find a locator based on a prefix.
   */
  this.findElementBy = function(locatorType, locator, inDocument, inWindow) {
    let locatorFunction = this.locationStrategies[locatorType]
    if (!locatorFunction) {
      throw new SeleniumError(
        "Unrecognised locator type: '" + locatorType + "'"
      )
    }
    return locatorFunction.call(this, locator, inDocument, inWindow)
  }

  /**
   * The implicit locator, that is used when no prefix is supplied.
   */
  this.locationStrategies['implicit'] = function(
    locator,
    inDocument,
    inWindow
  ) {
    if (locator.startsWith('//')) {
      return this.locateElementByXPath(locator, inDocument, inWindow)
    }
    if (locator.startsWith('document.')) {
      return this.locateElementByDomTraversal(locator, inDocument, inWindow)
    }
    return this.locateElementByIdentifier(locator, inDocument, inWindow)
  }
}

BrowserBot.prototype.getDocument = function() {
  return core.firefox.unwrap(this.getCurrentWindow().document)
}

BrowserBot.prototype.getTitle = function() {
  let t = this.getDocument().title
  if (typeof t == 'string') {
    t = t.trim()
  }
  return t
}

BrowserBot.prototype.getCookieByName = function(cookieName, doc) {
  if (!doc) doc = this.getDocument()
  let ck = doc.cookie
  if (!ck) return null
  let ckPairs = ck.split(/;/)
  for (let i = 0; i < ckPairs.length; i++) {
    let ckPair = ckPairs[i].trim()
    let ckNameValue = ckPair.split(/=/)
    let ckName = decodeURIComponent(ckNameValue[0])
    if (ckName === cookieName) {
      return decodeURIComponent(ckNameValue.slice(1).join('='))
    }
  }
  return null
}

BrowserBot.prototype.getAllCookieNames = function(doc) {
  if (!doc) doc = this.getDocument()
  let ck = doc.cookie
  if (!ck) return []
  let cookieNames = []
  let ckPairs = ck.split(/;/)
  for (let i = 0; i < ckPairs.length; i++) {
    let ckPair = ckPairs[i].trim()
    let ckNameValue = ckPair.split(/=/)
    let ckName = decodeURIComponent(ckNameValue[0])
    cookieNames.push(ckName)
  }
  return cookieNames
}

BrowserBot.prototype.getAllRawCookieNames = function(doc) {
  if (!doc) doc = this.getDocument()
  let ck = doc.cookie
  if (!ck) return []
  let cookieNames = []
  let ckPairs = ck.split(/;/)
  for (let i = 0; i < ckPairs.length; i++) {
    let ckPair = ckPairs[i].trim()
    let ckNameValue = ckPair.split(/=/)
    let ckName = ckNameValue[0]
    cookieNames.push(ckName)
  }
  return cookieNames
}

function encodeURIComponentWithASPHack(uri) {
  let regularEncoding = encodeURIComponent(uri)
  let aggressiveEncoding = regularEncoding.replace('.', '%2E')
  aggressiveEncoding = aggressiveEncoding.replace('_', '%5F')
  return aggressiveEncoding
}

BrowserBot.prototype.deleteCookie = function(cookieName, domain, path, doc) {
  if (!doc) doc = this.getDocument()
  let expireDateInMilliseconds = new Date().getTime() + -1 * 1000

  // we can't really be sure if we're dealing with encoded or unencoded cookie names
  let _cookieName
  let rawCookieNames = this.getAllRawCookieNames(doc)
  for (let rawCookieNumber in rawCookieNames) {
    if (rawCookieNames[rawCookieNumber] == cookieName) {
      _cookieName = cookieName
      break
    } else if (
      rawCookieNames[rawCookieNumber] == encodeURIComponent(cookieName)
    ) {
      _cookieName = encodeURIComponent(cookieName)
      break
    } else if (
      rawCookieNames[rawCookieNumber] ==
      encodeURIComponentWithASPHack(cookieName)
    ) {
      _cookieName = encodeURIComponentWithASPHack(cookieName)
      break
    }
  }

  let cookie = _cookieName + '=deleted; '
  if (path) {
    cookie += 'path=' + path + '; '
  }
  if (domain) {
    cookie += 'domain=' + domain + '; '
  }
  cookie += 'expires=' + new Date(expireDateInMilliseconds).toGMTString()
  //LOG.debug("Setting cookie to: " + cookie);
  doc.cookie = cookie
}

/** Try to delete cookie, return false if it didn't work */
BrowserBot.prototype._maybeDeleteCookie = function(
  cookieName,
  domain,
  path,
  doc
) {
  this.deleteCookie(cookieName, domain, path, doc)
  return !this.getCookieByName(cookieName, doc)
}

BrowserBot.prototype._recursivelyDeleteCookieDomains = function(
  cookieName,
  domain,
  path,
  doc
) {
  let deleted = this._maybeDeleteCookie(cookieName, domain, path, doc)
  if (deleted) return true
  let dotIndex = domain.indexOf('.')
  if (dotIndex == 0) {
    return this._recursivelyDeleteCookieDomains(
      cookieName,
      domain.substring(1),
      path,
      doc
    )
  } else if (dotIndex != -1) {
    return this._recursivelyDeleteCookieDomains(
      cookieName,
      domain.substring(dotIndex),
      path,
      doc
    )
  } else {
    // No more dots; try just not passing in a domain at all
    return this._maybeDeleteCookie(cookieName, null, path, doc)
  }
}

BrowserBot.prototype._recursivelyDeleteCookie = function(
  cookieName,
  domain,
  path,
  doc
) {
  let slashIndex = path.lastIndexOf('/')
  let finalIndex = path.length - 1
  if (slashIndex == finalIndex) {
    slashIndex--
  }
  if (slashIndex != -1) {
    const deleted = this._recursivelyDeleteCookie(
      cookieName,
      domain,
      path.substring(0, slashIndex + 1),
      doc
    )
    if (deleted) return true
  }
  return this._recursivelyDeleteCookieDomains(cookieName, domain, path, doc)
}

BrowserBot.prototype.recursivelyDeleteCookie = function(
  cookieName,
  domain,
  path,
  win
) {
  if (!win) win = this.getCurrentWindow()
  let doc = win.document
  if (!domain) {
    domain = doc.domain
  }
  if (!path) {
    path = win.location.pathname
  }
  let deleted = this._recursivelyDeleteCookie(
    cookieName,
    '.' + domain,
    path,
    doc
  )
  if (deleted) return
  // Finally try a null path (Try it last because it's uncommon)
  deleted = this._recursivelyDeleteCookieDomains(
    cookieName,
    '.' + domain,
    null,
    doc
  )
  if (deleted) return
  throw new SeleniumError("Couldn't delete cookie " + cookieName)
}

/*
 * Finds an element on the current page, using various lookup protocols
 */
BrowserBot.prototype.findElementOrNull = function(locator, win) {
  locator = parse_locator(locator)

  if (win == null) {
    win = this.getCurrentWindow()
  }
  let element = bot.locators.findElement(
    { [locator.type]: locator.string },
    win.document
  )
  element = core.firefox.unwrap(element)

  // Element was not found by any locator function.
  return element
}

BrowserBot.prototype.findElement = function(locator, win) {
  let element = this.findElementOrNull(locator, win)
  if (element == null)
    throw new SeleniumError('Element ' + locator + ' not found')
  return core.firefox.unwrap(element)
}

/**
 * Finds a list of elements using the same mechanism as webdriver.
 *
 * @param {string} how The finding mechanism to use.
 * @param {string} using The selector to use.
 * @param {Document|Element} root The root of the search path.
 */
BrowserBot.prototype.findElementsLikeWebDriver = function(how, using, root) {
  let by = {}
  by[how] = using

  let all = bot.locators.findElements(by, root)
  let toReturn = ''

  for (let i = 0; i < all.length - 1; i++) {
    toReturn += bot.inject.cache.addElement(core.firefox.unwrap(all[i])) + ','
  }
  if (all[all.length - 1]) {
    toReturn += bot.inject.cache.addElement(
      core.firefox.unwrap(all[all.length - 1])
    )
  }

  return toReturn
}

/**
 * In non-IE browsers, getElementById() does not search by name.  Instead, we
 * we search separately by id and name.
 */
BrowserBot.prototype.locateElementByIdentifier = function(
  identifier,
  inDocument,
  inWindow
) {
  // HBC - use "this" instead of "BrowserBot.prototype"; otherwise we lose
  // the non-prototype fields of the object!
  return (
    this.locateElementById(identifier, inDocument, inWindow) ||
    BrowserBot.prototype.locateElementByName(
      identifier,
      inDocument,
      inWindow
    ) ||
    null
  )
}

/**
 * Find the element with id - can't rely on getElementById, coz it returns by name as well in IE..
 */
BrowserBot.prototype.locateElementById = function(identifier, inDocument) {
  let element = inDocument.getElementById(identifier)
  if (element && element.getAttribute('id') === identifier) {
    return element
  } else if (browserVersion.isIE || browserVersion.isOpera) {
    // SEL-484
    let elements = inDocument.getElementsByTagName('*')

    for (let i = 0, n = elements.length; i < n; ++i) {
      element = elements[i]

      if (element.tagName.toLowerCase() == 'form') {
        if (element.attributes['id'].nodeValue == identifier) {
          return element
        }
      } else if (element.getAttribute('id') == identifier) {
        return element
      }
    }

    return null
  } else {
    return null
  }
}

/**
 * Find an element by name, refined by (optional) element-filter
 * expressions.
 */
BrowserBot.prototype.locateElementByName = function(locator, document) {
  let elements = document.getElementsByTagName('*')
  //UnnamedWinIFrameExt, Jie-Lin You, SELAB, CSIE, NCKU, 2016/11/23
  /*
        var filters = locator.split(' ');
        filters[0] = 'name=' + filters[0];

        while (filters.length) {
            var filter = filters.shift();
            elements = this.selectElements(filter, elements, 'value');
        }
        */
  let filter = 'name=' + locator
  elements = this.selectElements(filter, elements, 'value')

  if (elements.length > 0) {
    return elements[0]
  }
  return null
}

/**
 * Finds an element using by evaluating the specfied string.
 */
BrowserBot.prototype.locateElementByDomTraversal = function(domTraversal) {
  let element = null

  //Evalinsandbox
  // eslint-disable-next-line no-undef
  let mySandbox = new Components.utils.Sandbox(this.currentWindow.location.href)
  mySandbox.domTraversal = domTraversal
  try {
    // eslint-disable-next-line no-undef
    element = Components.utils.evalInSandbox(domTraversal, mySandbox)
    //element = eval(domTraversal);
  } catch (e) {
    return null
  }

  if (!element) {
    return null
  }

  return element
}

BrowserBot.prototype.locateElementByDomTraversal.prefix = 'dom'

BrowserBot.prototype.locateElementByStoredReference = function(locator) {
  try {
    return core.locators.findElement('stored=' + locator)
  } catch (e) {
    return null
  }
}
BrowserBot.prototype.locateElementByStoredReference.prefix = 'stored'

BrowserBot.prototype.locateElementByWebDriver = function(locator) {
  try {
    return core.locators.findElement('webdriver=' + locator)
  } catch (e) {
    return null
  }
}
BrowserBot.prototype.locateElementByWebDriver.prefix = 'webdriver'

/**
 * Finds an element identified by the xpath expression. Expressions _must_
 * begin with "//".
 */
BrowserBot.prototype.locateElementByXPath = function(xpath, inDocument) {
  return this.xpathEvaluator.selectSingleNode(
    inDocument,
    xpath,
    null,
    inDocument.createNSResolver
      ? inDocument.createNSResolver(inDocument.documentElement)
      : this._namespaceResolver
  )
}

/**
 * Find many elements using xpath.
 *
 * @param {string} xpath XPath expression to search for.
 * @param {=Document} inDocument The document to search in.
 * @param {=Window} inWindow The window the document is in.
 */
BrowserBot.prototype.locateElementsByXPath = function(xpath, inDocument) {
  return this.xpathEvaluator.selectNodes(
    inDocument,
    xpath,
    null,
    inDocument.createNSResolver
      ? inDocument.createNSResolver(inDocument.documentElement)
      : this._namespaceResolver
  )
}

BrowserBot.prototype._namespaceResolver = function(prefix) {
  if (prefix == 'html' || prefix == 'xhtml' || prefix == 'x') {
    return 'http://www.w3.org/1999/xhtml'
  } else if (prefix == 'mathml') {
    return 'http://www.w3.org/1998/Math/MathML'
  } else if (prefix == 'svg') {
    return 'http://www.w3.org/2000/svg'
  } else {
    throw new Error('Unknown namespace: ' + prefix + '.')
  }
}

/**
 * Returns the number of xpath results.
 */
BrowserBot.prototype.evaluateXPathCount = function(selector, inDocument) {
  let locator = parse_locator(selector)
  if (locator.type == 'xpath' || locator.type == 'implicit') {
    return bot.locators.findElements({ xpath: locator.string }, inDocument)
      .length
  } else {
    //LOG.error("Locator does not use XPath strategy: " + selector);
    return 0
  }
}

/**
 * Returns the number of css results.
 */
BrowserBot.prototype.evaluateCssCount = function(selector, inDocument) {
  let locator = parse_locator(selector)
  if (locator.type == 'css' || locator.type == 'implicit') {
    return bot.locators.findElements({ css: locator.string }, inDocument).length
  } else {
    //LOG.error("Locator does not use CSS strategy: " + selector);
    return 0
  }
}

/**
 * Finds a link element with text matching the expression supplied. Expressions must
 * begin with "link:".
 */
BrowserBot.prototype.locateElementByLinkText = function(linkText, inDocument) {
  let links = inDocument.getElementsByTagName('a')
  for (let i = 0; i < links.length; i++) {
    let element = links[i]
    if (PatternMatcher.matches(linkText, bot.dom.getVisibleText(element))) {
      return element
    }
  }
  return null
}

BrowserBot.prototype.locateElementByLinkText.prefix = 'link'

/**
 * Returns an attribute based on an attribute locator. This is made up of an element locator
 * suffixed with @attribute-name.
 */
BrowserBot.prototype.findAttribute = function(locator) {
  // Split into locator + attributeName
  let attributePos = locator.lastIndexOf('@')
  let elementLocator = locator.slice(0, attributePos)
  let attributeName = locator.slice(attributePos + 1)

  // Find the element.
  let element = this.findElement(elementLocator)
  let attributeValue = bot.dom.getAttribute(element, attributeName)
  return goog.isDefAndNotNull(attributeValue) ? attributeValue.toString() : null
}

/*
 * Select the specified option and trigger the relevant events of the element.
 */
BrowserBot.prototype.selectOption = function(element, optionToSelect) {
  bot.events.fire(element, bot.events.EventType.FOCUS)
  let changed = false
  for (let i = 0; i < element.options.length; i++) {
    let option = element.options[i]
    if (option.selected && option != optionToSelect) {
      option.selected = false
      changed = true
    } else if (!option.selected && option == optionToSelect) {
      option.selected = true
      changed = true
    }
  }

  if (changed) {
    bot.events.fire(element, bot.events.EventType.CHANGE)
  }
}

/*
 * Select the specified option and trigger the relevant events of the element.
 */
BrowserBot.prototype.addSelection = function(element, option) {
  this.checkMultiselect(element)
  bot.events.fire(element, bot.events.EventType.FOCUS)
  if (!option.selected) {
    option.selected = true
    bot.events.fire(element, bot.events.EventType.CHANGE)
  }
}

/*
 * Select the specified option and trigger the relevant events of the element.
 */
BrowserBot.prototype.removeSelection = function(element, option) {
  this.checkMultiselect(element)
  bot.events.fire(element, bot.events.EventType.FOCUS)
  if (option.selected) {
    option.selected = false
    bot.events.fire(element, bot.events.EventType.CHANGE)
  }
}

BrowserBot.prototype.checkMultiselect = function(element) {
  if (!element.multiple) {
    throw new SeleniumError('Not a multi-select')
  }
}

BrowserBot.prototype.replaceText = function(element, stringValue) {
  bot.events.fire(element, bot.events.EventType.FOCUS)
  bot.events.fire(element, bot.events.EventType.SELECT)
  let maxLengthAttr = element.getAttribute('maxLength')
  let actualValue = stringValue
  if (maxLengthAttr != null) {
    let maxLength = parseInt(maxLengthAttr)
    if (stringValue.length > maxLength) {
      actualValue = stringValue.substr(0, maxLength)
    }
  }

  if (getTagName(element) == 'body') {
    if (element.ownerDocument && element.ownerDocument.designMode) {
      let designMode = new String(
        element.ownerDocument.designMode
      ).toLowerCase()
      if (designMode == 'on') {
        // this must be a rich text control!
        element.innerHTML = actualValue
      }
    }
  } else {
    element.value = actualValue
  }
  // DGF this used to be skipped in chrome URLs, but no longer.  Is xpcnativewrappers to blame?
  try {
    bot.events.fire(element, bot.events.EventType.CHANGE)
  } catch (e) {} // eslint-disable-line no-empty
}

BrowserBot.prototype.clickElement = function(element, clientX, clientY) {
  this._fireEventOnElement('click', element, clientX, clientY)
}

BrowserBot.prototype.doubleClickElement = function(element, clientX, clientY) {
  this._fireEventOnElement('dblclick', element, clientX, clientY)
}

// The contextmenu event is fired when the user right-clicks to open the context menu
BrowserBot.prototype.contextMenuOnElement = function(
  element,
  clientX,
  clientY
) {
  this._fireEventOnElement('contextmenu', element, clientX, clientY)
}

//UnnamedWinIFrameExt, Jie-Lin You, SELAB, CSIE, NCKU, 2016/05/26
//UnnamedWinIFrameExt, Jie-Lin You, SELAB, CSIE, NCKU, 2016/11/17
BrowserBot.prototype._modifyElementTarget = function(e) {
  let element = this.findClickableElement(e) || e
  if (element.target) {
    if (element.target == '_blank' || /^selenium_blank/.test(element.target)) {
      let tagName = getTagName(element)
      if (tagName == 'a' || tagName == 'form') {
        const newTarget = 'win_ser_' + this.count
        this.count += 1
        this.browserbot.openWindow('', newTarget)
        element.target = newTarget
      }
    } else {
      const newTarget = element.target
      this.browserbot.openWindow('', newTarget)
      element.target = newTarget
    }
  }
}

//UnnamedWinIFrameExt, Jie-Lin You, SELAB, CSIE, NCKU, 2016/11/17
BrowserBot.prototype.findClickableElement = function(e) {
  if (!e.tagName) return null
  let tagName = e.tagName.toLowerCase()
  let type = e.type
  if (
    e.hasAttribute('onclick') ||
    e.hasAttribute('href') ||
    e.hasAttribute('url') ||
    tagName == 'button' ||
    (tagName == 'input' &&
      (type == 'submit' ||
        type == 'button' ||
        type == 'image' ||
        type == 'radio' ||
        type == 'checkbox' ||
        type == 'reset'))
  ) {
    return e
  } else {
    if (e.parentNode != null) {
      return this.findClickableElement(e.parentNode)
    } else {
      return null
    }
  }
}

BrowserBot.prototype._handleClickingImagesInsideLinks = function(
  targetWindow,
  element
) {
  let itrElement = element
  while (itrElement != null) {
    if (itrElement.href) {
      targetWindow.location.href = itrElement.href
      break
    }
    itrElement = itrElement.parentNode
  }
}

BrowserBot.prototype._getTargetWindow = function(element) {
  let targetWindow = element.ownerDocument.defaultView
  if (element.target) {
    targetWindow = this._getFrameFromGlobal(element.target)
  }
  return targetWindow
}

BrowserBot.prototype._getFrameFromGlobal = function(target) {
  if (target == '_self') {
    return this.getCurrentWindow()
  }
  if (target == '_top') {
    return this.topFrame
  } else if (target == '_parent') {
    return this.getCurrentWindow().parent
  } else if (target == '_blank') {
    // TODO should this set cleverer window defaults?
    return this.getCurrentWindow().open('', '_blank')
  }
  let frameElement = this.findElementBy(
    'implicit',
    target,
    this.topFrame.document,
    this.topFrame
  )
  if (frameElement) {
    return frameElement.contentWindow
  }
  let win = this.getWindowByName(target)
  if (win) return win
  return this.getCurrentWindow().open('', target)
}

BrowserBot.prototype.bodyText = function() {
  if (!this.getDocument().body) {
    throw new SeleniumError(
      "Couldn't access document.body.  Is this HTML page fully loaded?"
    )
  }
  return bot.dom.getVisibleText(this.getDocument().body)
}

BrowserBot.prototype.getAllButtons = function() {
  let elements = this.getDocument().getElementsByTagName('input')
  let result = []

  for (let i = 0; i < elements.length; i++) {
    if (
      elements[i].type == 'button' ||
      elements[i].type == 'submit' ||
      elements[i].type == 'reset'
    ) {
      result.push(elements[i].id)
    }
  }

  return result
}

BrowserBot.prototype.getAllFields = function() {
  let elements = this.getDocument().getElementsByTagName('input')
  let result = []

  for (let i = 0; i < elements.length; i++) {
    if (elements[i].type == 'text') {
      result.push(elements[i].id)
    }
  }

  return result
}

BrowserBot.prototype.getAllLinks = function() {
  let elements = this.getDocument().getElementsByTagName('a')
  let result = []

  for (let i = 0; i < elements.length; i++) {
    result.push(elements[i].id)
  }

  return result
}

function isDefined(value) {
  return typeof value != undefined
}

BrowserBot.prototype.goBack = function() {
  this.getCurrentWindow().history.back()
}

BrowserBot.prototype.goForward = function() {
  this.getCurrentWindow().history.forward()
}

BrowserBot.prototype.close = function() {
  if (browserVersion.isIE) {
    // fix "do you want to close this window" warning in IE
    // You can only close windows that you have opened.
    // So, let's "open" it.
    try {
      this.topFrame.name = new Date().getTime()
      window.open('', this.topFrame.name, '')
      this.topFrame.close()
      return
    } catch (e) {} // eslint-disable-line no-empty
  }
  if (
    browserVersion.isChrome ||
    browserVersion.isSafari ||
    browserVersion.isOpera
  ) {
    this.topFrame.close()
  } else {
    this.getCurrentWindow().eval('window.top.close();')
  }
}

BrowserBot.prototype.refresh = function() {
  this.getCurrentWindow().location.reload(true)
}

/**
 * Refine a list of elements using a filter.
 */
BrowserBot.prototype.selectElementsBy = function(filterType, filter, elements) {
  let filterFunction = BrowserBot.filterFunctions[filterType]
  if (!filterFunction) {
    throw new SeleniumError(
      "Unrecognised element-filter type: '" + filterType + "'"
    )
  }

  return filterFunction(filter, elements)
}

BrowserBot.filterFunctions = {}

BrowserBot.filterFunctions.name = function(name, elements) {
  let selectedElements = []
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].name === name) {
      selectedElements.push(elements[i])
    }
  }
  return selectedElements
}

BrowserBot.filterFunctions.value = function(value, elements) {
  let selectedElements = []
  for (let i = 0; i < elements.length; i++) {
    if (elements[i].value === value) {
      selectedElements.push(elements[i])
    }
  }
  return selectedElements
}

BrowserBot.filterFunctions.index = function(index, elements) {
  index = Number(index)
  if (isNaN(index) || index < 0) {
    throw new SeleniumError('Illegal Index: ' + index)
  }
  if (elements.length <= index) {
    throw new SeleniumError('Index out of range: ' + index)
  }
  return [elements[index]]
}

BrowserBot.prototype.selectElements = function(
  filterExpr,
  elements,
  defaultFilterType
) {
  let filterType = defaultFilterType || 'value'

  // If there is a filter prefix, use the specified strategy
  let result = filterExpr.match(/^([A-Za-z]+)=(.+)/)
  if (result) {
    filterType = result[1].toLowerCase()
    filterExpr = result[2]
  }

  return this.selectElementsBy(filterType, filterExpr, elements)
}

/**
 * Find an element by css selector
 */
BrowserBot.prototype.locateElementByCss = function(locator, document) {
  let elements = bot.locators.findElements({ css: locator }, document)
  if (elements.length != 0) return elements[0]
  return null
}

BrowserBot.prototype.locateRandomElementByCss = function(locator, document) {
  let elements = bot.locators.findElements({ css: locator }, document)
  if (elements.length != 0)
    return elements[(Math.random() * (elements.length - 0 + 1)) << 0]
  return null
}

/* prompt */
BrowserBot.prototype.cancelNextPrompt = function() {
  return this.setNextPromptResult(null)
}

BrowserBot.prototype.setNextPromptResult = function(result) {
  this.promptResponse = false
  let self = this

  window.postMessage(
    {
      direction: 'from-content-script',
      command: 'setNextPromptResult',
      target: result,
    },
    '*'
  )

  let response = new Promise(function(resolve, reject) {
    let count = 0
    let interval = setInterval(function() {
      if (!self.promptResponse) {
        count++
        if (count > 60) {
          reject('No response')
          clearInterval(interval)
        }
      } else {
        resolve()
        self.promptResponse = false
        clearInterval(interval)
      }
    }, 500)
  })
  return response
}

BrowserBot.prototype.getPromptMessage = function() {
  this.promptResponse = false
  this.promptMessage = null
  let self = this
  window.postMessage(
    {
      direction: 'from-content-script',
      command: 'getPromptMessage',
    },
    '*'
  )
  let response = new Promise(function(resolve, reject) {
    let count = 0
    let interval = setInterval(function() {
      if (!self.promptResponse) {
        count++
        if (count > 60) {
          reject('No response')
          clearInterval(interval)
        }
      } else {
        resolve(self.promptMessage)
        self.promptResponse = false
        self.promptMessage = null
        clearInterval(interval)
      }
    }, 500)
  })
  return response
}

// confirm
BrowserBot.prototype.setNextConfirmationResult = function(result) {
  this.confirmationResponse = false
  let self = this
  window.postMessage(
    {
      direction: 'from-content-script',
      command: 'setNextConfirmationResult',
      target: result,
    },
    '*'
  )
  let response = new Promise(function(resolve, reject) {
    let count = 0
    let interval = setInterval(function() {
      if (!self.confirmationResponse) {
        count++
        if (count > 60) {
          reject('No response')
          clearInterval(interval)
        }
      } else {
        resolve()
        self.confirmationResponse = false
        clearInterval(interval)
      }
    }, 500)
  })
  return response
}

BrowserBot.prototype.getConfirmationMessage = function() {
  this.confirmationResponse = false
  this.confirmationMessage = null
  let self = this
  window.postMessage(
    {
      direction: 'from-content-script',
      command: 'getConfirmationMessage',
    },
    '*'
  )
  let response = new Promise(function(resolve, reject) {
    let count = 0
    let interval = setInterval(function() {
      if (!self.confirmationResponse) {
        count++
        if (count > 60) {
          reject('No response')
          clearInterval(interval)
        }
      } else {
        resolve(self.confirmationMessage)
        self.confirmationResponse = false
        self.confirmationMessage = null
        clearInterval(interval)
      }
    }, 500)
  })
  return response
}

BrowserBot.prototype.getAlertMessage = function() {
  let self = this
  let response = new Promise(function(resolve, reject) {
    let count = 0
    let interval = setInterval(function() {
      if (!self.alertResponse) {
        count++
        if (count > 60) {
          reject('No response!!!!')
          clearInterval(interval)
        }
      } else {
        resolve(self.alertMessage)
        self.alertResponse = false
        self.alertMessage = null
        clearInterval(interval)
      }
    }, 500)
  })
  return response
}

/*****************************************************************/
/* BROWSER-SPECIFIC FUNCTIONS ONLY AFTER THIS LINE */

export class MozillaBrowserBot extends BrowserBot {
  constructor(frame) {
    super(frame)
  }
}

export class KonquerorBrowserBot extends BrowserBot {
  constructor(frame) {
    super(frame)
  }
}

KonquerorBrowserBot.prototype.setIFrameLocation = function(iframe, location) {
  // Window doesn't fire onload event when setting src to the current value,
  // so we set it to blank first.
  iframe.src = 'about:blank'
  iframe.src = location
}

KonquerorBrowserBot.prototype._isSameDocument = function(
  originalDocument,
  currentDocument
) {
  // under Konqueror, there may be this case:
  // originalDocument and currentDocument are different objects
  // while their location are same.
  if (originalDocument) {
    return originalDocument.location == currentDocument.location
  } else {
    return originalDocument === currentDocument
  }
}

export class SafariBrowserBot extends BrowserBot {
  constructor(frame) {
    super(frame)
  }
}

SafariBrowserBot.prototype.setIFrameLocation =
  KonquerorBrowserBot.prototype.setIFrameLocation

export class OperaBrowserBot extends BrowserBot {
  constructor(frame) {
    super(frame)
  }
}

OperaBrowserBot.prototype.setIFrameLocation = function(iframe, location) {
  if (iframe.src == location) {
    iframe.src = location + '?reload'
  } else {
    iframe.src = location
  }
}

export class IEBrowserBot extends BrowserBot {
  constructor(frame) {
    super(frame)
  }
}

IEBrowserBot.prototype._handleClosedSubFrame = function(
  testWindow,
  doNotModify
) {
  if (this.proxyInjectionMode) {
    return testWindow
  }

  try {
    testWindow.location.href
    this.permDenied = 0
  } catch (e) {
    this.permDenied++
  }
  if (this._windowClosed(testWindow) || this.permDenied > 4) {
    if (this.isSubFrameSelected) {
      //LOG.warn("Current subframe appears to have closed; selecting top frame");
      this.selectFrame('relative=top')
      return this.getCurrentWindow(doNotModify)
    } else {
      let closedError = new SeleniumError('Current window or frame is closed!')
      closedError.windowClosed = true
      throw closedError
    }
  }
  return testWindow
}

IEBrowserBot.prototype.modifyWindowToRecordPopUpDialogs = function(
  windowToModify,
  browserBot
) {
  BrowserBot.prototype.modifyWindowToRecordPopUpDialogs(
    windowToModify,
    browserBot
  )

  // we will call the previous version of this method from within our own interception
  let oldShowModalDialog = windowToModify.showModalDialog

  windowToModify.showModalDialog = function(url, args, features) {
    // Get relative directory to where TestRunner.html lives
    // A risky assumption is that the user's TestRunner is named TestRunner.html
    let doc_location = document.location.toString()
    let end_of_base_ref = doc_location.indexOf('TestRunner.html')
    let base_ref = doc_location.substring(0, end_of_base_ref)
    let runInterval = ''

    // Only set run interval if options is defined
    if (typeof window.runOptions != 'undefined') {
      runInterval = '&runInterval=' + runOptions.runInterval // eslint-disable-line no-undef
    }

    let testRunnerURL =
      'TestRunner.html?auto=true&singletest=' +
      escape(browserBot.modalDialogTest) +
      '&autoURL=' +
      escape(url) +
      runInterval
    let fullURL = base_ref + testRunnerURL
    browserBot.modalDialogTest = null

    // If using proxy injection mode
    if (this.proxyInjectionMode) {
      fullURL = url
    }
    let returnValue = oldShowModalDialog(fullURL, args, features)
    return returnValue
  }
}

IEBrowserBot.prototype.modifySeparateTestWindowToDetectPageLoads = function(
  windowObject
) {
  this.pageUnloading = false
  let self = this
  let pageUnloadDetector = function() {
    self.pageUnloading = true
  }
  if (windowObject.addEventListener) {
    windowObject.addEventListener('beforeunload', pageUnloadDetector, true)
  } else {
    windowObject.attachEvent('onbeforeunload', pageUnloadDetector)
  }
  BrowserBot.prototype.modifySeparateTestWindowToDetectPageLoads.call(
    this,
    windowObject
  )
}

IEBrowserBot.prototype.pollForLoad = function(
  loadFunction,
  windowObject,
  originalDocument,
  originalLocation,
  originalHref,
  marker
) {
  //LOG.debug("IEBrowserBot.pollForLoad: " + marker);
  if (!this.permDeniedCount[marker]) this.permDeniedCount[marker] = 0
  BrowserBot.prototype.pollForLoad.call(
    this,
    loadFunction,
    windowObject,
    originalDocument,
    originalLocation,
    originalHref,
    marker
  )
  if (this.pageLoadError) {
    if (this.pageUnloading) {
      //LOG.debug("pollForLoad UNLOADING (" + marker + "): caught exception while firing events on unloading page: " + this.pageLoadError.message);
      this.reschedulePoller(
        loadFunction,
        windowObject,
        originalDocument,
        originalLocation,
        originalHref,
        marker
      )
      this.pageLoadError = null
      return
    } else if (
      (this.pageLoadError.message == 'Permission denied' ||
        /^Access is denied/.test(this.pageLoadError.message)) &&
      this.permDeniedCount[marker]++ < 8
    ) {
      if (this.permDeniedCount[marker] > 4) {
        let canAccessThisWindow
        let canAccessCurrentlySelectedWindow
        try {
          windowObject.location.href
          canAccessThisWindow = true
        } catch (e) {} // eslint-disable-line no-empty
        try {
          this.getCurrentWindow(true).location.href
          canAccessCurrentlySelectedWindow = true
        } catch (e) {} // eslint-disable-line no-empty
        if (canAccessCurrentlySelectedWindow & !canAccessThisWindow) {
          //LOG.debug("pollForLoad (" + marker + ") ABORTING: " + this.pageLoadError.message + " (" + this.permDeniedCount[marker] + "), but the currently selected window is fine");
          // returning without rescheduling
          this.pageLoadError = null
          return
        }
      }

      //LOG.debug("pollForLoad (" + marker + "): " + this.pageLoadError.message + " (" + this.permDeniedCount[marker] + "), waiting to see if it goes away");
      this.reschedulePoller(
        loadFunction,
        windowObject,
        originalDocument,
        originalLocation,
        originalHref,
        marker
      )
      this.pageLoadError = null
      return
    }
    //handy for debugging!
    //throw this.pageLoadError;
  }
}

IEBrowserBot.prototype._windowClosed = function(win) {
  try {
    let c = win.closed
    // frame windows claim to be non-closed when their parents are closed
    // but you can't access their document objects in that case
    if (!c) {
      try {
        win.document
      } catch (de) {
        if (de.message == 'Permission denied') {
          // the window is probably unloading, which means it's probably not closed yet
          return false
        } else if (/^Access is denied/.test(de.message)) {
          // rare variation on "Permission denied"?
          //LOG.debug("IEBrowserBot.windowClosed: got " + de.message + " (this.pageUnloading=" + this.pageUnloading + "); assuming window is unloading, probably not closed yet");
          return false
        } else {
          // this is probably one of those frame window situations
          //LOG.debug("IEBrowserBot.windowClosed: couldn't read win.document, assume closed: " + de.message + " (this.pageUnloading=" + this.pageUnloading + ")");
          return true
        }
      }
    }
    if (c == null) {
      //LOG.debug("IEBrowserBot.windowClosed: win.closed was null, assuming closed");
      return true
    }
    return c
  } catch (e) {
    //LOG.debug("IEBrowserBot._windowClosed: Got an exception trying to read win.closed; we'll have to take a guess!");

    if (browserVersion.isHTA) {
      if (e.message == 'Permission denied') {
        // the window is probably unloading, which means it's not closed yet
        return false
      } else {
        // there's a good chance that we've lost contact with the window object if it is closed
        return true
      }
    } else {
      // the window is probably unloading, which means it's not closed yet
      return false
    }
  }
}

/**
 * In IE, getElementById() also searches by name - this is an optimisation for IE.
 */
IEBrowserBot.prototype.locateElementByIdentifer = function(
  identifier,
  inDocument
) {
  return inDocument.getElementById(identifier)
}

SafariBrowserBot.prototype.modifyWindowToRecordPopUpDialogs = function(
  windowToModify,
  browserBot
) {
  BrowserBot.prototype.modifyWindowToRecordPopUpDialogs(
    windowToModify,
    browserBot
  )

  let originalOpen = windowToModify.open
  /*
   * Safari seems to be broken, so that when we manually trigger the onclick method
   * of a button/href, any window.open calls aren't resolved relative to the app location.
   * So here we replace the open() method with one that does resolve the url correctly.
   */
  windowToModify.open = function(url, windowName, windowFeatures, replaceFlag) {
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('/')
    ) {
      return originalOpen(url, windowName, windowFeatures, replaceFlag)
    }

    // Reduce the current path to the directory
    let currentPath = windowToModify.location.pathname || '/'
    currentPath = currentPath.replace(/\/[^\/]*$/, '/') // eslint-disable-line no-useless-escape

    // Remove any leading "./" from the new url.
    url = url.replace(/^\.\//, '')

    const newUrl = currentPath + url

    let openedWindow = originalOpen(
      newUrl,
      windowName,
      windowFeatures,
      replaceFlag
    )
    //LOG.debug("window.open call intercepted; window ID (which you can use with selectWindow()) is \"" +  windowName + "\"");
    if (windowName != null) {
      openedWindow['seleniumWindowName'] = windowName
    }
    return openedWindow
  }
}

MozillaBrowserBot.prototype._fireEventOnElement = function(
  eventType,
  element,
  clientX,
  clientY
) {
  let win = this.getCurrentWindow()
  bot.events.fire(element, bot.events.EventType.FOCUS)

  // Add an event listener that detects if the default action has been prevented.
  // (This is caused by a javascript onclick handler returning false)
  // we capture the whole event, rather than the getPreventDefault() state at the time,
  // because we need to let the entire event bubbling and capturing to go through
  // before making a decision on whether we should force the href
  element.addEventListener(eventType, function() {}, false)

  //this._modifyElementTarget(element);

  // Trigger the event.
  this.browserbot.triggerMouseEvent(element, eventType, true, clientX, clientY)

  if (this._windowClosed(win)) {
    return
  }

  // Perform the link action if preventDefault was set.
  // In chrome URL, the link action is already executed by triggerMouseEvent.
  //if (!browserVersion.isChrome && savedEvent != null && savedEvent.getPreventDefault && !savedEvent.getPreventDefault()) {
  /*
    if (!browserVersion.isChrome && savedEvent != null && savedEvent.defaultPrevented && !savedEvent.defaultPrevented()) {
        var targetWindow = this.browserbot._getTargetWindow(element);
        if (element.href) {
            targetWindow.location.href = element.href;
        } else {
            this.browserbot._handleClickingImagesInsideLinks(targetWindow, element);
        }
    }
    */
}

OperaBrowserBot.prototype._fireEventOnElement = function(
  eventType,
  element,
  clientX,
  clientY
) {
  let win = this.getCurrentWindow()
  bot.events.fire(element, bot.events.EventType.FOCUS)

  this._modifyElementTarget(element)

  // Trigger the click event.
  this.browserbot.triggerMouseEvent(element, eventType, true, clientX, clientY)

  if (this._windowClosed(win)) {
    return
  }
}

KonquerorBrowserBot.prototype._fireEventOnElement = function(
  eventType,
  element,
  clientX,
  clientY
) {
  let win = this.getCurrentWindow()
  bot.events.fire(element, bot.events.EventType.FOCUS)

  this._modifyElementTarget(element)

  if (element[eventType]) {
    element[eventType]()
  } else {
    this.browserbot.triggerMouseEvent(
      element,
      eventType,
      true,
      clientX,
      clientY
    )
  }

  if (this._windowClosed(win)) {
    return
  }
}

SafariBrowserBot.prototype._fireEventOnElement = function(
  eventType,
  element,
  clientX,
  clientY
) {
  bot.events.fire(element, bot.events.EventType.FOCUS)
  this._modifyElementTarget(element)

  // For form element it is simple.
  if (element[eventType]) {
    element[eventType]()
  }
  // For links and other elements, event emulation is required.
  else {
    // todo: deal with anchors?
    this.browserbot.triggerMouseEvent(
      element,
      eventType,
      true,
      clientX,
      clientY
    )
  }
}

SafariBrowserBot.prototype.refresh = function() {
  let win = this.getCurrentWindow()
  if (win.location.hash) {
    // DGF Safari refuses to refresh when there's a hash symbol in the URL
    win.location.hash = ''
    let actuallyReload = function() {
      win.location.reload(true)
    }
    window.setTimeout(actuallyReload, 1)
  } else {
    win.location.reload(true)
  }
}

IEBrowserBot.prototype._fireEventOnElement = function(
  eventType,
  element,
  clientX,
  clientY
) {
  let win = this.getCurrentWindow()
  bot.events.fire(element, bot.events.EventType.FOCUS)

  let wasChecked = element.checked

  // Set a flag that records if the page will unload - this isn't always accurate, because
  // <a href="javascript:alert('foo'):"> triggers the onbeforeunload event, even thought the page won't unload
  let pageUnloading = false
  let pageUnloadDetector = function() {
    pageUnloading = true
  }
  if (win.addEventListener) {
    win.addEventListener('beforeunload', pageUnloadDetector, true)
  } else {
    win.attachEvent('onbeforeunload', pageUnloadDetector)
  }
  this._modifyElementTarget(element)
  if (element[eventType]) {
    element[eventType]()
  } else {
    this.browserbot.triggerMouseEvent(
      element,
      eventType,
      true,
      clientX,
      clientY
    )
  }

  // If the page is going to unload - still attempt to fire any subsequent events.
  // However, we can't guarantee that the page won't unload half way through, so we need to handle exceptions.
  try {
    if (win.removeEventListener) {
      win.removeEventListener('onbeforeunload', pageUnloadDetector, true)
    } else {
      win.detachEvent('onbeforeunload', pageUnloadDetector)
    }

    if (this._windowClosed(win)) {
      return
    }

    // Onchange event is not triggered automatically in IE.
    if (isDefined(element.checked) && wasChecked != element.checked) {
      bot.events.fire(element, bot.events.EventType.CHANGE)
    }
  } catch (e) {
    // If the page is unloading, we may get a "Permission denied" or "Unspecified error".
    // Just ignore it, because the document may have unloaded.
    if (pageUnloading) {
      //LOG.logHook = function() {
      //};
      //LOG.warn("Caught exception when firing events on unloading page: " + e.message);
      return
    }
    throw e
  }
}
