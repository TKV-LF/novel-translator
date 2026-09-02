/** Bookmarklet that copies the visible chapter from the user's already-open tab. */

export function buildBookmarkletHref(appOrigin: string): string {
  const origin = appOrigin.replace(/\/$/, "");
  const code = `(function(){
var APP=${JSON.stringify(origin)};
function txt(el){
  if(!el) return "";
  return (el.innerText||"").replace(/\\u00a0/g," ").replace(/[ \\t]+\\n/g,"\\n").replace(/\\n{3,}/g,"\\n\\n").trim();
}
function findNav(re){
  var as=document.querySelectorAll("a");
  for(var i=0;i<as.length;i++){
    var t=(as[i].innerText||"").replace(/\\s/g,"");
    if(re.test(t)){
      try{return new URL(as[i].getAttribute("href")||as[i].href,location.href).href;}catch(e){}
    }
  }
  return null;
}
var sels=["#content",".txtnav","#htmlContent",".chapter-content","#chaptercontent","#contentbox",".read-content","article",".novelcontent",".content"];
var content="",i,n,clone;
for(i=0;i<sels.length;i++){
  n=document.querySelector(sels[i]);
  if(!n) continue;
  clone=n.cloneNode(true);
  clone.querySelectorAll("script,style,iframe,.ads,.ad").forEach(function(x){x.remove();});
  content=txt(clone);
  if(content.length>80) break;
}
if(content.length<80) content=txt(document.body);
var title=txt(document.querySelector("h1,.chapter-title,#timu"))||document.title.split(/[_|－—]/)[0];
var novelTitle=txt(document.querySelector(".bookname"));
if(!novelTitle){
  var bits=(document.title||"").split(/[_|－—]/);
  if(bits.length>=2) novelTitle=bits[0].trim();
}
if(novelTitle===title) novelTitle=null;
var payload={
  sourceUrl:location.href,
  title:title||"Chương",
  originalText:content,
  nextUrl:findNav(/下一[章页]|下章|下页/),
  prevUrl:findNav(/上一[章页]|上章|上页/),
  novelTitle:novelTitle
};
if(!payload.originalText||payload.originalText.length<20){
  alert("Không tìm thấy nội dung chương trên trang này.");
  return;
}
var json=JSON.stringify(payload);
var dest=APP+"/nhap-tu-trang";
try{
  if(encodeURIComponent(json).length<70000){
    location.href=dest+"#"+encodeURIComponent(json);
    return;
  }
}catch(e){}
function goClip(){location.href=dest+"?clipboard=1";}
if(navigator.clipboard&&navigator.clipboard.writeText){
  navigator.clipboard.writeText(json).then(goClip).catch(function(){location.href=dest+"#"+encodeURIComponent(json.slice(0,20000));});
}else{
  location.href=dest+"#"+encodeURIComponent(json);
}
})();`;
  return `javascript:${encodeURIComponent(code)}`;
}
