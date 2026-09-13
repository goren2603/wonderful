export async function request(input:RequestInfo|URL,init?:RequestInit) {
  try {
    const response=await window.fetch(input,init);
    if(!response.ok) {const body=await response.clone().json().catch(()=>({}));throw new Error(body.error??`Request failed (${response.status})`);}
    return response;
  } catch(err) {window.dispatchEvent(new CustomEvent('app-error',{detail:err instanceof Error?err.message:'Network request failed'}));throw err;}
}
