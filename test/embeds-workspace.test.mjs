import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../public/embeds.js', import.meta.url), 'utf8');
const preview = fs.readFileSync(new URL('../public/embed-preview.js', import.meta.url), 'utf8');
function workspace() {
  const root = {innerHTML:'', addEventListener(){}, contains(){return false;}, querySelector(){return null;}, querySelectorAll(){return [];}};
  const window = {addEventListener(){}, confirm(){return true;}, setTimeout(){}, clearTimeout(){}, location:{origin:'http://localhost',hostname:'localhost',search:''}, history:{pushState(){},replaceState(){}}, scrollTo(){}, CENTRAL_EMBEDS_FIREBASE_READY:new Promise(()=>{})};
  const context = vm.createContext({window, document:{getElementById(){return root;},body:{classList:{toggle(){}}}}, URL, URLSearchParams, Promise, Map, Set, console});
  vm.runInContext(preview, context);
  vm.runInContext(source.replace(/\}\(\)\);\s*$/, `
    window.testWorkspace={state:state,choices:getEventChoices_,selections:getResolvedSelections_,toggle:toggleSelectedEvent_,remove:removeSelectedEvent_,remember:rememberSavedEmbed_,discard:discardActiveChanges_,refresh:loadWorkspace_,open:openEmbed_,save:saveActiveEmbed_,rename:renameEmbed_,click:handleClick_,renderEditor:renderEventsEditor_,renderGroups:renderGroupsEditor_,status:draftStatus_,api:function(fn){apiRequest_=fn;},disableRendering:function(){render_=function(){};}};
  }());`), context);
  const api = window.testWorkspace;
  api.disableRendering();
  api.state.user = {};
  const embed = {id:'embed_testworkspace1',type:'events',name:'Events',draft:{layout:'standard',items:[]},published:null};
  api.state.embeds=[embed];api.state.activeId=embed.id;window.location.search="?id="+embed.id;api.remember(embed);
  return {api, embed, window};
}
const event = (id,series,title,startsAt,featured=false)=>({id,seriesId:series,seriesTitle:title,title,startsAt,date:startsAt.slice(0,10),time:'9 AM',location:'The Pointe',featured});
const sources=[event('a2','a','Same title','2026-10-08T09:00:00Z'),event('b1','b','Same title','2026-10-02T09:00:00Z'),event('a1','a','Same title','2026-10-01T09:00:00Z'),event('featured','f','Featured later','2026-10-20T09:00:00Z',true)];
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('picker collapses dates by series without merging different same-title series',()=>{
 const {api}=workspace();api.state.events=structuredClone(sources);
 const choices=api.choices();assert.equal(choices.length,3);assert.deepEqual(Array.from(choices,c=>c.source.id),['featured','a1','b1']);assert.equal(choices[1].sources.length,2);
});
test('checking any series date toggles one selection; sidebar reflects public automatic order',()=>{
 const {api,embed}=workspace();api.state.events=structuredClone(sources);
 api.toggle('a2');api.toggle('b1');api.toggle('featured');
 assert.equal(embed.draft.items.length,3);
 assert.deepEqual(Array.from(api.selections(),x=>x.event.title),['Featured later','Same title','Same title']);
 assert.equal(api.selections()[1].event.date,'2026-10-01');
 api.toggle('a1');assert.equal(embed.draft.items.length,2);assert.equal(api.state.dirty,true);
});
test('refresh retains unsaved selections and overrides, while updating source events',async()=>{
 const {api,embed}=workspace();api.state.events=structuredClone(sources);
 const saved=structuredClone(embed);api.toggle('a1');embed.draft.items[0].overrides.title='Local title';
 api.api(()=>Promise.resolve({embeds:[saved],events:sources.slice(0,2)}));api.refresh(true);await settle();
 assert.equal(api.state.embeds[0].draft.items[0].overrides.title,'Local title');assert.equal(api.state.dirty,true);assert.equal(api.state.events.length,2);
 api.discard();assert.equal(api.state.embeds[0].draft.items.length,0);assert.equal(api.state.dirty,false);
});
test('discard restores the persisted copy; reopening does not resurrect discarded edits',()=>{
 const {api,embed}=workspace();api.state.events=structuredClone(sources);api.toggle('a1');api.open(embed.id);assert.equal(api.state.embeds[0].draft.items.length,0);
});
test('saving a draft leaves publication unchanged, then publish updates it explicitly',async()=>{
 const {api,embed}=workspace();api.state.events=structuredClone(sources);api.toggle('a1');
 const published={layout:'standard',items:[]};embed.published=published;
 api.api((_method,payload)=>Promise.resolve({embed:{...structuredClone(embed),published:payload.action==='publish'?structuredClone(embed.draft):published},message:'Saved'}));
 api.save(false);await settle();assert.equal(api.state.embeds[0].published.items.length,0);assert.equal(api.state.dirty,false);assert.match(api.status(api.state.embeds[0]),/unpublished changes/);
 api.save(true);await settle();assert.equal(api.state.embeds[0].published.items.length,1);assert.match(api.status(api.state.embeds[0]),/^Published/);
});
test('rename updates persisted snapshot without accidentally persisting unsaved content',async()=>{
 const {api,embed,window}=workspace();api.state.events=structuredClone(sources);api.toggle('a1');window.prompt=()=> 'Renamed';api.api(()=>Promise.resolve({name:'Renamed'}));api.rename(embed.id);await settle();api.discard();assert.equal(api.state.embeds[0].name,'Renamed');assert.equal(api.state.embeds[0].draft.items.length,0);
});
test('publication and refresh cannot race an image upload',()=>{
 const {api}=workspace();let requests=0;api.api(()=>{requests++;return Promise.resolve({});});api.state.imageUploadingId='a1';
 for(const action of ['publish','save-draft','refresh-events']) api.click({target:{closest:()=>({getAttribute:key=>key==='data-embeds-action'?action:null})}});
 assert.equal(requests,0);
});
test('editor exposes native selection controls, draft preview, missing selections and no manual sort controls',()=>{
 const {api,embed}=workspace();api.state.events=structuredClone(sources);api.toggle('a1');embed.draft.items.push({sourceEventId:'missing',recurrence:{planningCenterEventId:'missing',title:'Awaiting event'},overrides:{}});
 const html=api.renderEditor(embed);assert.match(html,/type="checkbox"/);assert.match(html,/Awaiting next date · not visible/);assert.match(html,/Draft preview/);assert.doesNotMatch(html,/action="move-event"|Move event up|Customize and order/);
 api.state.previewOpen=true;assert.match(api.renderEditor(embed),/sandbox="allow-scripts/);
 assert.doesNotMatch(api.renderGroups({type:'groups',name:'Groups',draft:{theme:'light'}}),/embeds-event-cards|data-draft-preview/);
});


test('closing mobile preview restores the event picker instead of exposing both panes',()=>{
 const {api}=workspace();api.state.mobilePanel='preview';api.state.previewOpen=true;
 api.click({target:{closest:()=>({getAttribute:key=>key==='data-embeds-action'?'toggle-preview':null})}});
 assert.equal(api.state.previewOpen,false);assert.equal(api.state.mobilePanel,'events');
});
