!function(r,e){if("object"==typeof exports&&"object"==typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var s=e();for(var g in s)("object"==typeof exports?exports:r)[g]=s[g]}}("undefined"!=typeof self?self:this,function(){return function(r){var e={};function s(g){if(e[g])return e[g].exports;var n=e[g]={i:g,l:!1,exports:{}};return r[g].call(n.exports,n,n.exports,s),n.l=!0,n.exports}return s.m=r,s.c=e,s.d=function(r,e,g){s.o(r,e)||Object.defineProperty(r,e,{configurable:!1,enumerable:!0,get:g})},s.n=function(r){var e=r&&r.__esModule?function(){return r["default"]}:function(){return r};return s.d(e,"a",e),e},s.o=function(r,e){return Object.prototype.hasOwnProperty.call(r,e)},s.p="/assets/",s(s.s=338)}({11:function(r,e,s){var g,n,t;!function(s,m){if(1)n=[r],void 0===(t="function"==typeof(g=m)?g.apply(e,n):g)||(r.exports=t);else if(void 0!==e)m(r);else{var A={exports:{}};m(A),s.browser=A.exports}}(this,function(r){"use strict";if("undefined"==typeof browser){const e=()=>{const r={alarms:{clear:{minArgs:0,maxArgs:1},clearAll:{minArgs:0,maxArgs:0},get:{minArgs:0,maxArgs:1},getAll:{minArgs:0,maxArgs:0}},bookmarks:{create:{minArgs:1,maxArgs:1},export:{minArgs:0,maxArgs:0},get:{minArgs:1,maxArgs:1},getChildren:{minArgs:1,maxArgs:1},getRecent:{minArgs:1,maxArgs:1},getTree:{minArgs:0,maxArgs:0},getSubTree:{minArgs:1,maxArgs:1},import:{minArgs:0,maxArgs:0},move:{minArgs:2,maxArgs:2},remove:{minArgs:1,maxArgs:1},removeTree:{minArgs:1,maxArgs:1},search:{minArgs:1,maxArgs:1},update:{minArgs:2,maxArgs:2}},browserAction:{getBadgeBackgroundColor:{minArgs:1,maxArgs:1},getBadgeText:{minArgs:1,maxArgs:1},getPopup:{minArgs:1,maxArgs:1},getTitle:{minArgs:1,maxArgs:1},setIcon:{minArgs:1,maxArgs:1}},commands:{getAll:{minArgs:0,maxArgs:0}},contextMenus:{update:{minArgs:2,maxArgs:2},remove:{minArgs:1,maxArgs:1},removeAll:{minArgs:0,maxArgs:0}},cookies:{get:{minArgs:1,maxArgs:1},getAll:{minArgs:1,maxArgs:1},getAllCookieStores:{minArgs:0,maxArgs:0},remove:{minArgs:1,maxArgs:1},set:{minArgs:1,maxArgs:1}},downloads:{download:{minArgs:1,maxArgs:1},cancel:{minArgs:1,maxArgs:1},erase:{minArgs:1,maxArgs:1},getFileIcon:{minArgs:1,maxArgs:2},open:{minArgs:1,maxArgs:1},pause:{minArgs:1,maxArgs:1},removeFile:{minArgs:1,maxArgs:1},resume:{minArgs:1,maxArgs:1},search:{minArgs:1,maxArgs:1},show:{minArgs:1,maxArgs:1}},extension:{isAllowedFileSchemeAccess:{minArgs:0,maxArgs:0},isAllowedIncognitoAccess:{minArgs:0,maxArgs:0}},history:{addUrl:{minArgs:1,maxArgs:1},getVisits:{minArgs:1,maxArgs:1},deleteAll:{minArgs:0,maxArgs:0},deleteRange:{minArgs:1,maxArgs:1},deleteUrl:{minArgs:1,maxArgs:1},search:{minArgs:1,maxArgs:1}},i18n:{detectLanguage:{minArgs:1,maxArgs:1},getAcceptLanguages:{minArgs:0,maxArgs:0}},idle:{queryState:{minArgs:1,maxArgs:1}},management:{get:{minArgs:1,maxArgs:1},getAll:{minArgs:0,maxArgs:0},getSelf:{minArgs:0,maxArgs:0},uninstallSelf:{minArgs:0,maxArgs:1}},notifications:{clear:{minArgs:1,maxArgs:1},create:{minArgs:1,maxArgs:2},getAll:{minArgs:0,maxArgs:0},getPermissionLevel:{minArgs:0,maxArgs:0},update:{minArgs:2,maxArgs:2}},pageAction:{getPopup:{minArgs:1,maxArgs:1},getTitle:{minArgs:1,maxArgs:1},hide:{minArgs:0,maxArgs:0},setIcon:{minArgs:1,maxArgs:1},show:{minArgs:0,maxArgs:0}},runtime:{getBackgroundPage:{minArgs:0,maxArgs:0},getBrowserInfo:{minArgs:0,maxArgs:0},getPlatformInfo:{minArgs:0,maxArgs:0},openOptionsPage:{minArgs:0,maxArgs:0},requestUpdateCheck:{minArgs:0,maxArgs:0},sendMessage:{minArgs:1,maxArgs:3},sendNativeMessage:{minArgs:2,maxArgs:2},setUninstallURL:{minArgs:1,maxArgs:1}},storage:{local:{clear:{minArgs:0,maxArgs:0},get:{minArgs:0,maxArgs:1},getBytesInUse:{minArgs:0,maxArgs:1},remove:{minArgs:1,maxArgs:1},set:{minArgs:1,maxArgs:1}},managed:{get:{minArgs:0,maxArgs:1},getBytesInUse:{minArgs:0,maxArgs:1}},sync:{clear:{minArgs:0,maxArgs:0},get:{minArgs:0,maxArgs:1},getBytesInUse:{minArgs:0,maxArgs:1},remove:{minArgs:1,maxArgs:1},set:{minArgs:1,maxArgs:1}}},tabs:{create:{minArgs:1,maxArgs:1},captureVisibleTab:{minArgs:0,maxArgs:2},detectLanguage:{minArgs:0,maxArgs:1},duplicate:{minArgs:1,maxArgs:1},executeScript:{minArgs:1,maxArgs:2},get:{minArgs:1,maxArgs:1},getCurrent:{minArgs:0,maxArgs:0},getZoom:{minArgs:0,maxArgs:1},getZoomSettings:{minArgs:0,maxArgs:1},highlight:{minArgs:1,maxArgs:1},insertCSS:{minArgs:1,maxArgs:2},move:{minArgs:2,maxArgs:2},reload:{minArgs:0,maxArgs:2},remove:{minArgs:1,maxArgs:1},query:{minArgs:1,maxArgs:1},removeCSS:{minArgs:1,maxArgs:2},sendMessage:{minArgs:2,maxArgs:3},setZoom:{minArgs:1,maxArgs:2},setZoomSettings:{minArgs:1,maxArgs:2},update:{minArgs:1,maxArgs:2}},webNavigation:{getAllFrames:{minArgs:1,maxArgs:1},getFrame:{minArgs:1,maxArgs:1}},webRequest:{handlerBehaviorChanged:{minArgs:0,maxArgs:0}},windows:{create:{minArgs:0,maxArgs:1},get:{minArgs:1,maxArgs:2},getAll:{minArgs:0,maxArgs:1},getCurrent:{minArgs:0,maxArgs:1},getLastFocused:{minArgs:0,maxArgs:1},remove:{minArgs:1,maxArgs:1},update:{minArgs:2,maxArgs:2}}};if(0===Object.keys(r).length)throw new Error("api-metadata.json has not been included in browser-polyfill");const e=(r,e)=>{const s=r=>1==r?"argument":"arguments";return function(g,...n){if(n.length<e.minArgs)throw new Error(`Expected at least ${e.minArgs} ${s(e.minArgs)} for ${r}(), got ${n.length}`);if(n.length>e.maxArgs)throw new Error(`Expected at most ${e.maxArgs} ${s(e.maxArgs)} for ${r}(), got ${n.length}`);return new Promise((e,s)=>{g[r](...n,(r=>(...e)=>{chrome.runtime.lastError?r.reject(chrome.runtime.lastError):1===e.length?r.resolve(e[0]):r.resolve(e)})({resolve:e,reject:s}))})}},s=(r,e,s)=>new Proxy(e,{apply:(e,g,n)=>s.call(g,r,...n)});let g=Function.call.bind(Object.prototype.hasOwnProperty);const n=(r,t={},m={})=>{let A=Object.create(null),i={has:(r,e)=>e in r||e in A,get(r,i,a){if(i in A)return A[i];if(!(i in r))return;let o=r[i];if("function"==typeof o)if("function"==typeof t[i])o=s(r,r[i],t[i]);else if(g(m,i)){let g=e(i,m[i]);o=s(r,r[i],g)}else o=o.bind(r);else{if("object"!=typeof o||null===o||!g(t,i)&&!g(m,i))return Object.defineProperty(A,i,{configurable:!0,enumerable:!0,get:()=>r[i],set(e){r[i]=e}}),o;o=n(o,t[i],m[i])}return A[i]=o,o},set:(r,e,s,g)=>(e in A?A[e]=s:r[e]=s,!0),defineProperty:(r,e,s)=>Reflect.defineProperty(A,e,s),deleteProperty:(r,e)=>Reflect.deleteProperty(A,e)};return new Proxy(r,i)},t={runtime:{onMessage:(r=>({addListener(e,s,...g){e.addListener(r.get(s),...g)},hasListener:(e,s)=>e.hasListener(r.get(s)),removeListener(e,s){e.removeListener(r.get(s))}}))(new class extends WeakMap{constructor(r,e=void 0){super(e),this.createItem=r}get(r){return this.has(r)||this.set(r,this.createItem(r)),super.get(r)}}(r=>"function"!=typeof r?r:function(e,s,g){let n=r(e,s,g);return(r=>r&&"object"==typeof r&&"function"==typeof r.then)(n)?(n.then(g,r=>{console.error(r),g(r)}),!0):void 0!==n?n:void 0}))}};return n(chrome,t,r)};r.exports=e()}else r.exports=browser})},338:function(r,e,s){r.exports=s(339)},339:function(r,e,s){"use strict";var g,n=s(11),t=(g=n)&&g.__esModule?g:{default:g};window.LOG={debug:function(){},error:function(){},exception:function(){}},window.browser=t.default}})});
//# sourceMappingURL=polyfills.js.map