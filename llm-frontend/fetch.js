  (() => {
    const Q = fn => {
      try {
        return fn?.()
      } catch {}
    };
    const sleep = (ms)=>new Promise(resolve=>setTimeout(resolve,ms));
    const postTask = (callback, options = {}) => scheduler.postTask(callback, {priority: "background", ...options});
    const delay = (fn,time=1)=>setTimeout(fn,time);
    const docSelectAll = query => Q(() => document.querySelectorAll(query)) ?? document.createElement('NodeList').childNodes;
    const callback = Q(() => requestIdleCallback) ?? Q(()=>scheduler)?.postTask ? postTask : Q(()=>requestAnimationFrame) ?? delay;
    const nextIdle = () => new Promise(resolve => callback(resolve));
    const decodeComponent = x => Q(()=>decodeURIComponent(x)) ?? x;
    let retryCount = 0;
    (async () => {
      while (true) {
        try {
          await nextIdle();
          if (document.hidden || (document.visibilityState && document.visibilityState != 'visible') || navigator.scheduling?.isInputPending?.()) {
            continue;
          }
          const retries = [...docSelectAll('a[target="_blank"]:not([href],[retried])')];
          for (const retry of retries) {
            if (retry.textContent === 'Try Again') {
              retry.setAttribute('retried', 'true');
              retry.click();
              const backoff = Array(retryCount);
              retryCount++;
              for(_ of backoff){
                await sleep(1);
                await nextIdle();
              }
            }
          }
          const singles = [...docSelectAll(':not([text],:has(*))')];
          for (const single of singles) {
            const content = String(single.textContent || '').trim();
            single.setAttribute('text', content);
          }
          const texts = [...docSelectAll('[text]')];
          for (const text of texts) {
            let content = String(text.textContent || '').trim();
            if(/GPT.4o\s*mini/i.test(content)){
              content = 'Cached Response';
            }
            const decontent = decodeComponent(content).trim();
            if(content != decontent){
              text.textContent = decontent;
            }
            if (text.getAttribute('text') != content) {
              text.setAttribute('text', content);
            }
          }
        } catch (e) {
          console.warn(e);
          await sleep(1000);
        }
      }
    })();
    const constructPrototype = newClass => {
      try {
        if (newClass?.prototype) return newClass;
        const constProto = newClass?.constructor?.prototype;
        if (constProto) {
          newClass.prototype = Q(() => constProto?.bind?.(constProto)) ?? Object.create(Object(constProto));
          return newClass;
        }
        newClass.prototype = Q(() => newClass?.bind?.(newClass)) ?? Object.create(Object(newClass));
      } catch (e) {
        console.warn(e, newClass);
      }
    };
    const extend = (thisClass, superClass) => {
      try {
        constructPrototype(thisClass);
        constructPrototype(superClass);
        Object.setPrototypeOf(thisClass.prototype, superClass?.prototype ?? superClass?.constructor?.prototype ?? superClass);
        Object.setPrototypeOf(thisClass, superClass);
      } catch (e) {
        console.warn(e, {
          thisClass,
          superClass
        });
      }
      return thisClass;
    };
    const $fetch = async function $fetch(...args) {
      try {
        return await fetch(...args);
      } catch (e) {
        return new Response(String(e?.message ?? e), {
          status: 500
        });
      }
    };
    const getText = ()=>{
      return String([...docSelectAll('[data-activeresponse="true"]:has(p)')].pop().innerText||'').trim().replace(/^Search/,'').trim().replace(/GPT-4o mini/,'').trim();
    };
    const deparse = x =>{
      try{
        return JSON.parse(x);
      }catch{
        return JSON.parse(decodeComponent(x));
      }
    };
    const parse = x =>{
      try{
        return deparse(x);
      }catch{}
    };
    const upsert = async (cacheURL, prompt, response) => {
      let lines;
      try{
        response = await response.clone().text();
        lines = response.split('\n');
        lines = lines.map(x=>x.replace('data:','').trim()).filter(x=>x).map(parse).map(x=>x.message).join('');
        console.log(lines);
      }catch(e){
        console.warn(e);
        console.log(getText());
        await nextIdle();
        lines = getText();
        console.log(lines);
      }
      return await $fetch(`${atob(cacheURL)}/upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anti-bot': 'yes',
        },
        body: JSON.stringify({
          prompt:encodeURIComponent(prompt),
          response:encodeURIComponent(lines)
        })
      });
    };
    (() => {
      const _desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      const _imgSet = _desc.set;
      Object.defineProperty(HTMLImageElement.prototype, 'src', extend({
        set: extend(function set(value) {
          if (String(value).includes('external-content.llm.patrickring.net')) {
            value = String(value).replace('external-content.llm.patrickring.net', 'external-content-llm.patrickring.net');
          }
          return _imgSet.call(this, value);
        }, _imgSet)
      }, _desc));
    })();
    const _map = new Map();
    const sessionMap = {
      get(key) {
        return Q(() => sessionStorage.getItem(key)) ?? _map.get(key);
      },
      set(key, value) {
        Q(() => sessionStorage.setItem(key, value));
        _map.set(key, value);
      }
    };
    let cacheURL = sessionMap.get('CACHE_URL') || $fetch('/CACHE_URL').then(res => res.text());
    const _fetch = globalThis.fetch;
    globalThis.fetch = extend(async function fetch(...args) {
      let canCache = false;
      let prompt = '';
      if (cacheURL instanceof Promise) {
        cacheURL = await cacheURL;
        sessionMap.set('CACHE_URL', cacheURL);
      }
      const url = String(args[0]?.url ?? args[0]);
      if (url.includes('/duckchat/v1/status')) {
        const req = new Request(...args);
        args = [`${req.url}?time=${new Date().getTime()}`, req];
      }
      if (['improving.llm.patrickring.net', 'quack.llm.patrickring.net', 'privacy-pro-eligible.json'].some(x => url.includes(x))) {
        return new Response('{}');
      }
      if (url.includes('duckchat/v1/chat')) {
        const body = deparse(args[1].body);
        body.model = 'gpt-5-mini';
        body.metadata.toolChoice.WebSearch = true;
        args[1].body = JSON.stringify(body);
        try {
          args[1].headers ??= new Headers();
          const messages = body.messages.filter(x => x.role == 'user').map(y => y.content);
          if (messages.length > 1) {
            canCache = true;
            prompt = messages.slice(-2).join(' ').trim();
          }
          args[1].headers['last-message'] = encodeURIComponent(prompt ?? messages.pop());
          args[1].headers?.set?.('last-message', args[1].headers['last-message']);
        } catch (e) {
          console.warn(e);
        }
        console.log(body);
        try {
          let res = await _fetch.apply(this, args);
          if (res.headers.has('x-vqd-hash-1') && res.headers.get('x-vqd-hash-1') != 'null' && res.headers.get('x-vqd-hash-1') != 'undefined') {
            sessionMap.set('x-vqd-hash-1', res.headers.get('x-vqd-hash-1'));
          }
          if (res.status != 200) {
            canCache = false;
            res = new Response(`data: {"id":"1","action":"success","created":` + new Date().getTime() + ',"model":"gpt-5-mini-2025-08-07","role":"assistant","message":"' + encodeURIComponent(String(res.statusText)) + `"}

data: [DONE]

`, {
              headers: {
                "X-Vqd-Hash-1": sessionMap.get('x-vqd-hash-1'),
                'content-type': 'text/event-stream'
              }
            });
            console.log(res);
          }
          if(canCache && prompt){
            upsert(cacheURL,prompt,res);
          }
          return res;
        } catch (e) {
          canCache = false;
          return new Response(`data: {"id":"1","action":"success","created":` + new Date().getTime() + ',"model":"gpt-5-mini-2025-08-07","role":"assistant","message":"' + encodeURIComponent(String(e?.message ?? e)) + `"}

data: [DONE]

`, {
            headers: {
              "X-Vqd-Hash-1": sessionMap.get('x-vqd-hash-1'),
              'content-type': 'text/event-stream'
            }
          });
        }
      }
      return await _fetch.apply(this, args);
    }, _fetch);
    const _sendBeacon = navigator.sendBeacon;
    navigator.sendBeacon = extend(function sendBeacon(...args) {
      return true;
    }, _sendBeacon);
  })();
