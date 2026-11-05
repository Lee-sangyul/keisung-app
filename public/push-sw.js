/* PWA Web Push service worker. No page caching or background tracking. */
self.addEventListener("push",event=>{
 let payload={title:"계성 스마트",body:"새 알림이 도착했어요.",url:"/announcements"};
 try{if(event.data)payload={...payload,...event.data.json()};}catch{}
 const url=typeof payload.url==="string"&&payload.url.startsWith("/")&&!payload.url.startsWith("//")?payload.url:"/announcements";
 event.waitUntil(self.registration.showNotification(String(payload.title).slice(0,80),{
  body:String(payload.body).slice(0,180),icon:"/icon.svg",badge:"/icon.svg",
  tag:"keisung-push",data:{url},renotify:false
 }));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const url=new URL(event.notification.data?.url||"/announcements",self.location.origin);
 if(url.origin!==self.location.origin)return;
 event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(async windows=>{
  for(const client of windows){if(client.url.startsWith(self.location.origin)){await client.focus();client.navigate(url.href);return;}}
  await clients.openWindow(url.href);
 }));
});
