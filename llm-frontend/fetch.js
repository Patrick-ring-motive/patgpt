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
            const revealHeaders = (res) => {
                const headers = res.headers;
                const _get = headers.get;
                headers.get = extend(function get(...args) {
                    const rtrn = _get.apply(this, args);
                    console.log('get', new Error(), res, ...args, rtrn);
                    return rtrn
                }, _get);
                const _set = headers.set;
                headers.set = extend(function set(...args) {
                    const rtrn = _set.apply(this, args);
                    console.log('set', new Error(), res, ...args, rtrn);
                    return rtrn
                }, _set);
                const _has = headers.has;
                headers.has = extend(function has(...args) {
                    const rtrn = _has.apply(this, args);
                    console.log('has', new Error(), res, ...args, rtrn);
                    return rtrn
                }, _has);
                return res;
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
            const _fetch = globalThis.fetch;
            globalThis.fetch = extend(async function fetch(...args) {
                const url = String(args[0]?.url ?? args[0]);
                if (url.includes('/duckchat/v1/status')) {
                    const req = new Request(...args);
                    args = [`${req.url}?time=${new Date().getTime()}`, req];
                }
                if (['improving.llm.patrickring.net', 'quack.llm.patrickring.net', 'privacy-pro-eligible.json'].some(x => url.includes(x))) {
                    return revealHeaders(new Response('{}'));
                }
                if (url.includes('duckchat/v1/chat')) {
                    const body = JSON.parse(args[1].body);
                    body.model = 'gpt-5-mini';
                    body.metadata.toolChoice.WebSearch = true;
                    args[1].body = JSON.stringify(body);
                    console.log(body);
                    try {
                        let res = await _fetch.apply(this, args);
                        if (res.headers.has('x-vqd-hash-1')) {
                            sessionMap.set('x-vqd-hash-1', res.headers.get('x-vqd-hash-1'));
                        }
                        if (res.status != 200) {
                            res = new Response(`data: {"id":"1","action":"success","created":`+new Date().getTime()+',"model":"gpt-5-mini-2025-08-07","role":"assistant","message":"'+res.statusText+`"}

data: [DONE]

`, {
                                headers: {
                                    "X-Vqd-Hash-1": sessionMap.get('x-vqd-hash-1'),
                                    'content-type': 'text/event-stream'
                                }
                            });
                            console.log(res);
                        }
                        //throw new Error('asdf');
                        return revealHeaders(res);
                    } catch (e) {
                        return new Response(`data: {"id":"1","action":"success","created":`+new Date().getTime()+',"model":"gpt-5-mini-2025-08-07","role":"assistant","message":"'+String(e?.message??e)+`"}

data: [DONE]

`, {
                            headers: {
                                "X-Vqd-Hash-1": sessionMap.get('x-vqd-hash-1'),
                                'content-type': 'text/event-stream'
                            }
                        });
                    }
                }
                return revealHeaders(await _fetch.apply(this, args));
            }, _fetch);
            const _sendBeacon = navigator.sendBeacon;
            navigator.sendBeacon = extend(function sendBeacon(...args) {
                return true;
            }, _sendBeacon);
        })();
