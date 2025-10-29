import Sval from './sval.js';

const interpreter = new Sval({
    ecmaVer: 'latest',
    sourceType: 'module',
    sandBox: false,
});

(() => {
    const WeakRefMap = (() => {
        const _weakRefMap = new Map();
        return class WeakRefMap extends Map {
            get(key) {
                try {
                    const ref = _weakRefMap.get(key);
                    const value = ref?.deref?.();
                    if (value === undefined) {
                        _weakRefMap.delete(key);
                    }
                    return value;
                } catch (e) {
                    console.warn(e, key);
                }
            }
            set(key, value) {
                try {
                    _weakRefMap.set(key, new WeakRef(value));
                } catch (e) {
                    console.warn(e, key, value);
                }
                return this;
            }
            delete(key) {
                try {
                    return _weakRefMap.delete(key);
                } catch (e) {
                    console.warn(e, key);
                }
            }
            has(key) {
                try {
                    const value = _weakRefMap.get(key)?.deref?.();
                    if (value === undefined) {
                        _weakRefMap.delete(key);
                        return false;
                    }
                    return true;
                } catch (e) {
                    console.warn(e, key);
                    return false;
                }
            }
        }
    })();
    const instanceOf = (x, y) => {
        try {
            return x instanceof y;
        } catch {
            return false;
        }
    };

    const isValidResponse = x => (x?.status === 200 && !x?.bodyUsed && !x?.body?.locked);
    const isResponse = x => instanceOf(x, Response) || x?.constructor?.name == 'Response';
    const isPromise = x => instanceOf(x, Promise) || x?.constructor?.name == 'Promise' || typeof x?.then === 'function';
    globalThis.WeakCache = new WeakRefMap();
    const $response = Symbol('*response');
    const $fetch = Symbol('*fetch');
    const parrayBuffer = async(presponse)=>{
        if(isPromise(presponse)){
            presponse = await presponse;
        }
        const parr = presponse?.clone?.()?.arrayBuffer?.() 
        if(isValidResponse(presponse)){
            parr.isValid = true;
        }
        return parr;
        
    };
    globalThis[$fetch] = fetch;
    globalThis.fetch = async function fetch() {
        let request, response;
        try {
            request = new Request(...arguments);
            if (request.method === 'GET') {
                let cachedResponse = WeakCache.get(request.url);
                if (cachedResponse) {
                    request[$response] = cachedResponse;
                    if (isPromise(cachedResponse)) {
                        cachedResponse = await cachedResponse;
                         if(cachedResponse.isValid){
                        WeakCache.set(request.url, cachedResponse);
                         }else{
                            WeakCache.delete(request.url); 
                         }
                    }
                    try {
                        response = new Response(cachedResponse,{headers:{'from-cache':'true'}});
                        response[$response] = cachedResponse;
                    } catch {
                        WeakCache.delete(request.url);
                    }
                    console.log('response from cache');
                } else {
                    const presponse = globalThis[$fetch](...arguments);
                    WeakCache.set(request.url, parrayBuffer(presponse));
                    response = await presponse;
                    if (response.status === 200 && !response.bodyUsed) {
                        WeakCache.set(request.url, parrayBuffer(response));
                    } else {
                        WeakCache.delete(request.url);
                    }
                }
            }
        
            if (!isResponse(response)) {
                response = await globalThis[$fetch](...arguments);
            }
            return response;
        } catch (e) {
            WeakCache.delete(request.url);
            return new Response(Object.getOwnPropertyNames(e).map(x => `${x} : ${e[x]}`).join('\n'), {
                status: 500,
                statusText: `500 Internal Server Error ${e?.message}`.trim()
            });
        }
    };
})();
(() => {
    // Store a reference to the original Response constructor before we modify it
    const _Response = globalThis.Response;
    
    // Patch the Response.prototype.clone method to handle errors gracefully
    (() => {
        // Store reference to the original clone method
        const $clone = _Response.prototype.clone;
        
        // Override the clone method with error handling
        _Response.prototype.clone = Object.setPrototypeOf(function clone(...args) {
            try {
                // Attempt to call the original clone method
                return $clone.apply(this, args);
            } catch (e) {
                // If clone fails, log the error and return a 500 error response
                // instead of throwing, which prevents crashes
                console.warn(e, this, ...args);
                return new Response(Object.getOwnPropertyNames(e ?? {}).map(x => `${x} : ${e[x]}`).join('\n'), {
                    status: 569,
                    statusText: `500 Internal Server Error ${e?.message}`
                });
            }
        }, $clone); // Preserve the original function's prototype chain
    })();
    
    // Replace the global Response constructor with a patched version
    globalThis.Response = class Response extends _Response {
        constructor(...args) {
            try {
                // Check if the status code is one that MUST NOT have a body per HTTP spec
                // 101 Switching Protocols, 204 No Content, 205 Reset Content, 304 Not Modified
                if (/^(101|204|205|304)$/.test(args?.[1]?.status)) {
                    console.warn('Trying to give a body to incompatible response code 101|204|205|304; body ignored');
                    // Remove the body parameter (first argument) to comply with HTTP spec
                    (args ?? [])[0] = null;
                    // Also delete the body property from the options object if present
                    delete(args?.[1] ?? {}).body;
                }
                // Call the original Response constructor with potentially modified args
                return super(...args);
            } catch (e) {
                // If Response construction fails, log the error and create a 500 error response
                // This prevents the error from bubbling up and crashing the application
                console.warn(e, ...args);
                return super(Object.getOwnPropertyNames(e ?? {}).map(x => `${x} : ${e[x]}`).join('\n'), {
                    status: 569,
                    statusText: `500 Internal Server Error ${e?.message}`
                });
            }
        }
    }
})();

const fetchText = async function fetchText(){
  const res = await fetch(...arguments);
  return await res.text();
};

export const importModule = async function importModule(url){
  const mod = await fetchText(url);
  interpreter.run(mod);
  return interpreter['exports'];
};
