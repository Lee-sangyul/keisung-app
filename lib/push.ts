import webpush from "web-push";
export function pushConfigured(){
 return process.env.PUSH_ENABLED==="true"&&
 Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT);
}
export function setupWebPush(){
 if(!pushConfigured())throw Error("PWA Push is not configured");
 webpush.setVapidDetails(process.env.VAPID_SUBJECT!,process.env.VAPID_PUBLIC_KEY!,process.env.VAPID_PRIVATE_KEY!);
 return webpush;
}
export function validPushEndpoint(raw:string){
 try{
  const url=new URL(raw);
  const host=url.hostname.toLowerCase();
  return url.protocol==="https:"&&!url.username&&!url.password&&
   ["fcm.googleapis.com","updates.push.services.mozilla.com","web.push.apple.com","push.apple.com","wns.notify.windows.com"].some(h=>host===h||host.endsWith("."+h));
 }catch{return false;}
}
