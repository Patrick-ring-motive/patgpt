(() => {
  const Q = fn => {
    try {
      return fn?.()
    } catch {}
  };
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const postTask = (callback, options = {}) => scheduler.postTask(callback, {
    priority: "background",
    ...options
  });
  const delay = (fn, time = 1) => setTimeout(fn, time);
  const callback = Q(() => requestIdleCallback) ?? Q(() => scheduler)?.postTask ? postTask : Q(() => requestAnimationFrame) ?? delay;
  const nextIdle = () => new Promise(resolve => callback(resolve));
  const encoder = new TextEncoder();
  const encode = encoder.encode.bind(encoder);
  const decoder = new TextDecoder();
  const decode = decoder.decode.bind(decoder);
  const responseText = async(res) =>{
    let text = '';
    const stream = res?.body;
    try{
      for await (const chunk of stream) {
        text += decode(chunk);
      }
    }catch(e){
      text += String(e?.message ?? e);
    }
    return text;
  };
  (() => {
    if (Q(() => self.Window)) return;
    self.onmessage = async (event) => {
      let payload;
      const id = event.data.id;
      try {
        payload = await fetch(event.data.url, event.data);
        payload = await payload.text();
      } catch (e) {
        payload = e.message ?? e
      }
      self.postMessage({
        id,
        payload
      });
    };
  })();
  (() => {
    if (!Q(() => self.Window)) return;
    const fetchWorkerMap = new Map();
    const fetchWorker = new Worker(document.currentScript?.src ?? new Error().stack.match(/(https?:\/\/[^)\s]+)/)[1].replace(/:\d+(:\d+)?$/, ''));
    fetchWorker.onmessage = (event) => {
      const resolve = fetchWorkerMap.get(event.data.id)?.resolve;
      (resolve ?? {}).resolved = true;
      resolve?.(event.data.payload);
    };
    globalThis.workerFetch = async (requestInit) => {
      try {
        requestInit.id = crypto.randomUUID();
        let resolve;
        const promise = new Promise(async(res) => {
          try{
            resolve = res;
            for(const _ of Array(10)){
              await nextIdle();
            }
          }catch(e){
            console.warn(e,requestInit);
            if(!resolve.resolved){
              resolve.resolved = true;
              reslove(String(e?.message ?? e));
            }
          }
          if(!resolve.resolved){
            resolve.resolved = true;
            reslove(String(e?.message ?? e));
          }
        });
        fetchWorkerMap.set(requestInit.id, {
          promise,
          resolve
        });
        fetchWorker.postMessage(requestInit);
        return await promise;
      } catch (e) {
        console.warn(e, requestInit);
      } finally {
        (async () => {
          await nextIdle();
          fetchWorkerMap.delete(requestInit.id);
        })();
      }
    };
  })();
})();
