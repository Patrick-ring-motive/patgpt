import { importModule } from './runner.js';

const workerURL = `https://raw.githubusercontent.com/Patrick-ring-motive/patgpt/refs/heads/main/dynamic-worker.js?${new Date().getTime()}`;
const isPromise = x => x instanceof Promise || typeof x?.then === 'function' || x?.constructor?.name === 'Promise';


let init;
export default {
  async fetch(request, env, ctx) {
    ctx.passThroughOnException();
    try{   
      if(!init){
        init = importModule(workerURL);
      }
      if(isPromise(init)){
        init = await init;
      }
      console.log(init);
      const { onRequest } = init;
      const res = await onRequest(...arguments);
      setTimeout(()=>{
        if(!isPromise(init)){
          init = null;
        }
      },5000);
      return res;
    }catch(e){
      console.warn(e,...arguments);
      return new Response(Object.getOwnPropertyNames(e??{}).map(x=>`${x} : ${e[x]}`).join(''),{
        status : 569,
        statusText:e?.message
      });
    }
  },
};
