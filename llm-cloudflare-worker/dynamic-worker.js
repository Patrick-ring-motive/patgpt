const CACHE_URL = 'https://www.patgpt-vector-cache.workers.dev';

const scrape = async(url) =>{
    let res = await fetch(url);
    if(res.status >= 400){
        url = String(Object.assign(new URL(url),{host:'github.com'})).replace('/refs/heads/','/blob/')
        .replace('/main/','/blob/main/').replace('/blob/blob','/blob');
        res = await fetch(url,{headers:{
        "Accept":"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        }});



        const text = await res.text();

        const payload = text.match(
        /<script[^>]*data-target="react-app\.embeddedData"[^>]*>([\s\S]*?)<\/script>/
        );

        const json = JSON.parse(payload[1]);
        return json.payload.blob.rawLines.join('\n');
    }
    return res.text();
};
const upsert = async (prompt, response) => {
    try {
        return await (await fetch(`${CACHE_URL}/upsert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'anti-bot': 'yes',
            },
            body: JSON.stringify({
                prompt,
                response
            })
        })).json();
    } catch (e) {
        console.warn('upsert', e, prompt, response);
    }
};
const query = async (prompt) => {
    let res;
    try {
        res = await fetch(`${CACHE_URL}/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'anti-bot': 'yes',
            },
            body: JSON.stringify({
                prompt
            })
        });
        console.log(res);
        const text = (await res.text()).trim();
        console.log(text);
        if (!text) return;
        return JSON.parse(text);
    } catch (e) {
        console.warn('query', prompt, e, res);
        // return res;
    }
};
const match = async (prompt) => {
    let res;
    try {
        res = await fetch(`${CACHE_URL}/match`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'anti-bot': 'yes',
            },
            body: JSON.stringify({
                prompt
            })
        });
        console.log(res);
        const text = (await res.text()).trim();
        console.log(text);
        if (!text) return;
        return JSON.parse(text);
    } catch (e) {
        console.warn('query', prompt, e, res);
    }
};
const extractMessage = (reqText) => {
    try {
        const mess = JSON.parse(reqText);
        const arr = mess.messages.filter(x => x.role === 'user').map(y => y.content);
        const last = arr.pop();
        console.warn(last);
        return last;
    } catch (e) {
        console.warn('extractMessage', e, reqText);
    }
};
const hostMap = {
    'llm.patrickring.net': 'duckduckgo.com',
};
const targetHost = 'duckduckgo.com';
const targetHostRe = new RegExp(targetHost, 'gi');
const fetchText = async function fetchText(...args) {
    const resp = await fetch(...args);
    return resp.text();
};
const setCacheHeaders = (headers, seconds = 96 /*96400*/ ) => {
    for (const header of ["CDN-Cache-Control", "Cache-Control", "Cloudflare-CDN-Cache-Control", "Surrogate-Control", "Vercel-CDN-Cache-Control"]) {
        headers.set(header, `public, max-age=${seconds}, s-max-age=${seconds}, stale-if-error=31535000, stale-while-revalidate=31535000`);
    }
    for (const header of ['vary', 'etag', 'nel', 'pragma', 'cf-ray']) {
        headers.delete(header);
    }
    headers.set('nel', '{}');
    headers.set('user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.96 Mobile/15E148 Safari/604.1');
    return headers;
};
const transformRequestHeaders = (requestHeaders, replacer) => {
    const newHeaders = new Headers();
    for (let [key, value] of requestHeaders) {
        if (/proto|policy|x.frame.options|x.xss.protection/i.test(key)) continue;
        if (key === 'referer' && /archive/.test(requestHeaders.get('host'))) continue;
        for (const key in hostMap) {
            value = value.replaceAll(key, hostMap[key]);
        }
        newHeaders.append(key, value.replace(replacer, targetHost));
    }
    return setCacheHeaders(newHeaders, 30);
};
const transformResponseHeaders = (responseHeaders, replacement) => {
    const newHeaders = new Headers();
    for (let [key, value] of responseHeaders) {
        if (/proto|policy|x.frame.options|x.xss.protection/i.test(key)) continue;
        for (const key in hostMap) {
            value = value.replaceAll(hostMap[key], key);
        }
        newHeaders.append(key, value.replace(targetHostRe, replacement));
    }
    return newHeaders;
};
async function onRequest(request) {
    if(request.url.includes('web-streams-core')){
        const res = await scrape('https://raw.githubusercontent.com/Patrick-ring-motive/web-streams-shim/refs/heads/main/web-streams-core.js');
        return new Response(res,{headers:{'content-type':'text/javascript'}});
    }
    if(request.url.includes('web-worker-fetch')){
        const res = await scrape('https://raw.githubusercontent.com/Patrick-ring-motive/patgpt/refs/heads/main/llm-frontend/web-worker-fetch.js?'+new Date().getTime());
        return new Response(res,{headers:{'content-type':'text/javascript'}});
    }
    if (request.url.includes('/cdn-cgi/rum')) {
        return new Response(null, {
            status: 204
        });
    }
    if(request.url.includes('CACHE_URL')){
      return new Response(btoa(CACHE_URL));
    }
    if (request.url.includes('favicon') || /(apple.*touch|android).*icon|assets.icons.meta|\.ico$/i.test(request.url)) {
        return fetch('https://www.minecraft.net/etc.clientlibs/minecraftnet/clientlibs/clientlib-site/resources/favicon.ico');
    }
    if (request.url.includes('/duckchat/v1/status')) {
        request = new Request(`${request.url}?time=${new Date().getTime()}`, request);
    }
    const thisHost = `${request.headers.get('host')}`;
    const thisHostRe = new RegExp(thisHost, 'gi');
    const requestInit = {
        method: request.method,
        headers: transformRequestHeaders(request.headers, thisHostRe),
    };
    let cached;
    if (request.body && !/GET|HEAD/.test(request.method)) {
        requestInit.body = request.body;
        if (/text|html|script|xml|json/i.test(request.headers.get('content-type'))) {
            requestInit.body = await request.text();
            requestInit.headers.delete('content-encoding');
            requestInit.headers.delete('content-length');
            for (const key in hostMap) {
                requestInit.body = requestInit.body.replaceAll(key, hostMap[key]);
            }
            try {
                const lastMessage = decodeURIComponent(request.headers.get('last-message'));
                console.log(lastMessage);
                cached = await (match(lastMessage));
                console.log(cached);
                if (cached?.response) {
                    return new Response(`data: {"id":"1","action":"success","created":` + new Date().getTime() + ',"model":"gpt-5-mini-2025-08-07","role":"assistant","message":"' + cached.response + `"}

data: [DONE]

`, {
                        headers: {
                            "X-Vqd-Hash-1": request.headers.get('last-vqd-hash-1'),
                            'content-type': 'text/event-stream',
                             'from-cache':'true'
                        }
                    });
                }
            } catch (e) {
                console.warn(e);
            }
        }
    }
    let url = request.url;
    for (const key in hostMap) {
        url = url.replaceAll(key, hostMap[key]);
    }
    url = url.replace(thisHostRe, targetHost);
    console.log(url, requestInit);
    let response = await fetch(url, requestInit);
    const responseInit = {
        status: response.status,
        statusText: response.statusText,
        headers: transformResponseHeaders(response.headers, thisHost)
    };
    if (url.endsWith('.css')) {
        responseInit.headers.set('content-type', 'text/css');
    }
    responseInit.headers.set('llm-cache', encodeURIComponent(String(cached?.response)));
    if (/(?!.*stream).*(text|html|script|xml|json)/i.test(response.headers.get('content-type'))) {
        let resBody = await response.text();
        for (const key in hostMap) {
            resBody = resBody.replaceAll(hostMap[key], key);
        }
        if (/script/i.test(response.headers.get('content-type'))) {
            //resBody = resBody.replaceAll('throw','return');
        }
        resBody = resBody.replace(targetHostRe, thisHost).replaceAll('Duck.ai', 'PatGPT').replaceAll('DuckDuckGo', 'PatGPT').replaceAll('Ask privately', 'Ask anything');
        if (/html/i.test(response.headers.get('content-type'))) {
            resBody = `<!DOCTYPE html>
        <script src="web-streams-core.js"></script>
        <script src="web-worker-fetch.js"></script>
        <script>
globalThis.BroadcastChannel = undefined;

(()=>{


for(const pend of ['append','appendChild','prepend','after','before']){
  const _pend = HTMLElement.prototype[pend];
  if(!_pend)continue;
  HTMLElement.prototype[pend] = function $pend(...args){
    if(args[0] instanceof Text || typeof args[0] === 'string'){
      try{
        const str = String(args[0]?.textContent ?? args[0]).trim();
        if(str){
       //console.log(str);
        this.setAttribute('text',str);
        }
      }catch{}
    }else if(args[0]?.tagName === 'BUTTON'){
        const str = String(args[0].innerText).trim();
        if(str){
       //     console.log(str);
            args[0].setAttribute('text',str);  
        }
        args[0].addEventListener('mouseover',()=>args[0].removeAttribute('disabled'));
    }
    return _pend.apply(this,args);
  }
}
})();


        (()=>{
          if(location.pathname==='/'&&location.search===''){
            location.href =  location.origin + '/?q=DuckDuckGo+AI+Chat&ia=chat&duckai=1';
          }
          localStorage.setItem('duckaiHasAgreedToTerms','true');
          let data = localStorage.getItem('duckaiCustomization');
          if(!data || data === 'undefined'){
            localStorage.setItem('duckaiCustomization','{"version":"1","data":{"assistantName":"PatGPT"}}');
          }
          localStorage.setItem('preferredDuckaiModel','203');
          const d = new Date();

          const dismiss = '{"promosDismissed":"'+d.getUTCFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()+'"}';
          localStorage.setItem('aichatPromoDismissal',dismiss);
          localStorage.setItem('duckaiCanUseApproxLocation','true');
          localStorage.setItem('aiChatPromptSuggestions','{"hideSuggestions":true}');
          setInterval(()=>(document.querySelector('button[aria-pressed="false"]:not([aria-label="light"],[aria-label="dark"])')??{}).click?.(),100);
})();
        </script>
        <script>
${await scrape(`https://raw.githubusercontent.com/Patrick-ring-motive/patgpt/refs/heads/main/llm-frontend/fetch.js?${new Date().getTime()}`)}
        </script>
        <style>
      xxol,
        [href*="duckduckgo-help-pages"],
        [text="Settings"]:not(code *),
        span[text="."]:not(.token,code *),
        [data-testid="anomaly-modal"],
        xx[id*="heading"][id*="assistant"][id*="message"]:not([data-activeresponse="false"]),
        section:has(img[src*="external-content"]):not(:has(section)),
        form>:last-child,
        [aria-pressed="true"][data-selected="true"],
        [text="Search"]:not(code *),
        [aria-label="Customize responses"],
        [aria-label="Attach image"],
        [text*="duckduckgo"i],
        [href*="apps.apple.com"],
        [href*="play.google.com"],
        [data-testid="serp-atb-btn"],
        button:has([href*="apps.apple.com"]),
        button[text="4o-mini"],
        button[aria-label="Open settings"],
        svg[preserveAspectRatio="xMidYMid meet"],
        a[href*="what-information-does-duckai-share-with-model-providers"],
        li:has(a[href*="what-information-does-duckai-share-with-model-providers"]) ~ *,
        button[aria-label="Learn about Active Privacy Protection"],
        span[id="aichat-side-menu-button"],
        div[data-testid="free-badge-container"],
        section:first-of-type svg[fill="none"]:has(g[opacity="0.8"]),
        span[data-testid="feedback-prompt"]{
          display:none !important;
        }
 
        h1,h2,h3,h4,h5,h6,
        strong,
        li:first-letter,
        p:first-letter,
        p:has(span[text="."]):first-letter{
          text-transform:capitalize;
        }

        html{
          filter:hue-rotate(-45deg);
        }
        [text] *{
            text-decoration-line: none;
        }
        del{
           border-width: 1vmin;
            border-style: solid;
            border-color: rgba(0, 0, 0, 0);
        }
        </style>
        <meta name="mobile-web-app-capable" content="yes">
        
        ` + resBody.replace('name="apple-mobile-web-app-capable" content="no"', 'name="apple-mobile-web-app-capable" content="yes"').replace('apple-itunes-app', 'poop').replace('"showAppleAppStoreAds":true', '"showAppleAppStoreAds":false');
        }
        if (response.ok && !request.url.includes('/duckchat/v1/status')) setCacheHeaders(responseInit.headers, 33);
        response = new Response(resBody, responseInit);
    } else {
        if (response.ok && !request.url.includes('/duckchat/v1/status')) setCacheHeaders(responseInit.headers);
        response = new Response(response.body, responseInit);
    }
    for (let [key, value] of requestInit.headers) {
        responseInit.headers.set(`request-${key}`, value);
    }
    return response;
};
export default {
    async fetch(request, env, ctx) {
        return onRequest(...arguments);
    }
};
