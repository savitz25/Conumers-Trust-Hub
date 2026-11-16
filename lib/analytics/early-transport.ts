/**
 * Parser-blocking transport block. It runs from the root layout before any analytics
 * chunk, dynamic import, or SDK init. The gate stays closed until shouldEnablePosthog()
 * installs the module guard and opens it. Originals are saved so that later guard can
 * forward only when activation is actually on.
 */
export function analyticsTransportBlockScript(rawHost: string): string {
  let configured = '';
  try {
    if (rawHost.trim()) configured = new URL(rawHost.trim()).host;
  } catch {
    configured = '';
  }
  const hostLiteral = JSON.stringify(configured);
  return `(function(){if(window.__TRUSTHUB_ANALYTICS_TRANSPORT)return;var configured=${hostLiteral};var hosts={"us.i.posthog.com":1,"us.posthog.com":1,"eu.i.posthog.com":1,"eu.posthog.com":1,"app.posthog.com":1};if(configured)hosts[configured]=1;function destination(raw){try{var base=window.location&&window.location.href?window.location.href:"https://collector.invalid";var url=new URL(String(raw||""),base);var host=url.host;return !!hosts[host]||(host.length>14&&host.endsWith(".i.posthog.com"));}catch(e){return false;}}var originalFetch=typeof window.fetch==="function"?window.fetch.bind(window):null;var xhrOpen=typeof XMLHttpRequest==="function"?XMLHttpRequest.prototype.open:null;var xhrSend=typeof XMLHttpRequest==="function"?XMLHttpRequest.prototype.send:null;var originalBeacon=typeof navigator!=="undefined"&&typeof navigator.sendBeacon==="function"?navigator.sendBeacon.bind(navigator):null;window.__TRUSTHUB_ANALYTICS_TRANSPORT={fetch:originalFetch,xhrOpen:xhrOpen,xhrSend:xhrSend,beacon:originalBeacon};window.__TRUSTHUB_ANALYTICS_GATE="closed";function targetOf(input){if(typeof input==="string")return input;if(input instanceof URL)return input.href;if(input&&input.url)return input.url;return String(input);}if(originalFetch){window.fetch=function(input,init){var target=targetOf(input);if(window.__TRUSTHUB_ANALYTICS_GATE!=="open"&&destination(target)){return Promise.resolve(new Response("{}",{status:200,headers:{"content-type":"application/json"}}));}return originalFetch(input,init);};}if(xhrOpen&&xhrSend){XMLHttpRequest.prototype.open=function(method,url){this.__trusthubUrl=String(url||"");return xhrOpen.apply(this,arguments);};XMLHttpRequest.prototype.send=function(body){if(window.__TRUSTHUB_ANALYTICS_GATE!=="open"&&destination(this.__trusthubUrl||"")){var xhr=this;try{Object.defineProperty(xhr,"readyState",{configurable:true,get:function(){return 4;}});Object.defineProperty(xhr,"status",{configurable:true,get:function(){return 200;}});Object.defineProperty(xhr,"responseText",{configurable:true,get:function(){return "{}";}});Object.defineProperty(xhr,"response",{configurable:true,get:function(){return "{}";}});xhr.dispatchEvent(new Event("load"));xhr.dispatchEvent(new Event("loadend"));}catch(e){}return;}return xhrSend.apply(this,arguments);};}if(originalBeacon){navigator.sendBeacon=function(url,data){if(window.__TRUSTHUB_ANALYTICS_GATE!=="open"&&destination(String(url)))return true;return originalBeacon(url,data);};}})();`;
}
