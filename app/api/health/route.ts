export async function GET(){return Response.json({ok:true,service:"keisung-app",version:"0.3.0",timestamp:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});}
