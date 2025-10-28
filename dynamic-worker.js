const hostMap = {
    'patrickring.net': 'github.com',
};
const targetHost = 'github.com;
const targetHostRe = new RegExp(targetHost, 'gi');
const webScriptURL = "https://raw.githubusercontent.com/Patrick-ring-motive/venusaur/refs/heads/main/web";
const fetchText = async function fetchText(...args) {
    const resp = await fetch(...args);
    return resp.text();
};
let time = new Date().getTime();
let started = false;
const init = () => {
    if (started) return;
    time = new Date().getTime();
    setInterval(() => time++, 1);
    started = true;
};
const setCacheHeaders = (headers, seconds = 96400) => {
    for (const header of ["CDN-Cache-Control", "Cache-Control", "Cloudflare-CDN-Cache-Control", "Surrogate-Control", "Vercel-CDN-Cache-Control"]) {
        headers.set(header, `public, max-age=${seconds}, s-max-age=${seconds}, stale-if-error=31535000, stale-while-revalidate=31535000`);
    }
    for (const header of ['vary', 'etag', 'nel', 'pragma', 'cf-ray']) {
        headers.delete(header);
    }
    headers.set('nel', '{}');
    headers.set('expires', new Date(time + (1000 * seconds)).toUTCString());
    return headers;
};
const transformRequestHeaders = (requestHeaders, replacer) => {
    const newHeaders = new Headers();
    for (let [key, value] of requestHeaders) {
        if (/proto|policy/i.test(key)) continue;
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
        if (/proto|policy/i.test(key)) continue;
        for (const key in hostMap) {
            value = value.replaceAll(hostMap[key], key);
        }
        newHeaders.append(key, value.replace(targetHostRe, replacement));
    }
    return newHeaders;
};
const isPromise = x => x instanceof Promise || x?.constructor?.name == 'Promise' || typeof x?.then == 'function';
let webScript, webCss;

const urlRow = url =>{
	return `<tr><td><a href="${url}">${url}</a><script>
		(async()=>{
			try{
				await import('${url}'+'?'+new Date().getTime());
			}catch{};
			try{
				await import('https://www.google.com/search?q=${encodeURIComponent(url)}');
			}catch{};	
		})();
	</script></td></tr>`;
};

export async function onRequest(request) {
    init();
    if (!webScript) {
        webScript = fetchText(`${webScriptURL}.js?${time}`, {
            headers: {
                "Cache-Control": "no-cache"
            }
        });
    }
    if (isPromise(webScript)) {
        webScript = await webScript;
    }
    if (!webCss) {
        webCss = fetchText(`${webScriptURL}.css?${time}`, {
            headers: {
                "Cache-Control": "no-cache"
            }
        });
    }
    if (isPromise(webCss)) {
        webCss = await webCss;
    }
    const thisHost = `${request.headers.get('host')}`;
    const thisHostRe = new RegExp(thisHost, 'gi');
    const requestInit = {
        method: request.method,
        headers: transformRequestHeaders(request.headers, thisHostRe),
    };
    if (request.body && !/GET|HEAD/.test(request.method)) {
        requestInit.body = request.body;
    }
    requestInit.headers.set('user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6.2 Mobile/15E148 Safari/604.1');
    let url = request.url
    for (const key in hostMap) {
        url = url.replaceAll(key, hostMap[key]);
    }
    url = url.replace(thisHostRe, targetHost);
    if (url.includes('archive')) {
        requestInit.headers.set('accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7');
    }
    console.log(url, requestInit);
    let response = await fetch(url, requestInit);
    const responseInit = {
        status: response.status,
        statusText: response.statusText,
        headers: transformResponseHeaders(response.headers, thisHost)
    };
    if (/text|html|script|xml|json/i.test(response.headers.get('content-type'))) {
        let resBody = await response.text();
        for (const key in hostMap) {
            resBody = resBody.replaceAll(hostMap[key], key);
        }
        resBody = resBody.replace(targetHostRe, thisHost);
        if (/html/i.test(response.headers.get('content-type'))) {
            resBody = `<style>
                        html:has(#darkmode:checked),
                        html:has(#darkmode:checked) img,
                        html:has(#darkmode:checked) svg,
                        html:has(#darkmode:checked) image{
                          filter:invert(1) hue-rotate(180deg);
                        }
                       </style>
			           <script src="${webScriptURL}.js?${time}"></script>
                       <link rel="stylesheet" href="${webScriptURL}.css?${time}"></link>
                       <script>${webScript}</script>
					   <style>${webCss}</style>
					   ${resBody.replaceAll('<img ','<img loading="lazy" ')}
                        <div>
                         <input
                          type="checkbox"
                          id="darkmode"
                          name="darkmode"
                          value="darkmode" />
                         <label for="darkmode">darkmode</label>
                        </div>
						<a href="https://www.google.com/search?q=site%3Alenguapedia.com" style="opacity:0;">backlink</a>
						<a href="https://lenguapedia.com" style="opacity:0;">backlink</a>
						<a href="https://github.lenguapedia.com" style="opacity:0;">backlink</a>
						<a href="https://pkg.lenguapedia.com" style="opacity:0;">backlink</a>
					   <script src="${webScriptURL}.js?${Math.random()}"></script>
					   <table style="position: relative;z-index: 999999;">
					     ${['https://patrickring.net','https://github.com/Patrick-ring-motive','https://www.linkedin.com/in/patrick-ring-2415a785/','https://www.reddit.com/user/MissinqLink/'].map(urlRow).join('')}
					   </table>`;
        }
        if (response.ok) setCacheHeaders(responseInit.headers, 33);
        response = new Response(resBody, responseInit);
    } else {
        if (response.ok) setCacheHeaders(responseInit.headers);
        response = new Response(response.body, responseInit);
    }
    for (let [key, value] of requestInit.headers) {
        responseInit.headers.set(`request-${key}`, value);
    }
    setTimeout(() => {
        if (!isPromise(webScript)) {
            webScript = null;
        }
    }, 5000);
    return response;

};

