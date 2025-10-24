        (() => {
                const Q = fn => {
                    try {
                        return fn?.()
                    } catch {}
                };
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

                const revealHeaders=(res)=>{
                        const headers = res.headers;
                        const _get = headers.get;
                        headers.get = extend(function get(...args){
                                console.warn('get',new Error(),res,...args);
                                return _get.apply(this,args); 
                        },_get);
                        const _set = headers.set;
                        headers.set = extend(function set(...args){
                                console.warn('set',new Error(),res,...args);
                                return _set.apply(this,args); 
                        },_set);
                        const _has = headers.has;
                        headers.has = extend(function has(...args){
                                console.warn('has',new Error(),res,...args);
                                return _has.apply(this,args); 
                        },_has);
                        return res;
                };
                const _fetch = globalThis.fetch;
                globalThis.fetch = extend(async function fetch(...args) {
                                const url = String(args[0]?.url ?? args[0]);
                                if (['improving.llm.patrickring.net', 'quack.llm.patrickring.net', 'privacy-pro-eligible.json'].some(x => url.includes(x))) {
                                    return revealHeaders(new Response('{}'));
                                }
                                if (url.includes('duckchat/v1/chat')) {
                                    const body = JSON.parse(args[1].body);
                                    body.model = 'gpt-5-mini';
                                    for (const tool in body.metadata.toolChoice) {
                                        // body.metadata.toolChoice[tool]=true;
                                    }
                                    body.metadata.toolChoice.WebSearch = true;
                                    args[1].body = JSON.stringify(body);
                                    console.log(body);
                                    try {
                                        let res = await _fetch.apply(this, args);
                                        if (res.status != 200) {
                                            res = new Response(`data: {"id":"1","action":"success","created":'+new Date().getTime()+',"model":"gpt-5-mini-2025-08-07","role":"assistant","message":"'+res.statusText+'"}

data: [DONE]

`,{headers:{'content-type':'text/event-stream'}});
                  console.log(res);
                }
                throw new Error('asdf');
                return revealHeaders(res);
              }catch(e){
                return new Response(`data: {"id":"1","action":"success","created":'+new Date().getTime()+',"model":"gpt-5-mini-2025-08-07","role":"assistant","message":"'+String(e?.message??e)+'"}

data: [DONE]

`,{headers:{'content-type':'text/event-stream'}});
              }
            }
            return revealHeaders(await _fetch.apply(this,args));
          },_fetch);
          const _sendBeacon = navigator.sendBeacon;
          navigator.sendBeacon = extend(function sendBeacon(...args){
              return true;
          },_sendBeacon);
      })();