const urlRow = url =>{
	return `<tr><td><a href="${url}">${url}</a><script>
		(async()=>{
			try{
				await import('${url}'+'?'+new Date().getTime());
			}catch{};
			try{
				await import('https://www.google.com/search?q=${encodeURIComponent(url)}');
			}catch{};	
		})();
	</script></td></tr>`;
};
async function onRequest(request,env,ctx) {
  const url = new URL(request.url);
  if((url?.pathname??'').length <= 2){
      return new Response('',{
          status : 302,
          headers: {location:'/Patrick-ring-motive'}
      });
  }
  const hostProxy = url.hostname;
  const hostMatch = RegExp(hostProxy,"gi");
  url.hostname = 'github.com';
  const urlMatch = RegExp(url.hostname,"gi");
  const modifiedRequest = new Request(url, Object.defineProperty(request,'headers',{
      value:new Headers(request.headers)
  }));
  modifiedRequest.headers.set('sec-fetch-dest','document');
  modifiedRequest.headers.set('sec-fetch-site','same-origin');
  modifiedRequest.headers.forEach((value, key) => {
      modifiedRequest.headers.set(key,String(value).replace(hostMatch,url.hostname));
  });
  let res =  await fetch(modifiedRequest);
  res = new Response(res.body,Object.defineProperty(res,'headers',{
      value:new Headers(res.headers)
  }));
  res.headers.forEach((value, key) => {
      res.headers.set(key,String(value).replace(urlMatch,hostProxy));
  });
  const contentType = String(res.headers.get('Content-Type'));
  if(/html/i.test(contentType)){
      let resText = (await res.text()) + 
      `<style>
      a[href^="/login"],
      a[href^="/signup"]{
          display:none;
          visibility:hidden;
      }
      </style>
      <script>
      document.querySelectorAll('a[href^="https://github.com"i]').forEach(x=>x.setAttribute('href',String(x.href).replace(/github\.com/i,location.host)));      
      document.querySelector('.vcard-names-container').innerHTML +='<br> This is a proxy of my github.<br>You can find the original here. <br><a href="https://www.github.com/Patrick-ring-motive">https://github.com/Patrick-ring-motive</a>';
      </script>
	  <table style="position: relative;z-index: 999999;">${[
		  'https://patrickring.net','https://github.com/Patrick-ring-motive',
		  'https://www.linkedin.com/in/patrick-ring-2415a785/',
		  'https://www.reddit.com/user/MissinqLink/'
	  ].map(urlRow).join('')}</table>`;
      res = cleanResponse(new Response(resText,res));          
  }
  return res;
}


function deleteAndSet(res,key,value){
  res = new Response(res.body,Object.defineProperty(res,'headers',{
      value:new Headers(res.headers)
  }));
  res.headers.delete(key);
  res.headers.set(key,value);
  return res;
}

function cleanResponse(response){       
  response = deleteAndSet(response,'Access-Control-Allow-Origin','*');
  response = deleteAndSet(response,'Access-Control-Allow-Methods','*');
  response = deleteAndSet(response,'Access-Control-Allow-Headers','*');
  response = deleteAndSet(response,'Access-Control-Allow-Credentials','true');
  response = deleteAndSet(response,'Access-Control-Max-Age','86400');
  response = deleteAndSet(response,'Referrer-Policy','unsafe-url');
  response.headers.delete('Content-Security-Policy');
  response.headers.delete('X-Frame-Options');
  response.headers.delete('Strict-Transport-Security');
  response.headers.delete('X-Content-Type-Options');
  response.headers.delete('Cross-Origin-Embedder-Policy');
  response = deleteAndSet(response,'Cross-Origin-Resource-Policy','cross-origin');
  response = deleteAndSet(response,'Cross-Origin-Opener-Policy','unsafe-none');
return response;
}
